import Express, {NextFunction, Request, Response} from 'express'

import bambooRoutes, {metadata as bambooMetadata} from './bamboo/routes'
import slackRoutes from './slack/routes'
import {AppError} from './errors'

const app = Express()

app.use(bambooRoutes)
app.use(slackRoutes)

app.get('/api/integrations', (_req: Request, res: Response) => {
  res.json([bambooMetadata])
})

app.use((err: Error | AppError, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = 'statusCode' in err  && err.statusCode ? err.statusCode : 500
  if (err) return res.status(statusCode).send(err.message || 'Internal Server Error')
})

export default app
