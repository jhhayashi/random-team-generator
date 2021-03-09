const express = require('express')

const PORT = process.env.port || 8080

const app = express()

app.use((req, res) => res.send('Hello World!'))

const server = app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${server.address().port}`)
})
