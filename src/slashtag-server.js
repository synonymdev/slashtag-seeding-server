const logger = require('./logger.js')
const SeederRPC = require('./seeding-protocol.js')
const Seeder = require('./seeder.js')

/**
 * Transport over HyperDHT connections as an alternative to the HTTP server.
 */
class SlashServer {
  /**
     * @param {object} [opts]
     * @param {Seeder} [opts.seeder]
     * @param {Array<{host: string, port: number}>} [opts.bootstrap] bootstrapping nodes for HyperDHT
     * @param {any} [opts.storage] storage directory for corestore
     * @param {Uint8Array} [opts.seed] seed for generating the Hyperswarm DHT keyPair
     * @param {Uint8Array} [opts.topic] seed for generating the Hyperswarm DHT keyPair
     * @param {string} [opts.dbName] name of the Hyperbee DB
     */
  constructor (opts = {}) {
    this.seeder = opts.seeder || new Seeder(opts)

    this.rpc = new SeederRPC({ swarm: this.seeder.swarm })
    this.seeder.swarm.server.on('connection', (stream) => this.rpc.setup(stream))

    this.key = this.seeder.swarm.keyPair.publicKey

    logger.info(`Seeding Server listening on publicKey: ${this.key.toString('hex')}`)

    /**
         * Handle any incoming requests for a list of recent backups
         */
    this.rpc.on('seedAdd', async (req) => {
      try {
        await this.seeder.registerHypercore(req.key)
      } catch (err) {
        // log it
        logger.error('seedAdd failed')
        logger.error(err)
      }
    })
  }

  /**
     * Await for the DHT server to start listening on the server's publicKey.
     * @returns {Promise<void>}
     */
  async ready () {
    return this.seeder.ready()
  }

  /**
     * Close the server, its seeder instance and destroy the DHT instance.
     * @returns {Promise<void>}
     */
  close () {
    return this.seeder.close()
  }
}

module.exports = SlashServer
