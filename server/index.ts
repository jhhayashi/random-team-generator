import {AddressInfo} from 'net'
import next from 'next'

import app from './app'

const PORT = process.env["PORT"] || 8080
const DEV = process.env["NODE_ENV"] != 'production'

if (DEV) console.log('Server running in development mode')

const nextServer = next({dev: DEV})
const nextHandler = nextServer.getRequestHandler()

nextServer.prepare().then(() => {
  app.use((req, res) => nextHandler(req, res))
  const expressServer = app.listen(PORT, () => {
    const { port } = expressServer?.address() as AddressInfo
    console.log(`Server listening at http://localhost:${port}`)
  })
})
