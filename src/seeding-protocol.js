import c from 'compact-encoding'
import SlashtagsRPC from '@synonymdev/slashtags-rpc';
import logger from './logger.js'


export default class SeedingProtocol extends SlashtagsRPC {
    constructor(slashtag) {
        super(slashtag)
    }

    get id() {
        return 'SeedingProtocol';
    }

    get valueEncoding() {
        return c.string;
    }

    get methods() {
        const self = this;
        return [
            {
                name: 'seedAdd',
                handler: (req) => this.onAddSeed(req),
            },
            {
                name: 'seedRemove',
                handler: (req) => this.onRemoveSeed(req),
            },
        ];
    }

    onAddSeed(req) {
        logger.info(req)
        this.emit('seedAdd', { key: Buffer.from(req, 'hex') })
        return 'ok'
    }

    onRemoveSeed(req) {
        logger.info(req)
        this.emit('seedRemove', { key: Buffer.from(req, 'hex') })
        return 'ok'
    }

    /**
     * Send a request to start seeding to the seeding servers slashtag
     * @param {*} seedingServerSlashtag - 'slash:...' string
     * @param {*} hypercorePubKey - hex string
     * @returns 
     */
    async seedAdd(seedingServerSlashtag, hypercorePubKey) {
        const rpc = await this.rpc(seedingServerSlashtag);
        return rpc?.request('seedAdd', hypercorePubKey);
    }

    /**
     * Send a request to start seeding to the seeding servers slashtag
     * @param {*} seedingServerSlashtag - 'slash:...' string
     * @param {*} hypercorePubKey - hex string
     * @returns 
     */
    async seedRemove(seedingServerSlashtag, hypercorePubKey) {
        const rpc = await this.rpc(seedingServerSlashtag);
        return rpc?.request('seedRemove', hypercorePubKey);
    }
}
