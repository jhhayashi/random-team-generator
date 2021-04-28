import Express, {NextFunction, Request, Response} from 'express'
import * as _ from 'lodash'

import {getSlackData} from './data'

const PROD = process.env['NODE_ENV'] == 'production'
const PREFIX = '/api/slack'

if (PROD) {
  // warm the cache
  getSlackData()
}

const router = Express.Router()

const channelsUrl = `${PREFIX}/channels`
router.get(channelsUrl, (_req: Request, res: Response, next: NextFunction) => {
  getSlackData()
    .then(data => {
      res.json(_.values(data?.channelsById))
    })
    .catch(err => next(err))
})

export default router
