'use strict'

import assert from 'node:assert'
import { it } from 'node:test'
import { buildServer } from './server.mjs'

it('server should be decorated with responses Map', async () => {
  const fastify = buildServer()

  await fastify.register(import('./responses.plugin.mjs'))

  assert.ok(fastify.responses instanceof Map, 'responses should be instance of a Map')
})
