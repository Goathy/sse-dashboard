import assert from 'node:assert'
import { it } from 'node:test'
import undici from 'undici'
import { buildServer } from './server.mjs'
import { setTimeout } from 'node:timers/promises'

it('should pass', async (t) => {
  const fastify = buildServer()
  t.after(async () => {
    await fastify.close()
  })

  await fastify.listen()

  console.log('debug: ', fastify.server.address())
})

it('access response usinig undici', async (t) => {
  const fastify = buildServer()

  t.after(async () => {
    await fastify.close()
  })

  fastify.get('/sse', (_, reply) => {
    reply.send({ Hello: 'World' })
  })

  await fastify.listen()

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/sse', { method: 'GET' })

  let calls = 0
  let responseBody = ''

  for await (const data of body) {
    responseBody = String(data)
    calls++
  }

  assert.equal(calls, 1, 'body should return only one value')
  assert.equal(responseBody, '{"Hello":"World"}')
})

it('check response using raw response', async (t) => {
  const fastify = buildServer()

  t.after(async () => {
    await fastify.close()
  })

  fastify.get('/sse', (_, reply) => {
    const response = '{"Hello":"World"}'
    reply.raw.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': response.length
    })
    reply.raw.write(response)
    reply.raw.end()
  })

  await fastify.listen()

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/sse', { method: 'GET' })

  let calls = 0
  let responseBody = ''

  for await (const data of body) {
    responseBody = String(data)
    calls++
  }

  assert.equal(calls, 1, 'body should return only one value')
  assert.equal(responseBody, '{"Hello":"World"}')
})

it('stream multiple values over time', async (t) => {
  const fastify = buildServer()

  t.after(async () => {
    await fastify.close()
  })

  fastify.get('/sse', async (_, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    })

    for (const idx of [1, 2, 3]) {
      await setTimeout(0)
      reply.raw.write(`value: ${idx}\n`)
    }

    reply.raw.end()
  })

  await fastify.listen()

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/sse', { method: 'GET' })

  const responseBody = []

  for await (const data of body) {
    responseBody.push(String(data))
  }

  assert.deepEqual(responseBody, ['value: 1\n', 'value: 2\n', 'value: 3\n'])
})
