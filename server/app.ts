import Express, {NextFunction, Request, Response} from 'express'

import bambooRoutes, {metadata as bambooMetadata} from './bamboo/routes'
import slackRoutes, {metadata as slackMetadata}  from './slack/routes'
import {AppError} from './errors'

const app = Express()

app.use(bambooRoutes)
app.use(slackRoutes)

app.get('/api/integrations', (_req: Request, res: Response) => {
  res.json([bambooMetadata, slackMetadata])
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
