import cors from 'cors'
import express from 'express'
import { config, validateProductionConfig } from './config.js'
import { apiRouter } from './routes/index.js'

export function createApp() {
  validateProductionConfig()

  const app = express()

  app.set('trust proxy', true)

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  )

  app.use(express.json({ limit: '1mb' }))

  app.use('/api', apiRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
