import request from 'supertest'

import {User} from '../types'

import app from './app'

const data: User[] = [
  {id: "1", name: "One"},
  {id: "2", name: "Two"},
  {id: "3", name: "Three"},
]

describe('Test the /api/v1/member endpoint', () => {
  it('Returns a random team member', () => {
    app.useFakeData(data)
    return request(app)
      .get('/api/v1/member')
      .expect(200)
      .then(res => {
        const {body} = res
        if (!body) throw new Error("must have a body")
        expect(body).toHaveProperty("id", expect.any(String))
        expect(body).toHaveProperty("name", expect.any(String))
      })
  })
})
