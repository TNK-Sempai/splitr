import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import authRouter from './api/auth.js'
import monthsRouter from './api/months.js'
import expensesRouter from './api/expenses.js'
import balanceRouter from './api/balance.js'

const app = express()

app.use(cors({ origin: `http://localhost:${process.env.PORT || 3000}`, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(express.static('src'))

app.use('/api/auth', authRouter)
app.use('/api', monthsRouter)
app.use('/api', expensesRouter)
app.use('/api', balanceRouter)

app.get('/app', (req, res) => res.sendFile('app.html', { root: 'src' }))
app.get('/', (req, res) => res.sendFile('index.html', { root: 'src' }))

app.listen(process.env.PORT || 3000, () => {
  console.log(`Splitr running on http://localhost:${process.env.PORT || 3000}`)
})
