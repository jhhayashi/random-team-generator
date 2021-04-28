import {NextFunction, Request, Response} from 'express'
import {validationResult} from 'express-validator'
import * as _ from 'lodash'

import {User} from '../../types'

// since there's no good way to type an express response, we have to add some
// small overhead that types the response for us
export function createResponseFunction<T>() {
  return function(res: Response, json: T) {
    res.json(json)
  }
}

export function respondWith400IfErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({errors: errors.array()})
  next()
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

