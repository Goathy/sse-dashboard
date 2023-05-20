import fastify from 'fastify'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { setInterval } from 'node:timers'

export function buildServer () {
  return fastify()
}

const server = buildServer()

await server.register(import('@fastify/static'), {
  root: join(cwd(), 'static'),
  prefix: '/'
})

function random (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

server.get('/sse', async (_, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache'
  })

  setInterval(() => {
    const dataset = [['0..10', random(0, 10)], ['0..5', random(0, 5)], ['0..16', random(0, 16)], ['4..7', random(4, 7)], ['5..20', random(5, 20)], ['8..16', random(8, 16)]]

    reply.raw.write(`data: ${JSON.stringify(dataset)}\n\n`)
  }, 250)
})

await server.listen({ port: 3000 })
