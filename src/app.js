import config from 'config'
import Fastify from 'fastify'
import { EventEmitter } from 'events'

export default class App extends EventEmitter {
    constructor() {
        super()
        this.server = Fastify({ logger: config.get('http.logger') })
    }

    async start() {
        try {
            await this.defineRoutes()
            await this.server.listen({ port: config.get('http.port') })
        } catch (err) {
            this.server.log.error(err)
            process.exit(1)
        }
    }

    async defineRoutes() {
        this.server.route({
            method: 'POST',
            url: '/seeding/hypercore',
            schema: {
                body: {
                    type: 'object',
                    required: ['publicKey'],
                    properties: {
                        publicKey: { type: 'string' }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' }
                        }
                    }
                }
            },
            handler: async (request, reply) => {
                this.emit('keyDiscovered', { key: Buffer.from(request.body.publicKey, 'hex') })
                return { status: 'ok' }
            }
        })

        this.server.route({
            method: 'DELETE',
            url: '/seeding/hypercore/:key',
            schema: {
                params: {
                    type: 'object',
                    required: ['key'],
                    properties: {
                        key: {
                            type: 'string',
                            pattern: '^[a-fA-F0-9]{64}$'
                        }
                    }
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            status: { type: 'string' }
                        }
                    }
                }
            },
            handler: async (request, reply) => {
                this.emit('deleteKey', { key: Buffer.from(request.params.key, 'hex') })
                return { status: 'ok' }
            }
        })
    }
}
