import Express, {NextFunction, Request, Response} from 'express'
import {check, matchedData} from 'express-validator'
const {addDays, isMatch, parseISO, isWithinInterval} = require('date-fns')
import * as _ from 'lodash'

import {Cache, getBambooData} from './data'

import {createResponseFunction, respondWith400IfErrors, getRandomTeamsFromMembers} from '../utils'
import {User, Filter, APIv1Member, APIv1Filters, APIv1Groups, APIv1Teams, APIv1Managers} from '../../types'

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

const sendAPIv1Member = createResponseFunction<APIv1Member | undefined>()
router.get(`${PREFIX}/v1/member`, (_req: Request, res: Response, next: NextFunction) => {
  getBambooData()
    .then((data)=> {
      if (!data?.employees) throw new Error('there are no employees')
      const randomMember = getRandomTeamsFromMembers(data?.employees, {teamCount: 1, maxTeamSize: 1})[0]?.[0]
      sendAPIv1Member(res, randomMember)
    })
    .catch(err => next(err))
})

const sendAPIv1Groups = createResponseFunction<APIv1Groups>()
router.get(
  `${PREFIX}/v1/groups`,
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
        sendAPIv1Groups(res, {groups})
      })
      .catch(err => next(err))
  }
)

const sendAPIv1Teams = createResponseFunction<APIv1Teams>()
const teamsUrl = `${PREFIX}/v1/teams`
router.get(teamsUrl, (_req: Request, res: Response, next: NextFunction) => {
  getBambooData()
    .then(data => sendAPIv1Teams(res, _.map(data?.teamNames, name => ({name}))))
    .catch(err => next(err))
})

const sendAPIv1Managers = createResponseFunction<APIv1Managers>()
const managersUrl = `${PREFIX}/v1/managers`
router.get(managersUrl, (_req: Request, res: Response, next: NextFunction) => {
  getBambooData()
    .then(data => {
      const managers = data?.managerIds.map(id => _.pick(data.ids[id], ['name', 'imgUrl'])).filter((m): m is APIv1Managers[number] => !_.isEmpty(m)) || []
      return sendAPIv1Managers(res, managers)
    })
    .catch(err => next(err))
})

const sendAPIv1Filters = createResponseFunction<APIv1Filters>()
router.get(`${PREFIX}/v1/filters`, (_req: Request, res: Response) => {
  const filters: Filter[] = [
    {type: "multiselect", name: 'managers', url: managersUrl},
    {type: "checkbox", name: 'includeManagers', label: 'Include managers in the teams'},
    {type: "multiselect", name: 'teams', url: teamsUrl},
    {type: "date", name: "oooDate", label: "Exclude people who are out of office on a date"},
  ]
  sendAPIv1Filters(res, filters)
})

export default router
