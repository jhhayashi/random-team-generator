import {AddressInfo} from 'net'

import app from './app'

const PORT = process.env["port"] || 8080

const server = app.listen(PORT, () => {
  const { port } = server?.address() as AddressInfo
  console.log(`Server listening at http://localhost:${port}`)
})
