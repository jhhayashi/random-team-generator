import request from 'supertest'
import * as _ from 'lodash'

import {User} from '../types'

import app, {getRandomTeamsFromMembers} from './app'

const data: User[] = [
  {id: "1", name: "One"},
  {id: "2", name: "Two"},
  {id: "3", name: "Three"},
]

describe('Test getRandomTeamsFromMembers()', () => {
  it('returns the correct number of empty arrays when there are no users', () => {
    for (let i = 1; i <= 3; i+= 1) {
      const teams= getRandomTeamsFromMembers([], i, 10)
      expect(teams).toHaveLength(i)
      teams.forEach(team => expect(team).toHaveLength(0))
    }
  })
  it('returns disjoint teams', () => {
    const teams = getRandomTeamsFromMembers(data, data.length, 1)
    expect(teams).toHaveLength(data.length)
    const ids = [...new Set(_.flatMap(teams, team => team.map(user => user.id)))]
    expect(ids).toHaveLength(data.length)
  })
  it('returns a team with all members', () => {
    const teams = getRandomTeamsFromMembers(data, 1, data.length + 5) // 5 here is arbitrary
    expect(teams).toHaveLength(1)
    const team = teams[0]
    expect(team).toHaveLength(data.length)
    const ids = [...new Set(team.map(user => user.id))]
    expect(ids).toHaveLength(data.length)
  })
})

describe('Test the /api/v1/member endpoint', () => {
  it('Returns a random team member', () => {
    // @ts-ignore
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
