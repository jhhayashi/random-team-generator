jest.mock('node-fetch')

import fetch from 'node-fetch'

import {cache, getBambooData} from './bamboo'

const {Response} = jest.requireActual('node-fetch')

const createMockUsers = (n = 3) => Array.from({length: n}, (_, i) => ({id: i.toString(), name: i.toString()}))
// [{id: "0", name: "0"}, {id: "1", name: "1"}, {id: "2", name: "2"}]
const users = createMockUsers()

test('getBambooData() successfully warms the cache', () => {
  // @ts-ignore
  fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({
    fields: [],
    employees: users,
  }))))
  return getBambooData()
    .then(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      console.log(JSON.stringify(cache, null, 2))
    })
})
