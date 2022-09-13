import config from 'config'
import { SDK } from '@synonymdev/slashtags-sdk'
import logger from './logger.js'
import SeedingProtocol from './seeding-protocol.js'
import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'

// The server will report this when it starts. update this to match your local test server
const serverSlashtag = 'slash:qybsuau56f3a6i7w3yo54aq66mcia9ix8uixba3fcdiq7hib5dmo'

// the sore...
const store = new Corestore(config.get('testClient.path'))
await store.ready()

// Get a core from the store and append to it
const core = store.get({ name: config.get('testClient.coreName') })
await core.ready()

await core.append(['hello', 'world'])

// Keep appending data
setInterval(() => { core.append(['hello', 'delayed']); console.log('extra') }, 5000)

// note some info on the core...
console.log("DiscoveryKey", core.discoveryKey.toString('hex'))
console.log("PublicKey", core.key.toString('hex'))

// Create a hyperswarm and advertise the core to any interested peers
const swarm = new Hyperswarm()
swarm.on('connection', (conn, peerInfo) => {
    console.log('Seen connection from peer')
    store.replicate(conn)
})

swarm.join(core.discoveryKey)


// Pick a primary key, so all our slashtags are the same each time
const keyStr = config.get('slashtags.primaryKey')
if (keyStr.length !== 64) {
    throw new Error('slashtags.primaryKey should be defined in the config (expecting 64 character hex string)')
}

// as a buffer
const primaryKey = Buffer.from(keyStr, 'hex')

// setup the SDK
const options = {
    persist: false,
    primaryKey
}

// start the slashtags SDK
const sdk = new SDK(options)
await sdk.ready()

// Generate the servers slashtag (as we use a common name and primary key, this should be the same each time)
const st = sdk.slashtag('Seeding Server Slashtag Test Client');
logger.info(`Seeding Client Slashtag - ${st.url}`)

// Get the seeding protocol to add our hooks
try {
    const seeding = new SeedingProtocol(st)
    const response = await seeding.seedAdd(serverSlashtag, core.key.toString('hex'))
    logger.info(response)
} catch (err) {
    logger.error(err)
}

