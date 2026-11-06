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
  // Meta data-deletion callbacks POST application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: false }))

  app.use('/api', apiRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: 'We couldn’t find that.' })
  })

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    if (res.headersSent) return
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : typeof err === 'object' &&
            err !== null &&
            'statusCode' in err &&
            typeof (err as { statusCode?: unknown }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500
    if (status === 404) {
      return res.status(404).json({ error: 'We couldn’t find that.' })
    }
    if (status === 429) {
      return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.' })
    }
    if (status >= 400 && status < 500) {
      const message =
        err instanceof Error && err.message && err.message.length <= 280
          ? err.message
          : 'Please check your details and try again.'
      return res.status(status).json({ error: message })
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  })

  return app
}
