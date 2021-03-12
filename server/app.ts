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

// since there's no good way to type an express response, we have to add some
// small overhead that types the response for us
function createResponseFunction<T>() {
  return function(res: Response, json: T) {
    res.json(json)
  }
}

const sendAPIV1Member = createResponseFunction<APIv1Member | undefined>()
app.get('/api/v1/member', (_req: Request, res: Response) => {
  const randomMember = _.sample(team)
  sendAPIV1Member(res, randomMember)
})

export default app
