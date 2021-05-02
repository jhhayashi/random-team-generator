import Express, {NextFunction, Request, Response} from 'express'
import {check, matchedData} from 'express-validator'
const {addDays, isMatch, parseISO, isWithinInterval} = require('date-fns')
import * as _ from 'lodash'

import {Cache, getBambooData} from './data'

import {createResponseFunction, respondWith400IfErrors, getRandomTeamsFromMembers} from '../utils'
import {User, Filter, APIMember, APIFilters, APIGroups, APITeams, APIManagers} from '../../types'

const PROD = process.env['NODE_ENV'] == 'production'
const PREFIX = '/api/bamboo'

if (PROD) {
  // warm the cache
  getBambooData()
}

const router = Express.Router()

function filterByManager(cache: Required<Cache>['data'], users: User[], managers?: string[], includeManagers?: boolean): User[] {
  if (!managers) return users
  const candidateUserIds = new Set([
    ..._.flatMap(managers, manager => cache.byTransitiveReports[manager] || []),
    ...(includeManagers ? managers.map(name => cache.byName[name]).filter(Boolean) : [])
  ])
  return users.filter(user => candidateUserIds.has(user.id))
}

function filterByTeam(cache: Required<Cache>['data'], users: User[], teams?: string[]): User[] {
  if (!teams) return users
  const candidateUserIds = new Set(_.flatMap(teams, team=> cache.byTeam[team] || []))
  return users.filter(user => candidateUserIds.has(user.id))
}

function filterByOoo(cache: Required<Cache>['data'], users: User[], date?: string): User[] {
  if (!date) return users
  const oooBlocks = cache.ooo?.filter(employee => isWithinInterval(
    parseISO(date),
    // add a day to the end date to make the range inclusive
    {start: parseISO(employee.start), end: addDays(parseISO(employee.end), 1)}
  )) || []
  const oooUsers = new Set(oooBlocks.map(({employeeId}) => employeeId))
  return users.filter(user => !oooUsers.has(user.id))
}

const sendAPIMember = createResponseFunction<APIMember | undefined>()
router.get(`${PREFIX}/member`, (_req: Request, res: Response, next: NextFunction) => {
  getBambooData()
    .then((data)=> {
      if (!data?.employees) throw new Error('there are no employees')
      const randomMember = getRandomTeamsFromMembers(data?.employees, {teamCount: 1, maxTeamSize: 1})[0]?.[0]
      sendAPIMember(res, randomMember)
    })
    .catch(err => next(err))
})

const sendAPIGroups = createResponseFunction<APIGroups>()
router.get(
  `${PREFIX}/groups`,
  check(['groupCount', 'maxGroupSize']).optional().isInt({min: 1}).toInt(),
  check(['managers', 'teams']).optional().isArray({min: 1}).toArray(),
  check('includeManagers').optional().isBoolean().toBoolean(),
  check('oooDate', 'oooDate must be of form tttt-MM-dd').optional().custom(val => isMatch(val, 'yyyy-MM-dd')),
  respondWith400IfErrors,
  (req: Request, res: Response, next: NextFunction) => {
    const {groupCount, includeManagers, maxGroupSize, managers, oooDate, teams} = matchedData(req)
    if (!groupCount && !maxGroupSize) {
      return res.status(400).json({errors: ['At least one of groupCount, maxGroupSize is required']})
    }
    getBambooData()
      .then((data) => {
        if (!data?.employees) throw new Error('there are no employees')
        const inOffice = filterByOoo(data, data.employees, oooDate)
        const candidateMembers = filterByManager(data, filterByTeam(data, inOffice, teams), managers, includeManagers)
        const groups = getRandomTeamsFromMembers(
          candidateMembers,
          {teamCount: groupCount, maxTeamSize: maxGroupSize}
        )
        sendAPIGroups(res, {groups})
      })
      .catch(err => next(err))
  }
)

const sendAPITeams = createResponseFunction<APITeams>()
const teamsUrl = `${PREFIX}/teams`
router.get(teamsUrl, (_req: Request, res: Response, next: NextFunction) => {
  getBambooData()
    .then(data => sendAPITeams(res, _.map(data?.teamNames, name => ({name}))))
    .catch(err => next(err))
})

const sendAPIManagers = createResponseFunction<APIManagers>()
const managersUrl = `${PREFIX}/managers`
router.get(managersUrl, (_req: Request, res: Response, next: NextFunction) => {
  getBambooData()
    .then(data => {
      const managers = data?.managerIds.map(id => _.pick(data.ids[id], ['name', 'imgUrl'])).filter((m): m is APIManagers[number] => !_.isEmpty(m)) || []
      return sendAPIManagers(res, managers)
    })
    .catch(err => next(err))
})

const sendAPIFilters = createResponseFunction<APIFilters>()
router.get(`${PREFIX}/filters`, (_req: Request, res: Response) => {
  const filters: Filter[] = [
    {type: "multiselect", name: 'managers', url: managersUrl},
    {type: "checkbox", name: 'includeManagers', label: 'Include managers in the teams'},
    {type: "multiselect", name: 'teams', url: teamsUrl},
    {type: "date", name: "oooDate", label: "Exclude people who are out of office on a date"},
  ]
  sendAPIFilters(res, filters)
})

export default router
