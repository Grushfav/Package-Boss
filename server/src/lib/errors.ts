import type { Response } from 'express'

export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function sendError(res: Response, message: string, status = 400) {
  return res.status(status).json({ error: message })
}

export function handleRouteError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.status)
  }
  if (err instanceof Error) {
    return sendError(res, err.message, 400)
  }
  return sendError(res, 'Something went wrong', 500)
}
