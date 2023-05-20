// https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#fields
import { it } from 'node:test'
import { buildServer } from './server.mjs'
import undici from 'undici'
import { setTimeout } from 'timers/promises'
import assert from 'node:assert'

it('consume stream in EventSource format', async (t) => {
  const fastify = buildServer()

  t.after(async () => {
    await fastify.close()
  })

  fastify.get('/test', async (_, reply) => {
    console.log('kaczka')
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    })

    for (const idx of [1, 2, 3, 4, 5]) {
      await setTimeout(0)
      reply.raw.write(`data: ${idx}\n\n`)
    }

    reply.raw.end()
  })

  await fastify.listen()

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/test', { method: 'GET' })

  const responseBody = []

  for await (const data of body) {
    responseBody.push(String(data))
  }

  assert.deepEqual(responseBody, ['data: 1\n\n', 'data: 2\n\n', 'data: 3\n\n', 'data: 4\n\n', 'data: 5\n\n'])
})
