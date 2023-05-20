'use strict'

import fp from 'fastify-plugin'

/**
 *
 * @param {import("fastify").FastifyInstance} fastify
 */
function plugin (fastify, _, done) {
  fastify.decorate('responses', new Map())
  done()
}

export default fp(plugin)
