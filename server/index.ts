import next from 'next'

import app, {startApp, startMetricsApp} from './app'

const DEV = process.env["NODE_ENV"] != 'production'

if (DEV) console.log('Server running in development mode')

const nextServer = next({dev: DEV})
const nextHandler = nextServer.getRequestHandler()

nextServer.prepare().then(() => {
  app.use((req, res) => nextHandler(req, res))
  startApp()
  startMetricsApp()
})
