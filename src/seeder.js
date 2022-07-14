import config from 'config'
import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import ms from './time-to-milliseconds.js'


export default class Seeder {
    constructor() {
        this.store = null
        this.swarm = null
        this.db = null
        this.pendingFlush = null
        this.emptyLifespan = ms(config.get('store.emptyLifespan'))
        this.fullLifespan = ms(config.get('store.fullLifespan'))
    }

    /**
     * Call to connect everything up and start seeding cores in the DB
     */
    async start() {
        // set up the store
        this.store = new Corestore(config.get('store.path'))
        await this.store.ready()

        // start a swarm
        this.swarm = new Hyperswarm()
        this.swarm.on('connection', (conn) => this.store.replicate(conn))

        // set up the key value DB
        const feed = this.store.get({ name: config.get('store.dbName') })
        this.db = new Hyperbee(feed, {
            keyEncoding: 'binary',
            valueEncoding: 'utf-8'
        })
        await this.db.ready()

        // monitor historical requests
        this._seedExistingItems()
    }

    /**
     * Call to add a new hypercore to the DB and start seeding it
     * @param {*} key - the public key of the hypercore (Buffer)
     */
    async registerItem(key) {
        const keyStr = this._fmtKey(key)
        console.log(`Registering item with key ${keyStr}`)
        if (!this.store || !this.swarm) {
            throw new Error('Must call start() before registering items')
        }

        if (await this._alreadyExists(key)) {
            console.log(`${keyStr} has already been registered. ignoring`)
            return;
        }

        await this._beginSeeding(key)
    }

    /**
     * Find all the items in the DB and start seeding them again
     */
    async _seedExistingItems() {
        const stream = this.db.createReadStream()
        stream.on('data', async (data) => await this._beginSeeding(data.key))
    }

    /**
     * Starts seeding a specific hypercore with the given public key
     * @param {*} key public key of the hypercore to seed
     */
    async _beginSeeding(key) {
        // create a core in the store from a known key
        const keyStr = this._fmtKey(key)
        console.log(`Begin seeding ${keyStr}`)

        const core = this.store.get({ key })
        await core.ready()

        // register the item in the DB so we can load it again next time
        await this._putValue(key, core.length)

        // join the core's topic
        this.swarm.join(core.discoveryKey)

        // Ask the core for a callback we can use to tell it when the flush completes
        // (We need this so the core can stop checking at this point)
        const onComplete = core.findingPeers();

        // In the background, start flushing the swarm
        // we take care to ensure that we only track one active flush operation
        // mostly to help with startup
        this._flushIfNeeded(onComplete)

        // While that is happening, try and update the core,
        // so we know how much data it should contain
        await core.update();
        console.log(`Tracking core ${keyStr}. Length: ${core.length}`)

        // Do we care about this item any more?
        if (await this._emptyAndOld(key, core.discoveryKey, core.length)) {
            console.log(`${keyStr} is still empty for more than ${this.emptyLifespan}ms. removed.`)
            this._dropItem(key, core.discoveryKey)

            return
        }

        // items that have not been updated for a long long time can also be dropped
        if (await this._hasBeenAbandoned(key, core.discoveryKey)) {
            console.log(`${keyStr} is not been updated for over ${this.fullLifespan}ms. removed.`)
            this._dropItem(key, core.discoveryKey)
            return
        }

        // Now we can download the whole thing
        core.download({ start: 0, end: -1 });
        core.on('download', async (index) => {
            console.log(`${keyStr} downloaded block ${index}`);
            await this._putValue(key, core.length)
        });
    }

    /**
     * Start the hyperswarm flush process to ensure everything is fully announced on the DHT
     * Takes care to only be doing this once at a time
     * When the flush completes, the callback will be triggered (used to stop the cores trying to update)
     * @param {*} cb
     */
    async _flushIfNeeded(cb) {
        if (this.pendingFlush !== null) {
            this.pendingFlush.then(cb, cb)
        } else {
            const cleanup = () => this.pendingFlush = null
            this.pendingFlush = this.swarm.flush()
                .then(cleanup, cleanup)
                .then(cb, cb)
        }
    }

    /**
     * Determine if the given key is one we already track
     * @param {*} key
     * @returns true if we are tracking it. false if not
     */
    async _alreadyExists(key) {
        const item = await this._getValue(key)

        return item !== null
    }

    /**
     * Tries to decide if the hypercore with the given key has been abandoned
     * This is the case if it has been > `fullLifespan` ms since the last update to the core
     * @param {*} key
     * @returns true if it has been abandoned, false if not
     */
    async _hasBeenAbandoned(key) {
        // Do we care about this item any more?
        // It's empty - see if we have been watching it for a while
        const item = await this._getValue(key)
        if (item === null) {
            return false
        }

        const now = Date.now()
        if ((now - item.lastUpdated) < this.fullLifespan) {
            return false
        }

        // Drop this item then
        return true
    }

    /**
     * Is the hypercore still empty and older than some threshold
     * If we are given an empty hypercore that is never updated, we want to discard it eventually
     * @param {*} key
     * @param {*} length
     * @returns true if the hypercore is still empty and has been for a while, false if not
     */
    async _emptyAndOld(key, length) {
        if (length > 0) {
            return false
        }

        // Do we care about this item any more?
        // It's empty - see if we have been watching it for a while
        const item = await this._getValue(key)
        if (item === null) {
            return false
        }

        const now = Date.now()
        if ((now - item.lastUpdated) < this.emptyLifespan) {
            return false
        }

        // Yes, it is empty and old. Remove it from the DB
        return true
    }

    /**
     * Stops tracking a hypercore and removes it from the DB
     * @param {*} key
     * @param {*} discoveryKey
     */
    async _dropItem(key, discoveryKey) {
        console.log(`Removing ${this._fmtKey(key)} from tracking`)
        await this.db.del(key)
        await this.swarm.leave(discoveryKey)
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
    async _putValue(key, length) {
        const cas = (prev, next) => {
            const p = { length: 0, ...JSON.parse(prev.value) }
            const n = { length: 0, ...JSON.parse(next.value) }
            return (p.length < n.length)
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
