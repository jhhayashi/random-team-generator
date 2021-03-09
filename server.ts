import Express, {Request, Response} from 'express'
import {AddressInfo} from 'net'

const PORT = process.env["port"] || 8080

const app = Express()

app.use((_: Request, res: Response) => res.send('Hello World!'))

const server = app.listen(PORT, () => {
  const { port } = server?.address() as AddressInfo
  console.log(`Server listening at http://localhost:${port}`)
})
