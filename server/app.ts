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

// creates `teamCount` teams of up to `maxTeamSize` members
export function getRandomTeamsFromMembers(users: User[], teamCount: number, maxTeamSize: number) {
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
  const randomMember = getRandomTeamsFromMembers(team, 1, 1)[0]?.[0]
  sendAPIV1Member(res, randomMember)
})

export default app
