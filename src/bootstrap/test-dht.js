import DHT from '@hyperswarm/dht'
import Hyperswarm from 'hyperswarm'

const topic = Buffer.alloc(32).fill('testing dht')

// This one will use our local server as the bootstrap server
const dhtLocal = new DHT({ bootstrap: ['127.0.0.1:4000'] })

console.log('starting local')
const swarmLocal = new Hyperswarm({ dht: dhtLocal })
swarmLocal.on('connection', (conn, peerInfo) => {
    console.log('Local has a connection', peerInfo.publicKey.toString('hex'))
    conn.on('data', data => console.log('local got message:', data.toString()))
    conn.write('local sending a message....')
    conn.end()
})

swarmLocal.join(topic)
await swarmLocal.flush()

// This one will start normally, using the default set of bootstrap servers
console.log('starting normal')
const swarmNormal = new Hyperswarm()
swarmNormal.on('connection', (conn, peerInfo) => {
    console.log('normal has a connection', peerInfo.publicKey.toString('hex'))
    conn.on('data', data => console.log('normal got message:', data.toString()))
    conn.write('normal sending a message....')
    conn.end()
})
swarmNormal.join(topic)
await swarmNormal.flush()

// They will only discover each other and connect if the two DHTs end up part of the same set of peers
console.log('started...')
