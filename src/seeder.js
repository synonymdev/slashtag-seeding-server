const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Hyperbee = require('hyperbee')
const logger = require('./logger.js')
const RAM = require('random-access-memory')

const DEFAULT_DB_NAME = 'Hyperbee DB'
const DEFAULT_SEEDERS_TOPIC = Buffer.from('3b9f8ccd062ca9fc0b7dd407b4cd287ca6e2d8b32f046d7958fa7bea4d78fd75', 'hex')

class Seeder {
  /**
     * @param {object} [opts]
     * @param {Array<{host: string, port: number}>} [opts.bootstrap]
     * @param {string} [opts.storage] corestore storage directory
     * @param {Uint8Array} [opts.seed] seed for generating the Hyperswarm DHT keyPair
     * @param {Uint8Array} [opts.topic] Hyperswarm topic to announce this seeder on to be discovered by peers
     * @param {string} [opts.dbName] name of the Hyperbee DB
     */
  constructor (opts = {}) {
    // Setup Corestore
    this.store = new Corestore(opts.storage || RAM, { _autoReplicate: false })

    // Setup Hyperswarm
    this.swarm = new Hyperswarm(opts)
    this.swarm.listen()

    this.swarm.on('connection', (connection, peerInfo) => {
      // track peer connections so we can disconnect later
      logger.info(`Connection from peer detected: ${peerInfo.publicKey.toString('hex')}`)
      this.connectionsDetected += 1

      // replace any cores we have in common
      this.store.replicate(connection)
        .on('error', (err) => logger.error(err))
    })

    this.topic = opts.topic || DEFAULT_SEEDERS_TOPIC

    // set up the key value DB
    const feed = this.store.get({ name: opts.dbName || DEFAULT_DB_NAME })
    this.db = new Hyperbee(feed, {
      keyEncoding: 'binary',
      valueEncoding: 'utf-8'
    })

    // Some stats
    this.startupTime = Date.now()
    this.requests = 0
    this.itemsSeeded = 0
    this.connectionsDetected = 0

    // monitor historical requests
    this._seedExistingItems()

    // log the status of things from time to time
    // (every few minutes, plus once shortly after starting)
    this.interval = setInterval(() => this.logStatus(), 1000 * 60 * 15)
    this.timeout = setTimeout(() => this.logStatus(), 1000 * 60 * 2)

    this._opening = this._open()
  }

  /**
     * Await opening corestore and announcing the seeder on the seeder topic
     */
  ready () {
    return this._opening
  }

  async _open () {
    // Join the swarms master topic
    await this.swarm.join(this.topic, { server: true, client: false }).flushed()
    logger.info(`Hyperswarm joined on main topic: ${this.topic.toString('hex')}`)

    await this.db.ready?.()
    await this.swarm.flush()
  }

  /**
     * Close all resources
     */
  async close () {
    await this.ready()
    await this.store.close()
    await this.swarm.destroy()
    clearInterval(this.interval)
    clearTimeout(this.timeout)
  }

  /**
     * Report on the number of seeding topics are in use
     */
  logStatus () {
    logger.info(`Uptime: ${Math.ceil((Date.now() - this.startupTime) / 1000 / 60)} minutes`)
    logger.info(`Current Peers: ${this.swarm.peers.size}`)
    logger.info(`Connections opened with peers: ${this.connectionsDetected}`)
    logger.info(`Requests to start seeding: ${this.requests}`)
    logger.info(`Items being seeded: ${this.itemsSeeded}`)
  }

  /**
     * Call to add a new hypercore to the DB and start seeding it
     * @param {*} key - the public key of the hypercore (Buffer)
     */
  async registerHypercore (key) {
    this.requests += 1
    const keyStr = this._fmtKey(key)
    logger.info(`Registering hypercore with key ${keyStr}`)

    // See if we are already tracking this hypercore
    const item = await this._getValue(key)
    if (item !== null) {
      logger.info(`${keyStr} has already been registered. Update last seen time.`)
      this._putValue(key, item.length, true)
      return
    }

    await this._beginSeeding(key)
  }

