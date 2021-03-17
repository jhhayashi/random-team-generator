import * as _ from 'lodash'
import base64 from 'base-64'
import fetch from 'node-fetch'

const {
  BAMBOOHR_KEY,
  BAMBOOHR_SUBDOMAIN,
  CACHE_EXPIRATION_MS: CACHE_EXPIRATION_MS_STR = 1000 * 60 * 60 * 24, // 1 day
  NODE_ENV,
} = process.env

const CACHE_EXPIRATION_MS = +CACHE_EXPIRATION_MS_STR
const ALLOWED_KEYS = ['id', 'displayName', 'preferredName', 'jobTitle', 'department', 'location', 'photoUrl', 'name'] as const

const ENABLED = BAMBOOHR_KEY && BAMBOOHR_SUBDOMAIN

if (!ENABLED && NODE_ENV !== 'test') console.log('No BAMBOOHR_KEY and BAMBOOHR_SUBDOMAIN. BambooHR integration turned off')

type ID = string

// https://documentation.bamboohr.com/docs/list-of-field-names
interface BambooEmployee {
  id: string | number
  displayName?: string
  preferredName?: string
  jobTitle?: string | string[]
  department?: string | string[]
  location?: string | string[]
  photoUrl?: string
  supervisor?: string
}

interface BambooAPIResponse {
  fields: {id: string; type: string; name: string}[]
  employees: BambooEmployee[]
}

// the BambooEmployee type comes from the API call, but the Employee type
// is the normalized type that we use in the app
interface Employee extends Omit<BambooEmployee, 'id'|'jobTitle'|'department'|'location'> {
  name: string
  id: ID
  jobTitle?: string
  department?: string
  location?: string
}

// we only ALLOWED_KEYS so that we don't expose any sensitive information
type CachedEmployee = Pick<Employee, typeof ALLOWED_KEYS[number]>

interface Cache {
  date?: number // Date.now()
  data?: {
    ids: {[id: string]: CachedEmployee}
    employees: CachedEmployee[]
    byName: {[name: string]: ID}
    byTeam: {[team: string]: ID[]}
    byDirectReports: {[name: string]: ID[]}
    byTransitiveReports: {[name: string]: ID[]}
    teamNames: string[]
    managerNames: string[]
    managerIds: ID[]
  }
}

export const cache: Cache = {}

export function clearCache() {
  delete cache.date
  delete cache.data
}

function getName (employee: Employee | BambooEmployee): string {
  if ('name' in employee) return employee.name
  return employee.displayName + (employee.preferredName ? ` (${employee.preferredName})` : '')
}

// takes an aggregation returned by a _.groupBy call and turns the values into a list of IDs rather than objects
function byIds(
  employees: Employee[],
  groupByFunction: (e: Employee) => string | undefined | null
): {[name: string]: ID[]} {
  // toss any users that don't have the particular parameter defined
  const candidates = employees.filter(e => groupByFunction(e))
  const aggregation = _.groupBy(candidates, groupByFunction)
  return _.mapValues(aggregation, eArr => eArr.map(e => e.id.toString()))
}

function byFirstId(employees: Employee[], groupByFunction: (e: Employee) => string | undefined) {
  const byIdArr = byIds(employees, groupByFunction)
  return _.mapValues(byIdArr, arr => arr[0]) 
}

function withOnlyTruthyValues<T extends {}>(obj: T): Record<string, NonNullable<T[keyof T]>>{
  return _.omitBy(obj, val => !val)
}

export function getBambooData() {
  if (cache.date && cache.date + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cache.data)

  const authHeaderValue = `Basic ${base64.encode(`${BAMBOOHR_KEY}:x`)}`
  const dataPromise = fetch(
    `https://api.bamboohr.com/api/gateway.php/${BAMBOOHR_SUBDOMAIN}/v1/employees/directory`,
    {headers: {accept: 'application/json', authorization: authHeaderValue}},
  )
    .then(res => res.json())
    .then((response: BambooAPIResponse) => {
      cache.date = Date.now()

      // any normalization
      const employees: Employee[] = response.employees.map(e => ({
        ...e,
        id: e.id.toString(),
        name: getName(e),
        jobTitle: _.isArray(e.jobTitle) ? _.last(e.jobTitle) : e.jobTitle,
        department: _.isArray(e.department) ? _.last(e.department) : e.department,
        location: _.isArray(e.location) ? _.last(e.location) : e.location,
      }))

      // maps ids to the employee object
      const ids = withOnlyTruthyValues(_.mapValues(_.groupBy(employees, e => e.id), arr => arr[0]))
      if (_.size(employees) !== _.size(ids)) console.warn('WARNING: duplicate BambooHR IDs found')

      // the data.by<Representation> keys map some key to a list of IDs
      // TODO: make this work in the case where more than one person has the same name
      const byName: {[name: string]: ID} = withOnlyTruthyValues(byFirstId(employees, e => e.name))
      if (_.size(employees) !== _.size(byName)) console.warn('WARNING: duplicate BambooHR names found')
      const byTeam: {[team: string]: ID[]} = byIds(employees, e => e.department)
      const byDirectReports: {[name: string]: ID[]} = byIds(employees, e => e.supervisor)

      function getEmployeeAndTransitiveReports(id: string): string[] {
        const name = ids[id]?.name
        if (!name || !byDirectReports[name]) return [id]
        return [id, ...(_.flatMap(byDirectReports[name], getEmployeeAndTransitiveReports))]
      }
      const byTransitiveReports: {[name: string]: string[]}  = _.mapValues(byDirectReports, ids => _.flatMap(ids, getEmployeeAndTransitiveReports))

      // the data.<Object>s keys list the object keys
      const teamNames = Object.keys(byTeam)
      const managerNames = Object.keys(byDirectReports)
      const managerIds = managerNames.map(name => byName[name]).filter(_.isString)

      const data = {
        // ensure we only keep non-sensitive info
        ids: _.mapValues(ids, e => _.pick(e, ALLOWED_KEYS)),
        employees: employees.map(e => _.pick(e, ALLOWED_KEYS)),

        byName,
        byTeam,
        byDirectReports,
        byTransitiveReports,
        teamNames,
        managerNames,
        managerIds,
      }
      cache.data = data
      if (NODE_ENV != 'test') {
        console.log(`[${new Date().toLocaleString('en-US')}] BambooHR cache warmed with ${data.employees.length} employees`)
      }
      return data
    })

  return cache.data ? Promise.resolve(cache.data) : dataPromise
}

// warm the cache
if (ENABLED) getBambooData()
