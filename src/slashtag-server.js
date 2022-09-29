import config from 'config'
import { SDK } from '@synonymdev/slashtags-sdk'
import logger from './logger.js'
import SeedingProtocol from './seeding-protocol.js'

export default class SlashServer {
    constructor(seeder) {
        this.seedingProtocol = null
        this.seeder = seeder
    }

    async start() {
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
        const st = sdk.slashtag('Seeding Server Slashtag');
        logger.info(`Seeding Server Slashtag - ${st.url}`)

        // Get the seeding protocol to add our hooks
        this.seedingProtocol = new SeedingProtocol(st)

        /**
         * Handle any incoming requests for a list of recent backups
         */
        this.seedingProtocol.on('seedAdd', async (req) => {
            try {
                await this.seeder.registerHypercore(req.key)
            } catch (err) {
                // log it
                logger.error(`seedAdd failed`)
                logger.error(err)
            }
        })

        this.seedingProtocol.on('seedRemove', async (req) => {
            try {
                // disable for now - wait for auth
                // await this.seeder.removeHypercore(req.key)
            } catch (err) {
                // log it
                logger.error(`seedRemove failed`)
                logger.error(err)
            }
        })

        // listen
        await st.listen()
        logger.info('Slashtag server listening')
    }
}