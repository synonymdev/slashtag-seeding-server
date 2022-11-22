import config from 'config'
import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import ms from './time-to-milliseconds.js'
import logger from './logger.js'


export default class Seeder {
    constructor() {
        this.store = null
        this.swarm = null
        this.db = null
        this.pendingFlush = null
        this.emptyLifespan = ms(config.get('store.emptyLifespan'))
        this.fullLifespan = ms(config.get('store.fullLifespan'))

        // Some stats
        this.startupTime = Date.now()
        this.requests = 0
        this.itemsSeeded = 0
        this.connectionsDetected = 0
    }

    /**
     * Call to connect everything up and start seeding cores in the DB
     */
    async start() {
        // set up the store
        this.store = new Corestore(config.get('store.path'))
        await this.store.ready()

        // Do we have a seed defined for the hyperswarm
        const opts = {}
        const seed = config.get('hyperswarm.seed')
        if (typeof seed === 'string' && seed.length === 64) {
            opts.seed = Buffer.from(seed, 'hex')
        }

        // start a swarm
        this.swarm = new Hyperswarm(opts)
        this.swarm.on('connection', (connection, peerInfo) => {
            // track peer connections so we can disconnect later
            logger.info(`Connection from peer detected: ${peerInfo.publicKey.toString('hex')}`)
            this.connectionsDetected += 1

            // replace any cores we have in common
            const stream = this.store.replicate(connection)
            stream.on('error', (err) => logger.error(err))
        })

        // Determine the master topic to join
        const topicKey = config.get('hyperswarm.topicKey')
        if (typeof topicKey !== 'string' || topicKey.length !== 64) {
            throw new Error('Must set the topic that the hyperswarm will listen on. See hyperswarm.topicKey in config')
        }

        // Join the swarms master topic
        const topic = Buffer.from(topicKey, 'hex')
        this.swarm.join(topic, { server: true, client: false }).flushed().then(()=>{
            logger.info(`Hyperswarm listening on main topic: ${topicKey}`)
        })

        // set up the key value DB
        const feed = this.store.get({ name: config.get('store.dbName') })
        this.db = new Hyperbee(feed, {
            keyEncoding: 'binary',
            valueEncoding: 'utf-8'
        })
        await this.db.ready()

        // monitor historical requests
        this._seedExistingItems()

        // log the status of things from time to time 
        // (every few minutes, plus once shortly after starting)
        setInterval(() => this.logStatus(), 1000 * 60 * 15)
        setTimeout(() => this.logStatus(), 1000 * 60 * 2)
    }

    /**
     * Report on the number of seeding topics are in use
     */
    logStatus() {
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
    async registerHypercore(key) {
        this.requests += 1
        const keyStr = this._fmtKey(key)
        logger.info(`Registering hypercore with key ${keyStr}`)
        if (!this.store || !this.swarm) {
            throw new Error('Must call start() before registering items')
        }

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
    async getHypercoreStatus(key) {
        return this._getValue(key)
    }

    /**
     * Stop tracking a hypercore
     * @param {*} key 
     * @returns 
     */
    async removeHypercore(key) {
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
    _seedExistingItems() {
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
    async _beginSeeding(key) {
        // count the attempt
        this.itemsSeeded += 1

        // create a core in the store from a known key
        const keyStr = this._fmtKey(key)
        const core = this.store.get({ key })
        await core.ready()

        // register the item in the DB so we can load it again next time
        await this._putValue(key, core.length)

        // join the core's topic (Deprecated - remove this when Bitkit is updated)
        this.swarm.join(core.discoveryKey, { server: true, client: false }).flushed().then(()=>{
            this.itemsAnnounced += 1
            logger.info(`${keyStr}: announced (flushed). total ${this.itemsAnnounced}`)
        })
        logger.debug(`${keyStr}: joined hyperswarm. current length: ${core.length}`)

        // Now we can download the whole thing
        core.download({ start: 0, end: -1 });
        core.on('download', async (index) => {
            await this._putValue(key, core.length)
            logger.debug(`${keyStr} Len: ${core.length} block: ${index}`);
        });

    }

    /**
     * Stops tracking a hypercore and removes it from the DB
     * @param {*} key
     * @param {*} discoveryKey
     */
    async _dropItem(key, discoveryKey) {
        logger.debug(`Removing ${this._fmtKey(key)} from tracking`)
        await this.swarm.leave(discoveryKey)
        await this.db.del(key)
    }

    /**
     * Fetch and decode a key from the DB
     * @param {*} key
     * @returns the stored object, or null
     */
    async _getValue(key) {
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
    async _putValue(key, length, updateWhenSameLength = false) {
        const cas = (prev, next) => {
            const p = { length: 0, ...JSON.parse(prev.value) }
            const n = { length: 0, ...JSON.parse(next.value) }
            return updateWhenSameLength ? (n.length >= p.length) : (n.length > p.length)
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
    _fmtKey(key) {
        return key.toString('hex').slice(0, 8) + '...'
    }
}
