import Express, {NextFunction, Request, Response} from 'express'
import * as _ from 'lodash'

import {getSlackChannels, getSlackMembersByChannelId, warmCache} from './data'

import {createResponseFunction} from '../utils'
import {APIFilters, APISlackChannels, Filter, Integration} from '../../types'

const PROD = process.env['NODE_ENV'] == 'production'
const PREFIX = '/api/slack'

export const metadata: Integration = {name: 'Slack', apiPrefix: PREFIX}

if (PROD) warmCache()

const router = Express.Router()

const sendAPISlackChannels = createResponseFunction<APISlackChannels>()
const channelsUrl = `${PREFIX}/channels`
router.get(channelsUrl, (_req: Request, res: Response, next: NextFunction) => {
  getSlackChannels()
    .then(data => {
      sendAPISlackChannels(res, _.values(data?.channelsById))
    })
    .catch(err => next(err))
})

// temporary route for debugging
if (!PROD) {
  router.get(`${PREFIX}/channels/:channelId`, (req: Request, res: Response, next: NextFunction) => {
    const {channelId} = req.params
    if (!channelId) return res.status(400).send('Invalid channel ID')
    getSlackMembersByChannelId(channelId)
      .then(members => res.json(members))
      .catch(err => next(err))
  })
}

const sendAPIFilters = createResponseFunction<APIFilters>()
router.get(`${PREFIX}/filters`, (_req: Request, res: Response) => {
  const filters: Filter[] = [
    {type: "multiselect", name: 'channels', url: channelsUrl},
  ]
  sendAPIFilters(res, filters)
})

export default router