  /**
     * Find the state of the hypercore with the given key
     * @param {*} key
     * @returns
     */
  async getHypercoreStatus (key) {
    const session = this.store.get(key)
    const info = await session.info()
    session.close()

    const status = await this._getValue(key)
    if (!status) return null

    return {
      ...info,
      lastUpdated: status.lastUpdated
    }
  }

  /**
     * Stop tracking a hypercore
     * @param {*} key
     * @returns
     */
  async removeHypercore (key) {
    const keyStr = this._fmtKey(key)
    logger.info(`Stop tracking ${keyStr}`)

    const item = await this._getValue(key)
    if (item === null) {
      // was not being tracked anyway, so we're done
      logger.info(`Was not tracking ${keyStr}, so ignore deletion request`)
      return
    }

    // Find the core so we can stop listening on its topic
    const core = this.store.get({ key })
    await core.ready()

    // try and end any active connection with a peer for this hypercore
    this.swarm.leave(core.discoveryKey)

    // close the core
    await core.close()

    await this._dropItem(key, core.discoveryKey)
    logger.info(`Dropped ${keyStr}`)
  }

  /**
     * Find all the items in the DB and start seeding them again
     */
  _seedExistingItems () {
    const keys = []
    const stream = this.db.createReadStream()
    stream.on('data', (data) => keys.push(data.key))
    stream.on('end', async () => {
      // add them one at a time so we don't overload everything
      logger.info(`Starting to seed ${keys.length} existing hypercores`)
      for (let i = 0; i < keys.length; i += 1) {
        await this._beginSeeding(keys[i])
      }
    })
  }

  /**
     * Starts seeding a specific hypercore with the given public key
     * @param {*} key public key of the hypercore to seed
     */
  async _beginSeeding (key) {
    // count the attempt
    this.itemsSeeded += 1

    // create a core in the store from a known key
    const keyStr = this._fmtKey(key)
    const core = this.store.get({ key })
    await core.ready()

    // register the item in the DB so we can load it again next time
    await this._putValue(key, core.length)

    // join the core's topic (Deprecated - remove this when Bitkit is updated)
    logger.debug(`${keyStr}: Started seeding. current length: ${core.length}`)

    // Now we can download the whole thing
    core.download({ start: 0, end: -1 })
    core.on('download', async (index) => {
      await this._putValue(key, core.length)
      logger.debug(`${keyStr} Len: ${core.length} block: ${index}`)
    })
  }

  /**
     * Stops tracking a hypercore and removes it from the DB
     * @param {*} key
     * @param {*} discoveryKey
     */
  async _dropItem (key, discoveryKey) {
    logger.debug(`Removing ${this._fmtKey(key)} from tracking`)
    await this.swarm.leave(discoveryKey)
    await this.db.del(key)
  }

  /**
     * Fetch and decode a key from the DB
     * @param {*} key
     * @returns the stored object, or null
     */
  async _getValue (key) {
    try {
      const item = await this.db.get(key)
      if (item === null) {
        return null
      }

      return JSON.parse(item.value)
    } catch (err) {
      return null
    }
  }

  /**
     * Encode and store/update a key in the DB
     * We only update an existing entry if the length of the hypercore has grown
     * @param {*} key
     * @param {*} length
     * @returns
     */
  async _putValue (key, length, updateWhenSameLength = false) {
    const cas = (prev, next) => {
      const p = { length: 0, ...JSON.parse(prev.value) }
      const n = { length: 0, ...JSON.parse(next.value) }
      return updateWhenSameLength ? n.length >= p.length : n.length > p.length
    }

    const value = {
      type: 'hypercore',
      length,
      lastUpdated: Date.now()
    }

    return this.db.put(key, JSON.stringify(value), { cas })
  }

  /**
     * Format the key for display
     * @param {*} key
     * @returns short hex string of the key. eg '32f748b2...'
     */
  _fmtKey (key) {
    return key.toString('hex').slice(0, 8) + '...'
  }
}

module.exports = Seeder
