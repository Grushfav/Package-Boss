import { Router } from 'express'
import { JAMAICA_PARISHES } from '../constants.js'

export const parishesRouter = Router()

parishesRouter.get('/parishes', (_req, res) => {
  res.json({ parishes: JAMAICA_PARISHES })
})
