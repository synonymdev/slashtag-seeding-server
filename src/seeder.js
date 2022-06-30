import config from 'config'
import Hyperswarm from 'hyperswarm'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'



export default class Seeder {
    constructor() {
        this.store = null
        this.swarm = null
        this.db = null
    }

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
        this.seedExistingItems()
    }

    async seedExistingItems() {
        const stream = this.db.createReadStream()
        stream.on('data', async (data) => await this.registerItem(data.key))
    }

    async registerItem(key) {
        console.log(`Registering item with key ${key.toString('hex')}`)
        if (!this.store || !this.swarm) {
            throw new Error('Must call start() before registering items')
        }

        // create a core in the store from a known key
        const core = this.store.get({ key })
        await core.ready()

        // join the core's topic
        this.swarm.join(core.discoveryKey)

        // Ask the core for a callback we can use to tell it when the flush completes
        // (We need this so the core can stop checking at this point)
        const flushComplete = core.findingPeers();

        // In the background, start flushing the swarm
        this.swarm.flush().then(flushComplete, flushComplete)

        // While that is happening, try and update the core,
        // so we know how much data it should contain
        await core.update();

        // Now we can download the whole thing
        core.download();
        core.on('download', function (index) {
            console.log('downloaded block', index, 'from');
        });

        // register the item in the DB so we can load it again next time
        await this.db.put(key, 'hypercore')
    }
}
