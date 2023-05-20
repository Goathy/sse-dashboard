import assert from 'node:assert'
import { it } from 'node:test'
import undici from 'undici'
import { buildServer } from './server.mjs'
import { setTimeout } from 'node:timers/promises'
import { setImmediate } from 'node:timers'
import { EventEmitter } from 'node:events'

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

it('stream multiple values over time reusing response', async (t) => {
  const fastify = buildServer()

  t.after(async () => {
    await fastify.close()
  })

  await fastify.register(import('./responses.plugin.mjs'))

  fastify.get('/sse', (_, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    })

    fastify.responses.set('1', reply.raw)
  })

  fastify.get('/send', async (_, reply) => {
    for (const idx of [1, 2, 3]) {
      await setTimeout(0)
      fastify.responses.get('1').write(`value: ${idx}\n`)
    }

    fastify.responses.get('1').end()

    reply.send()
  })

  await fastify.listen()

  setImmediate(async () => await undici.request('http://localhost:' + fastify.server.address().port + '/send', { method: 'GET' }))

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/sse', { method: 'GET' })

  const responseBody = []

  for await (const data of body) {
    responseBody.push(String(data))
  }

  assert.deepEqual(responseBody, ['value: 1\n', 'value: 2\n', 'value: 3\n'])
})

it('closed response should remove reference in responses map', async (t) => {
  const fastify = buildServer()

  t.after(async () => {
    await fastify.close()
  })

  await fastify.register(import('./responses.plugin.mjs'))

  let isClosed = false

  fastify.get('/sse', (_, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    })

    fastify.responses.set('1', reply.raw)

    reply.raw.on('close', () => {
      fastify.responses.delete('1')
      isClosed = true
    })
  })

  fastify.get('/send', async (_, reply) => {
    for (const idx of [1, 2, 3]) {
      await setTimeout(0)
      fastify.responses.get('1').write(`value: ${idx}\n`)
    }

    fastify.responses.get('1').end()

    reply.send()
  })

  await fastify.listen()

  setImmediate(async () => await undici.request('http://localhost:' + fastify.server.address().port + '/send', { method: 'GET' }))

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/sse', { method: 'GET' })

  const responseBody = []

  for await (const data of body) {
    responseBody.push(String(data))
  }

  assert.deepEqual(responseBody, ['value: 1\n', 'value: 2\n', 'value: 3\n'])
  assert.equal(fastify.responses.size, 0, 'response should be deleted after close')
  assert.ok(isClosed, 'response should be closed')
}
)

it('close connection using Map reference', async (t) => {
  const fastify = buildServer()

  const requestId = 'requestId-1'

  let calls = 0

  const ee = new EventEmitter()

  t.after(async () => {
    await fastify.close()
    ee.removeAllListeners()
  })

  await fastify.register(import('./responses.plugin.mjs'))

  fastify.get('/sse', (_, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    })

    fastify.responses.set(requestId, reply.raw)

    ee.emit('called')

    reply.raw.on('close', () => { fastify.responses.delete(requestId); calls++ })
  })

  await fastify.listen()

  ee.once('called', () => { fastify.responses.get(requestId).end() })

  const { body } = await undici.request('http://localhost:' + fastify.server.address().port + '/sse', { method: 'GET' })

  body.on('close', () => assert.equal(calls, 1, 'connection should be closed'))
}
)
