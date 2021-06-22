import * as _ from 'lodash'
import base64 from 'base-64'
import fetch from 'node-fetch'

import {User} from '../../types'
import {AppError} from '../errors'

const {
  BAMBOOHR_KEY,
  BAMBOOHR_SUBDOMAIN,
  CACHE_EXPIRATION_MS: CACHE_EXPIRATION_MS_STR = 1000 * 60 * 60 * 24, // 1 day
  NODE_ENV,
} = process.env

const CACHE_EXPIRATION_MS = +CACHE_EXPIRATION_MS_STR
const ALLOWED_KEYS = ['id', 'displayName', 'preferredName', 'jobTitle', 'department', 'location', 'imgUrl', 'name'] as const

export const ENABLED = !!(BAMBOOHR_KEY && BAMBOOHR_SUBDOMAIN) || NODE_ENV == 'test'

if (!ENABLED) console.log('No BAMBOOHR_KEY and BAMBOOHR_SUBDOMAIN. BambooHR integration disabled')
else if (NODE_ENV != 'test') console.log('Found BAMBOOHR_KEY and BAMBOOHR_SUBDOMAIN. BambooHR integration enabled.')

type ID = string

// https://documentation.bamboohr.com/docs/list-of-field-names
interface BambooEmployee {
  id: string | number
  displayName?: string
  preferredName?: string
  jobTitle?: string | string[]
  department?: string | string[]
  location?: string | string[]
  photoUrl: string
  supervisor?: string
}

interface BambooAPIResponse {
  fields: {id: string; type: string; name: string}[]
  employees: BambooEmployee[]
}

// the BambooEmployee type comes from the API call, but the Employee type
// is the normalized type that we use in the app
interface Employee extends User, Omit<BambooEmployee, 'id'|'jobTitle'|'department'|'location'> {
  name: string
  id: ID
  jobTitle?: string
  department?: string
  location?: string
}

// we only ALLOWED_KEYS so that we don't expose any sensitive information
type CachedEmployee = Pick<Employee, typeof ALLOWED_KEYS[number]>

interface OOOBlock {
  id: ID
  employeeId: ID
  start: string // yyyy-MM-dd
  end: string   // yyyy-MM-dd
}

export interface Cache {
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
    ooo?: OOOBlock[]
  }
}

export const cache: Cache = {}

export function warmCache() {
  getBambooData()
}

export function clearCache() {
  delete cache.date
  delete cache.data
}

function warn(str: string) {
  console.warn(`\x1b[33m${str}\x1b[0m`)
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

export function getNormalizedBambooCache(data: BambooAPIResponse): Required<Cache>['data'] {
    // any normalization
    const employees: Employee[] = data.employees.map(e => ({
      ...e,
      id: e.id.toString(),
      name: getName(e),
      jobTitle: _.isArray(e.jobTitle) ? _.last(e.jobTitle) : e.jobTitle,
      department: _.isArray(e.department) ? _.last(e.department) : e.department,
      location: _.isArray(e.location) ? _.last(e.location) : e.location,
      imgUrl: e.photoUrl,
    }))

    // maps ids to the employee object
    const ids = withOnlyTruthyValues(_.mapValues(_.groupBy(employees, e => e.id), arr => arr[0]))
    if (_.size(employees) !== _.size(ids)) warn('WARNING: duplicate BambooHR IDs found')

    // the data.by<Representation> keys map some key to a list of IDs
    // TODO: make this work in the case where more than one person has the same name
    const byDisplayName: {[name: string]: ID} = withOnlyTruthyValues(byFirstId(employees, e => e.displayName))
    if (_.size(employees) !== _.size(byDisplayName)) warn(`WARNING: duplicate BambooHR names found. there are ${_.size(employees)} employees and ${_.size(byDisplayName)} names`)
    const byName = {...byDisplayName, ...withOnlyTruthyValues(byFirstId(employees, e => e.name))}
    const byTeam: {[team: string]: ID[]} = byIds(employees, e => e.department)
    const byDirectReports: {[name: string]: ID[]} = byIds(
      employees,
      // bamboo supervisor isn't our normalized name, so we need to jump through some hoops to get to the normalized name
      e => e.supervisor ? ids[byName[e.supervisor] || '']?.name : undefined
    )

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
    if (managerNames.length !== managerIds.length) warn('WARNING: some manager IDs were not found')

    return {
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
}

export function getBambooData() {
  if (!ENABLED) {
    const err: AppError = new Error('BamboooHR integration is disabled')
    err.statusCode = 410
    return Promise.reject(err)
  }
  if (cache.date && cache.date + CACHE_EXPIRATION_MS > Date.now()) return Promise.resolve(cache.data)

  const authHeaderValue = `Basic ${base64.encode(`${BAMBOOHR_KEY}:x`)}`
  const dataPromise = fetch(
    `https://api.bamboohr.com/api/gateway.php/${BAMBOOHR_SUBDOMAIN}/v1/employees/directory`,
    {headers: {accept: 'application/json', authorization: authHeaderValue}},
  ).then(res => res.json())
  const oooPromise = fetch(
    'https://api.bamboohr.com/api/gateway.php/kensho/v1/time_off/whos_out/',
    {headers: {accept: 'application/json', authorization: authHeaderValue}},
  ).then(res => res.json())

  const allPromises = Promise.all([dataPromise, oooPromise])
    .then(([dataResponse, oooData]: [BambooAPIResponse, OOOBlock[]]) => {
      cache.date = Date.now()
      const data: Required<Cache>['data'] = {
        ...getNormalizedBambooCache(dataResponse),
        ooo: oooData.map(e => ({end: e.end, start: e.start, employeeId: `${e.employeeId}`, id: `${e.id}`})),
      }

      cache.data = data
      if (NODE_ENV != 'test') {
        console.log(`[${new Date().toLocaleString('en-US')}] BambooHR cache warmed with ${data.employees.length} employees`)
        console.log(`[${new Date().toLocaleString('en-US')}] BambooHR cache warmed with ${oooData.length} OOO blocks`)
      }
      return data
    })

  return cache.data ? Promise.resolve(cache.data) : allPromises
}
