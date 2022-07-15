import config from 'config'
import DHT from '@hyperswarm/dht'

const port = config.get('bootstrapper.port')
const node = new DHT({ port })

console.log(`Bootstrapping DHT node started on port ${port}`)
