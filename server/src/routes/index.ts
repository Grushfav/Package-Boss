import { Router } from 'express'
import { adminRouter } from './admin.js'
import { announcementsRouter } from './announcements.js'
import { authRouter } from './auth.js'
import { bankTransferProofsRouter } from './bankTransferProofs.js'
import { deliveryRequestsRouter } from './deliveryRequests.js'
import { healthRouter } from './health.js'
import { logisticsJobsRouter } from './logisticsJobs.js'
import { meRouter } from './me.js'
import { packagesRouter } from './packages.js'
import { parishesRouter } from './parishes.js'
import { preAlertsRouter } from './preAlerts.js'
import { ratesRouter } from './rates.js'
import { staffRouter } from './staff.js'
import { uploadsRouter } from './uploads.js'

export const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use(authRouter)
apiRouter.use(meRouter)
apiRouter.use(parishesRouter)
apiRouter.use(ratesRouter)
apiRouter.use(packagesRouter)
apiRouter.use(preAlertsRouter)
apiRouter.use(deliveryRequestsRouter)
apiRouter.use(logisticsJobsRouter)
apiRouter.use(bankTransferProofsRouter)
apiRouter.use(announcementsRouter)
apiRouter.use(uploadsRouter)
apiRouter.use(staffRouter)
apiRouter.use(adminRouter)
