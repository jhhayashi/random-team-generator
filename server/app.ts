import Express, {NextFunction, Request, Response} from 'express'
import {check, matchedData, validationResult} from 'express-validator'
import * as _ from 'lodash'

import {User, APIv1Member, APIv1Groups} from '../types'

import {getBambooData} from './bamboo'
import {AppError} from './errors'

const PROD = process.env['NODE_ENV'] == 'production'

if (PROD) {
  // warm the cache
  getBambooData()
}

const app = Express()

function isPositiveInt(maybeInt: any): boolean {
  return _.isInteger(maybeInt) && maybeInt > 0
}

// Record / Object with at least one key defined
type AtLeastOneKey<O, T = {[K in keyof O]: Pick<O, K>}> = Partial<O> & T[keyof T]

function respondWith400IfErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({errors: errors.array()})
  next()
}

/* creates random teams based on a list of candidate users
 *
 * | teamCount | maxTeamSize |
 * |    x      |     x       | if both are specified, creates `teamCount` teams of up to `maxTeamSize` members
 * |    x      |     -       | creates `teamCount` teams, distributing all users as evenly as possible
 * |    -      |     x       | creates [Math.ceil(users / maxTeamSize)] teams and distributes users
 * |    -      |     -       | errors
 */
export function getRandomTeamsFromMembers(
  users: User[],
  {teamCount: teamCountArg, maxTeamSize: maxTeamSizeArg}: AtLeastOneKey<Record<'teamCount'|'maxTeamSize',  number>>
) {
  if (teamCountArg != undefined && !isPositiveInt(teamCountArg)) throw new Error('teamCount must be a positive integer')
  if (maxTeamSizeArg != undefined && !isPositiveInt(maxTeamSizeArg)) throw new Error('maxTeamSize must be a positive integer')
  if (!teamCountArg && !maxTeamSizeArg) throw new Error('At least one of teamCount, maxTeamSize is required')
  const maxTeamSize = maxTeamSizeArg || users.length
  const teamCount = teamCountArg || Math.ceil(users.length / maxTeamSize)
  const teams: User[][]  = Array.from({length: teamCount}, _ => ([]))
  const candidates = _.sampleSize(users, teamCount * maxTeamSize)
  candidates.forEach((user, i) => teams[i % teamCount]?.push(user))
  return teams
}

// since there's no good way to type an express response, we have to add some
// small overhead that types the response for us
function createResponseFunction<T>() {
  return function(res: Response, json: T) {
    res.json(json)
  }
}

const sendAPIv1Member = createResponseFunction<APIv1Member | undefined>()
app.get('/api/v1/member', (_req: Request, res: Response, next: NextFunction) => {
  getBambooData()
    .then((data)=> {
      if (!data?.employees) throw new Error('there are no employees')
      const randomMember = getRandomTeamsFromMembers(data?.employees, {teamCount: 1, maxTeamSize: 1})[0]?.[0]
      sendAPIv1Member(res, randomMember)
    })
    .catch(err => next(err))
})

const sendAPIv1Groups = createResponseFunction<APIv1Groups>()
app.get(
  '/api/v1/groups',
  check('groupCount').optional().isInt({min: 1}).toInt(),
  check('maxGroupSize').optional().isInt({min: 1}).toInt(),
  respondWith400IfErrors,
  (req: Request, res: Response, next: NextFunction) => {
    const {groupCount, maxGroupSize} = matchedData(req)
    if (!groupCount && !maxGroupSize) {
      return res.status(400).json({errors: ['At least one of groupCount, maxGroupSize is required']})
    }
    getBambooData()
      .then((data) => {
        if (!data?.employees) throw new Error('there are no employees')
        const groups = getRandomTeamsFromMembers(
          data?.employees,
          {teamCount: groupCount, maxTeamSize: maxGroupSize}
        )
        sendAPIv1Groups(res, {groups})
      })
      .catch(err => next(err))
  }
)

app.use((err: Error | AppError, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = 'statusCode' in err  && err.statusCode ? err.statusCode : 500
  if (err) return res.status(statusCode).send(err.message || 'Internal Server Error')
})

export default app
