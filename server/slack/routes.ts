import Express, {NextFunction, Request, Response} from 'express'
import {check, matchedData} from 'express-validator'
import * as _ from 'lodash'

import {ENABLED, getSlackChannels, getSlackMembersByChannelIds, getSlackUsers, warmCache} from './data'

import {createResponseFunction, getRandomTeamsFromMembers, respondWith400IfErrors} from '../utils'
import {APIFilters, APIGroups, APIMember, APISlackChannels, Filter, Integration} from '../../types'

const PROD = process.env['NODE_ENV'] == 'production'
const PREFIX = '/api/slack'

export const metadata: Integration | null = ENABLED ? {name: 'Slack', apiPrefix: PREFIX} : null

if (PROD && ENABLED) warmCache()

const router = Express.Router()

const sendAPISlackChannels = createResponseFunction<APISlackChannels>()
const channelsUrl = `${PREFIX}/channels`
router.get(channelsUrl, (_req: Request, res: Response, next: NextFunction) => {
  getSlackChannels()
    .then(data => {
      const options = _.map(data?.channelsById, ({id, name, memberCount}) => ({value: id, name, memberCount}))
      sendAPISlackChannels(res, options)
    })
    .catch(err => next(err))
})

const sendAPIMember = createResponseFunction<APIMember>()
router.get(`${PREFIX}/member`, (_req: Request, res: Response, next: NextFunction) => {
  getSlackUsers()
    .then(users => {
      if (!users || !users.length) throw new Error('there are no slack users')
      const randomMember = getRandomTeamsFromMembers(users, {teamCount: 1, maxTeamSize: 1})[0]?.[0]
      if (!randomMember) throw new Error('failed to generate a random member')
      sendAPIMember(res, randomMember)
    })
    .catch(err => next(err))
})

const sendAPIGroups = createResponseFunction<APIGroups>()
router.get(
  `${PREFIX}/groups`,
  check(['groupCount', 'maxGroupSize']).optional().isInt({min: 1}).toInt(),
  check(['channels']).optional().isArray({min: 1}).toArray(),
  respondWith400IfErrors,
  (req: Request, res: Response, next: NextFunction) => {
    const {channels, groupCount, maxGroupSize} = matchedData(req)
    if (!groupCount && !maxGroupSize) {
      return res.status(400).json({errors: ['At least one of groupCount, maxGroupSize is required']})
    }

    const usersPromise = (channels && channels.length)
      ? getSlackMembersByChannelIds(channels)
      : getSlackUsers()

    usersPromise
      .then(members => {
        const groups = getRandomTeamsFromMembers(members, {teamCount: groupCount, maxTeamSize: maxGroupSize})
        sendAPIGroups(res, {groups})
      })
      .catch(err => next(err))
  }
)

const sendAPIFilters = createResponseFunction<APIFilters>()
router.get(`${PREFIX}/filters`, (_req: Request, res: Response) => {
  const filters: Filter[] = [
    {type: "multiselect", name: 'channels', url: channelsUrl},
  ]
  sendAPIFilters(res, filters)
})

export default router
