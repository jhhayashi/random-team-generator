import Express, {NextFunction, Request, Response} from 'express'
import * as _ from 'lodash'

import {Integration} from '../types'

import bambooRoutes, {metadata as bambooMetadata} from './bamboo/routes'
import slackRoutes, {metadata as slackMetadata}  from './slack/routes'
import {createResponseFunction} from './utils'
import {AppError} from './errors'

const {HEALTHCHECK_ENDPOINT} = process.env

const app = Express()

app.set('etag', false)
app.set('x-powered-by', false)

// create a healthcheck endpoint before the other registered routes so it doesn't shadow anything
if (HEALTHCHECK_ENDPOINT) {
  app.get(HEALTHCHECK_ENDPOINT, (_req: Request, res: Response) => res.sendStatus(200))
  console.log(`Healthcheck endpoint registered at ${HEALTHCHECK_ENDPOINT}`)
}

app.use(bambooRoutes)
app.use(slackRoutes)

const sendIntegrations = createResponseFunction<Integration[]>()
app.get('/api/integrations', (_req: Request, res: Response) => {
  sendIntegrations(res, _.compact([bambooMetadata, slackMetadata]))
})

app.use((err: Error | AppError, _req: Request, res: Response, _next: NextFunction) => {
  // app error and we can be transparent about the message
  if ('statusCode' in err && err.statusCode) {
    return res.status(err.statusCode).send(err.message || 'Internal Server Error')
  }

  // unexpected error which should be logged
  console.error(err)
  return res.status(500).send('Internal Server Error')
})

export default app
