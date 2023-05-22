const test = require('brittle')
const RAM = require('random-access-memory')
const Corestore = require('corestore')
const Hyperswarm = require('hyperswarm')
const createTestnet = require('@hyperswarm/testnet')
const { tmpdir } = require('os')

const Seeder = require('../src/seeder.js')

test('can replicate over a seeders topic', async (t) => {
  const testnet = await createTestnet(3, t.teardown)

  const storage = tmpdir() + '/' + Math.random().toString(16).slice(2)

  let seeder = new Seeder({ bootstrap: testnet.bootstrap, storage })
  await seeder.ready()

  // Mock hypercore
  const core = seeder.store.get({ name: 'foo' })
  await core.append(['foo', 'bar'])
  await core.close()

  // Close everything and reopen to prove peristence
  await seeder.close()
  seeder = new Seeder({ bootstrap: testnet.bootstrap, storage })
  await seeder.ready()

  // Open 10 unrequested hypercores that shouldn't be replicated
  for (let i = 0; i <= 10; i++) {
    const core = seeder.store.get({ name: 'foo' + i })
    await core.append(['foo'])
  }

  // Client side
  const swarm = new Hyperswarm(testnet)

  const discoveryKeys = new Set()
  const corestore = new Corestore(RAM, { _ondiscoverykey: discoveryKeys.add.bind(discoveryKeys) })

  swarm.on('connection', (conn) => {
    corestore.replicate(conn)
  })

  swarm.join(seeder.topic, { server: false, client: true })
  const done = corestore.findingPeers()
  swarm.flush().then(done, done)

  const readable = corestore.get({ key: core.key })
  await readable.update()

  t.is(readable.length, 2)
  t.is(readable.length, core.length)

  t.is(discoveryKeys.size, 0, "shouldn't recieve any unrequested replication")

  await seeder.close()
  await swarm.destroy()
})
