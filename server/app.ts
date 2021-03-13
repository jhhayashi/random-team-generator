import Express, {Request, Response} from 'express'
import * as _ from 'lodash'

import {User, APIv1Member} from '../types'

const {NODE_ENV} = process.env

const app = Express()

let team: User[] = []

// utility for setting fake data in tests
if (NODE_ENV == 'test') {
  Object.assign(app, {useFakeData(fakeData: any[]) { team = fakeData }})
}

function isPositiveInt(maybeInt: any): boolean {
  return _.isInteger(maybeInt) && maybeInt > 0
}

// Record / Object with at least one key defined
type AtLeastOneKey<O, T = {[K in keyof O]: Pick<O, K>}> = Partial<O> & T[keyof T]

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

const sendAPIV1Member = createResponseFunction<APIv1Member | undefined>()
app.get('/api/v1/member', (_req: Request, res: Response) => {
  const randomMember = getRandomTeamsFromMembers(team, {teamCount: 1, maxTeamSize: 1})[0]?.[0]
  sendAPIV1Member(res, randomMember)
})

export default app
