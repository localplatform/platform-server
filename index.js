import { createServer } from 'http'
import cookieParser from 'cookie-parser'
import express, { json } from 'express'
import cors from 'cors'
import validateAuth from './middlewares/validateAuth.js'
import routers from './routes/index.js'

const app = express()
const allowedOrigins = [
    'https://dev-admin.mynetwk.biz',
    'https://dev-auth.mynetwk.biz',
    'https://dev-platform-server.mynetwk.biz'
]

app.use(cookieParser())
app.use(json())
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}))

app.use('/config', validateAuth, routers.config)
app.use('/auth', routers.auth)

createServer(app).listen(4000, () => console.log('Platform server running on port 4000'))