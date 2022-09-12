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

    get handshakeEncoding() {
        return c.string;
    }

    handshake(socket) {
        return this.id + '-handshake:for:' + socket.remotePublicKey.toString('hex');
    }

    onopen(handshake, socket) {
        this.emit('handshake', handshake, socket.reomtePublicKey);
    }

    get methods() {
        const self = this;
        return [
            {
                name: 'seedAdd',
                handler: (req) => logger.info(req),
            },
            {
                name: 'seedRemove',
                handler: (req) => logger.info(req),
            },
        ];
    }

    /**
     * Send a request to start seeding to the seeding servers slashtag
     * @param {*} seedingServerSlashtag
     * @param {*} hypercorePubKey 
     * @returns 
     */
    async seedAdd(seedingServerSlashtag, hypercorePubKey) {
        logger.info('sending seedAdd')
        const rpc = await this.rpc(seedingServerSlashtag);
        return rpc?.request('seedAdd', hypercorePubKey);
    }
}
