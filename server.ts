import Express, {Request, Response} from 'express'
import {AddressInfo} from 'net'
import * as _ from 'lodash'

import {User, APIv1Member} from './types'

const PORT = process.env["port"] || 8080

const app = Express()

const team: User[] = []

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

const server = app.listen(PORT, () => {
  const { port } = server?.address() as AddressInfo
  console.log(`Server listening at http://localhost:${port}`)
})
