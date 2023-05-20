import assert from 'node:assert'
import { it } from 'node:test'
import undici from 'undici'
import { buildServer } from './server.mjs'

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

  await fastify.register(import('./requests.plugin.mjs'))

  fastify.get('/test', (_, reply) => {
    reply.send({ Hello: 'World' })
  })

  await fastify.listen()

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/test', { method: 'GET' })

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

  await fastify.register(import('./requests.plugin.mjs'))

  fastify.get('/test', (_, reply) => {
    const response = '{"Hello":"World"}'
    reply.raw.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': response.length
    })
    reply.raw.write(response)
    reply.raw.end()
  })

  await fastify.listen()

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/test', { method: 'GET' })

  let calls = 0
  let responseBody = ''

  for await (const data of body) {
    responseBody = String(data)
    calls++
  }

  assert.equal(calls, 1, 'body should return only one value')
  assert.equal(responseBody, '{"Hello":"World"}')
})
