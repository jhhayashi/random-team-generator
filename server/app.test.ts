jest.mock('node-fetch')

import fetch from 'node-fetch'
import request from 'supertest'
import * as _ from 'lodash'

import {User, APIv1Groups} from '../types'

import app, {getRandomTeamsFromMembers} from './app'

const {Response} = jest.requireActual('node-fetch')

const createMockUsers = (n = 3) => Array.from({length: n}, (_, i) => ({imgUrl: i.toString(),id: i.toString(), name: i.toString()}))
// [{id: "1", name: "1"}, {id: "2", name: "2"}, {id: "3", name: "3"}]
const users: User[] = createMockUsers()

describe('Test getRandomTeamsFromMembers()', () => {
  // ==================================
  // Cases where teamCount and maxTeamSize are both defined
  // ==================================
  it('returns the correct number of empty arrays when there are no users', () => {
    for (let i = 1; i <= 3; i+= 1) {
      const teams = getRandomTeamsFromMembers([], {teamCount: i, maxTeamSize: 10})
      expect(teams).toHaveLength(i)
      teams.forEach(team => expect(team).toHaveLength(0))
    }
  })
  it('returns disjoint teams', () => {
    const teams = getRandomTeamsFromMembers(users, {teamCount: users.length, maxTeamSize: 1})
    expect(teams).toHaveLength(users.length)
    const ids = [...new Set(_.flatMap(teams, team => team.map(user => user.id)))]
    expect(ids).toHaveLength(users.length)
  })
  it('returns a team with all members', () => {
    const teams = getRandomTeamsFromMembers(users, {teamCount: 1, maxTeamSize: users.length + 5}) // 5 here is arbitrary
    expect(teams).toHaveLength(1)
    const team = teams[0]
    expect(team).toHaveLength(users.length)
    const ids = [...new Set((team || []).map(user => user.id))]
    expect(ids).toHaveLength(users.length)
  })

  // ==================================
  // Cases where teamCount is defined and maxTeamSize is undefined
  // ==================================
  it('returns all users in the correct number of teams when maxTeamSize is not defined', () => {
    const mockUserCount = 10
    const mockUsers = createMockUsers(mockUserCount);
    [1,2,3,5,7].forEach(i => {
      const teams = getRandomTeamsFromMembers(mockUsers, {teamCount: i})
      // should have correct number of teams
      expect(teams).toHaveLength(i)

      // should include all users
      const ids = [...new Set(_.flatMap(teams, team => team.map(user => user.id)))]
      expect(ids).toHaveLength(mockUsers.length)

      // should balance evenly
      const lengths = teams.map(team => team.length)
      expect(new Set(lengths).size).toBeLessThanOrEqual(2)
    })
  })

  // ==================================
  // Cases where teamCount is undefined and maxTeamSize is defined
  // ==================================
  it('returns all users correctly sized teams when teamCount is not defined', () => {
    const mockUserCount = 10
    const mockUsers = createMockUsers(mockUserCount);
    [1,2,3,5,7].forEach(i => {
      const teams = getRandomTeamsFromMembers(mockUsers, {maxTeamSize: i})
      // should have correct size of teams
      teams.forEach(team => expect(team.length).toBeLessThanOrEqual(i))

      // should include all users
      const ids = [...new Set(_.flatMap(teams, team => team.map(user => user.id)))]
      expect(ids).toHaveLength(mockUsers.length)

      // should balance evenly
      const lengths = teams.map(team => team.length)
      expect(new Set(lengths).size).toBeLessThanOrEqual(2)
    })
  })

  // ==================================
  // Cases where teamCount and maxTeamSize are both undefined
  // ==================================
  it('errors when both teamCount and maxTeamSize are undefined or invalid', () => {
    // @ts-ignore
    expect(() => getRandomTeamsFromMembers(users)).toThrow()
    // @ts-ignore
    expect(() => getRandomTeamsFromMembers(users, {})).toThrow()
    expect(() => getRandomTeamsFromMembers(users, {teamCount: 0})).toThrow()
    expect(() => getRandomTeamsFromMembers(users, {teamCount: 0, maxTeamSize: 1})).toThrow()
    expect(() => getRandomTeamsFromMembers(users, {maxTeamSize: 0})).toThrow()
    expect(() => getRandomTeamsFromMembers(users, {maxTeamSize: 0, teamCount: 1})).toThrow()
  })
})
describe('Endpoint Tests', () => {
  beforeEach(() => {
    // @ts-ignore
    fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({
      fields: [],
      employees: users,
    }))))
  })

  describe('Test the /api/v1/member endpoint', () => {
    test('Returns a random team member', () => {
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

  describe('Test the /api/v1/groups endpoint', () => {
    test('Returns 400 when no query', () => request(app).get('/api/v1/groups').expect(400))
    test('Returns 400 on bad query', () => request(app).get('/api/v1/groups?groupCount=foo').expect(400))

    test('Returns a group with all users when groupCount=1', () => {
      return request(app)
        .get('/api/v1/groups?groupCount=1')
        .expect(200)
        .then(res => {
          const {body} = res
          if (!body) throw new Error("must have a body")
          const {groups} = body
          expect(groups).toHaveLength(1)
          const group = groups[0]
          expect(group).toHaveLength(users.length)
          const member = group[0]
          expect(member).toHaveProperty("id", expect.any(String))
          expect(member).toHaveProperty("name", expect.any(String))
        })
    })

    test('Returns all users in single-member groups when maxGroupSize=1', () => {
      return request(app)
        .get('/api/v1/groups?maxGroupSize=1')
        .expect(200)
        .then(res => {
          const {body} = res
          if (!body) throw new Error("must have a body")
          const groups: Array<typeof users> = body.groups
          expect(groups).toHaveLength(users.length)
          groups.forEach(group => {
            expect(group).toHaveLength(1)
            const member = group[0]
            expect(member).toHaveProperty("id", expect.any(String))
            expect(member).toHaveProperty("name", expect.any(String))
          })
        })
    })

    test('Returns as expected when groupCount and maxGroupSize as both passed', () => {
      return request(app)
        .get('/api/v1/groups?groupCount=2&maxGroupSize=2')
        .expect(200)
        .then(res => {
          const body: APIv1Groups = res.body
          const {groups} = body
          expect(groups[0]).toHaveLength(2)
          expect(groups[1]).toHaveLength(Math.min(users.length - 2, 2))
        })
    })
  })
})
