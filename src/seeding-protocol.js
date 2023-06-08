const c = require('compact-encoding')
const SlashtagsRPC = require('@synonymdev/slashtags-rpc')
const logger = require('./logger.js')

const METHOD_OPTIONS = {
  SEED_ADD: {
    requestEncoding: c.buffer,
    responseEncoding: c.string
  }
}

class SeedingProtocol extends SlashtagsRPC {
  get id () {
    return 'SeedingProtocol'
  }

  get methods () {
    const self = this
    return [
      {
        name: 'seedAdd',
        options: METHOD_OPTIONS.SEED_ADD,
        handler: self.onAddSeed.bind(self)
      },
      {
        name: 'seedRemove',
        handler: self.onRemoveSeed.bind(self)
      }
    ]
  }

  onAddSeed (req) {
    logger.info('seedAdd key: ' + req.toString('hex'))
    this.emit('seedAdd', { key: req })
    return 'ok'
  }

  onRemoveSeed (req) {
    logger.info(req)
    this.emit('seedRemove', { key: Buffer.from(req, 'hex') })
    return 'ok'
  }

  /**
     * Send a request to start seeding to the seeding servers slashtag
     * @param {*} seedingServerSlashtag - 'slash:...' string
     * @param {*} hypercorePubKey - hex string
     * @returns {Promise<string>}
     */
  async seedAdd (seedingServerSlashtag, hypercorePubKey) {
    const rpc = await this.rpc(seedingServerSlashtag)
    return rpc?.request('seedAdd', hypercorePubKey, METHOD_OPTIONS.SEED_ADD)
  }

  /**
     * Send a request to start seeding to the seeding servers slashtag
     * @param {*} seedingServerSlashtag - 'slash:...' string
     * @param {*} hypercorePubKey - hex string
     * @returns
     */
  async seedRemove (seedingServerSlashtag, hypercorePubKey) {
    const rpc = await this.rpc(seedingServerSlashtag)
    return rpc?.request('seedRemove', hypercorePubKey)
  }
}

module.exports = SeedingProtocol
