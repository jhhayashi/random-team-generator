import Express, {NextFunction, Request, Response} from 'express'
import * as _ from 'lodash'

import {getSlackChannels, getSlackMembersByChannelId} from './data'

import {createResponseFunction} from '../utils'
import {APISlackChannels} from '../../types'

const PROD = process.env['NODE_ENV'] == 'production'
const PREFIX = '/api/slack'

if (PROD) {
  // warm the cache
  getSlackChannels()
}

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

export default router
