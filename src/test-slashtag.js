import config from 'config'
import { SDK } from '@synonymdev/slashtags-sdk'
import logger from './logger.js'
import SeedingProtocol from './seeding-protocol.js'


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
const seeding = new SeedingProtocol(st)
await seeding.seedAdd('slash:qybsuau56f3a6i7w3yo54aq66mcia9ix8uixba3fcdiq7hib5dmo', 'pubkey for hypercore')