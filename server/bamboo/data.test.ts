jest.mock('node-fetch')

import fetch from 'node-fetch'
import * as _ from 'lodash'

import {cache, clearCache, getBambooData} from './data'

const {Response} = jest.requireActual('node-fetch')

const createMockUsers = (n = 3) => Array.from({length: n}, (_, i) => ({id: i.toString(), name: i.toString()}))
// [{id: "0", name: "0"}, {id: "1", name: "1"}, {id: "2", name: "2"}]
const users = createMockUsers()

beforeEach(() => {
  clearCache()
  jest.clearAllMocks()
})

function setUsers(mockUsers: {[k: string]: any}[] = users) {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({
    fields: [],
    employees: mockUsers,
  }))))
}

describe('caching behavior', () => {
  test('getBambooData() successfully warms the cache', () => {
    const mockUserCount = 10
    const mockUsers = createMockUsers(mockUserCount)
    setUsers(mockUsers)
    return getBambooData()
      .then(() => {
        expect(fetch).toHaveBeenCalledTimes(1);
        [
          ['ids', mockUserCount],
          ['employees', mockUserCount],
          ['byName', mockUserCount],
          ['byTeam', 0],
          ['byDirectReports', 0],
          ['byTransitiveReports', 0],
          ['teamNames', 0],
          ['managerNames', 0],
          ['managerIds', 0],
        ].forEach(([key, expectedCount]) => {
          // @ts-ignore
          expect(_.size(cache.data?.[key])).toBe(expectedCount)
        })
      })
  })

  test('clearCache() successfully clears the cache', () => {
    clearCache()
    expect(_.size(cache)).toBe(0)
    setUsers()
    return getBambooData()
      .then(() => {
        expect(_.size(cache)).toBeGreaterThan(0)
        expect(_.size(cache.data)).toBeGreaterThan(0)
        clearCache()
        expect(_.size(cache)).toBe(0)
        expect(cache.data).toBeUndefined()
      })
  })
})

describe('aggregations', () => {
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
  beforeEach(() => {
    setUsers(mockUsers)
  })

  test('getBambooData() sets names correctly', () => {
    setUsers([
      {id: "1", name: "1"},
      {id: "2", displayName: "2"},
      {id: "3", displayName: "3", preferredName: "3"},
    ])
    return getBambooData()
      .then(() => {
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(cache.data?.employees).toHaveLength(3);
        [
          ["1", "1"],
          ["2", "2"],
          ["3", "3 (3)"],
        ].forEach(([id, expectedName]) => {
          // @ts-ignore
          expect(cache.data?.ids[id].name).toBe(expectedName)
          // @ts-ignore
          expect(cache.data?.byName[expectedName]).toBe(id)
        })
      })
  })

  test('departments/teams are set correctly', () => {
    return getBambooData()
      .then(() => {
        expect(cache.data?.teamNames).toEqual(["A", "B"])
        // it's probably invalid to have a department of ''
        expect(_.size(cache.data?.byTeam)).toBe(2)
        expect(cache.data?.byTeam["A"]).toEqual(["2", "3"])
        expect(cache.data?.byTeam["B"]).toEqual(["5", "6", "7"])
      })
  })

  test('managers are correctly identified', () => {
    return getBambooData()
      .then(() => {
        expect(cache.data?.managerNames).toEqual(["One", "Two", "Three"])
        expect(cache.data?.managerIds).toEqual(["1", "2", "3"])
      })
  })

  test('reports are correctly identified', () => {
    return getBambooData()
      .then(() => {
        const {byDirectReports, byTransitiveReports} = cache.data as Required<typeof cache>['data']
        expect(_.size(byDirectReports)).toBe(3)
        expect(_.size(byTransitiveReports)).toBe(3)
        expect(byDirectReports["One"]).toEqual(["2", "3"])
        expect(byDirectReports["Two"]).toEqual(["4", "5"])
        expect(byDirectReports["Three"]).toEqual(["6", "7"])
        // order doesn't matter, so we may need to sort if this breaks
        expect(byTransitiveReports["One"]).toEqual(["2", "4", "5", "3", "6", "7"])
        expect(byTransitiveReports["Two"]).toEqual(["4", "5"])
        expect(byTransitiveReports["Three"]).toEqual(["6", "7"])
      })
  })
})
