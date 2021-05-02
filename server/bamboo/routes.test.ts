jest.mock('node-fetch')

import fetch from 'node-fetch'
import Express from 'express'
import request from 'supertest'
import * as _ from 'lodash'

import {APIGroups} from '../../types'

import routes from './routes'

const {Response} = jest.requireActual('node-fetch')

const app = Express()
app.use(routes)

//    1
//   /  \
//  2     3
//  /\    /\
// 4  5  6  7
const mockUsers = [
  {id: "1", name: "One",   supervisor: ''},
  {id: "2", name: "Two",   department: "A", supervisor: 'One'},
  {id: "3", name: "Three", department: "A", supervisor: 'One'},
  {id: "4", name: "Four",  department: "", supervisor: 'Two'},
  {id: "5", name: "Five",  department: "B", supervisor: 'Two'},
  {id: "6", name: "Six",   department: "B", supervisor: 'Three'},
  {id: "7", name: "Seven", department: "B", supervisor: 'Three'},
]

const oooBlocks = [
  {id: "1", employeeId: "1", start: "2000-01-01", end: "2000-02-01"},
  {id: "2", employeeId: "2", start: "2000-02-01", end: "2000-03-01"},
]

// we don't need to do beforeEach() here, since the result should be cached
fetch
  // @ts-ignore
  .mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify({
    fields: [],
    employees: mockUsers,
  }))))
  // @ts-ignore
  .mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(oooBlocks))))

describe('Test the /api/bamboo/member endpoint', () => {
  test('Returns a random team member', () => {
    return request(app)
      .get('/api/bamboo/member')
      .expect(200)
      .then(res => {
        const {body} = res
        if (!body) throw new Error("must have a body")
        expect(body).toHaveProperty("id", expect.any(String))
        expect(body).toHaveProperty("name", expect.any(String))
      })
  })
})

describe('Test the /api/bamboo/groups endpoint', () => {
  test('Returns 400 when no query', () => request(app).get('/api/bamboo/groups').expect(400))
  test('Returns 400 on invalid groupCount', () => request(app).get('/api/bamboo/groups?groupCount=foo').expect(400))
  test('Returns 400 on invalid maxGroupSize', () => request(app).get('/api/bamboo/groups?maxGroupSize=-1').expect(400))
  test('Returns 400 on invalid managers', () => request(app).get('/api/bamboo/groups?groupCount=1&managers=foo').expect(400))
  test('Returns 400 on invalid teams', () => request(app).get('/api/bamboo/groups?groupCount=1&teams=1').expect(400))
  test('Returns 400 on invalid includeManagers', () => request(app).get('/api/bamboo/groups?groupCount=1&includeManagers=').expect(400))

  test('Returns a group with all users when groupCount=1', () => {
    return request(app)
      .get('/api/bamboo/groups?groupCount=1')
      .expect(200)
      .then(res => {
        const {body} = res
        if (!body) throw new Error("must have a body")
        const {groups} = body
        expect(groups).toHaveLength(1)
        const group = groups[0]
        expect(group).toHaveLength(mockUsers.length)
        const member = group[0]
        expect(member).toHaveProperty("id", expect.any(String))
        expect(member).toHaveProperty("name", expect.any(String))
      })
  })

  test('Returns all users in single-member groups when maxGroupSize=1', () => {
    return request(app)
      .get('/api/bamboo/groups?maxGroupSize=1')
      .expect(200)
      .then(res => {
        const {body} = res
        if (!body) throw new Error("must have a body")
        const groups: Array<typeof mockUsers> = body.groups
        expect(groups).toHaveLength(mockUsers.length)
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
      .get('/api/bamboo/groups?groupCount=2&maxGroupSize=2')
      .expect(200)
      .then(res => {
        const body: APIGroups = res.body
        const {groups} = body
        expect(groups[0]).toHaveLength(2)
        expect(groups[1]).toHaveLength(Math.min(mockUsers.length - 2, 2))
      })
  })

  test('Filters by manager', () => {
      return request(app)
        .get('/api/bamboo/groups?groupCount=1&managers[]=Two')
        .expect(200)
        .then(res => {
          const body: APIGroups = res.body
          const {groups} = body
          expect(groups[0]).toHaveLength(2)
          expect(groups[0]?.map(users => users.id).sort()).toEqual(["4", "5"])
        })
  })

  test('Filters by team', () => {
      return request(app)
        .get('/api/bamboo/groups?groupCount=1&teams[]=A')
        .expect(200)
        .then(res => {
          const body: APIGroups = res.body
          const {groups} = body
          expect(groups[0]).toHaveLength(2)
          expect(groups[0]?.map(users => users.id).sort()).toEqual(["2", "3"])
        })
  })

  test('Filters by manager and team', () => {
      return request(app)
        .get('/api/bamboo/groups?groupCount=1&teams[]=B&managers[]=Two')
        .expect(200)
        .then(res => {
          const body: APIGroups = res.body
          const {groups} = body
          expect(groups[0]).toHaveLength(1)
          expect(groups[0]?.[0]?.id).toBe("5")
        })
  })

  test('Includes manager when specified', () => {
      return request(app)
        .get('/api/bamboo/groups?groupCount=1&managers[]=Two&includeManagers=true')
        .expect(200)
        .then(res => {
          const body: APIGroups = res.body
          const {groups} = body
          expect(groups[0]).toHaveLength(3)
          expect(groups[0]?.map(users => users.id).sort()).toEqual(["2", "4", "5"])
        })
  })

  test('Filters out people who are OOO', () => {
      return request(app)
        .get('/api/bamboo/groups?groupCount=1&oooDate=2000-02-01')
        .expect(200)
        .then(res => {
          const body: APIGroups = res.body
          const {groups} = body
          expect(groups[0]).toHaveLength(mockUsers.length - 2)
          const userIds = new Set(groups[0]?.map(({id}) => id))
          expect(userIds.has("1")).toBeFalsy()
          expect(userIds.has("2")).toBeFalsy()
        })
  })
})
