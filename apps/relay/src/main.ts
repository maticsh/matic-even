// The relay's entry point: read the settings from the environment and listen.
// Run it with node directly (node src/main.ts), not npm start, so the host's stop signal reaches this process.
import { readConfig } from './config.ts'
import { createRelay } from './server.ts'

const config = readConfig(process.env)
const server = createRelay(config)

server.listen(config.port, config.host, () => {
  const allow = config.allow.length ? config.allow.join(', ') : 'nothing (set RELAY_ALLOW)'
  console.log(`[relay] listening on ${config.host ?? '*'}:${config.port}. Upstreams allowed: ${allow}. Key: ${config.key ? 'on' : 'off'}.`)
})

// A host stops a deploy with SIGTERM. Finish the requests in flight, then exit 0.
function stop() {
  server.close(() => process.exit(0))
  server.closeIdleConnections()
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
