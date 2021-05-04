import Express, {NextFunction, Request, Response} from 'express'
import {AddressInfo} from 'net'
import PromBundle from 'express-prom-bundle'
import PromClient from 'prom-client'
import * as _ from 'lodash'

import {Integration} from '../types'

import bambooRoutes, {metadata as bambooMetadata} from './bamboo/routes'
import slackRoutes, {metadata as slackMetadata}  from './slack/routes'
import {createResponseFunction} from './utils'
import {AppError} from './errors'

const {HEALTHCHECK_ENDPOINT, PORT = 8080, METRICS_PORT} = process.env

const app = Express()

app.set('etag', false)
app.set('x-powered-by', false)

// create a healthcheck endpoint before the other registered routes so it doesn't shadow anything
if (HEALTHCHECK_ENDPOINT) {
  app.get(HEALTHCHECK_ENDPOINT, (_req: Request, res: Response) => res.sendStatus(200))
  console.log(`Healthcheck endpoint registered at ${HEALTHCHECK_ENDPOINT}`)
}

// metrics are registered after the healthcheck endpoint so that the checks aren't counted as metrics
if (METRICS_PORT) {
  app.use(PromBundle({
    includeStatusCode: true,
    includePath: true,
    metricType: 'histogram',
    autoregister: PORT == METRICS_PORT,
    promClient: {collectDefaultMetrics: {}},
    promRegistry: PromClient.register,
  }))
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

export function startMetricsApp() {
  if (METRICS_PORT == PORT) console.log('Metrics available at /metrics')
  if (!METRICS_PORT || METRICS_PORT == PORT) return

  const metricsApp = Express()
  metricsApp.set('etag', false)
  metricsApp.set('x-powered-by', false)
  metricsApp.use((_req: Request, res: Response) => {
    res.set('Content-Type', 'text/plain')
    PromClient.register.metrics().then(metrics => res.send(metrics))
  })
  const metricsServer = metricsApp.listen(METRICS_PORT, () => {
    const { port } = metricsServer?.address() as AddressInfo
    console.log(`Metrics server listening at http://localhost:${port}`)
  })
}

export function startApp() {
  const expressServer = app.listen(PORT, () => {
    const { port } = expressServer?.address() as AddressInfo
    console.log(`Server listening at http://localhost:${port}`)
  })
}

export default app
