import { config } from './config.js'
import { createApp } from './app.js'
import { runStartupHooks } from './startup.js'

const app = createApp()

void runStartupHooks().then(() => {
  app.listen(config.port, () => {
    console.log(`Package Boss API listening on port ${config.port}`)
  })
})
