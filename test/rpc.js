const test = require('brittle')
const Hyperswarm = require('hyperswarm')
const createTestnet = require('@hyperswarm/testnet')
const Corestore = require('corestore')
const RAM = require('random-access-memory')

const { SeedingServer, Client } = require('../index.js')

test('constructor', async (t) => {
  const testnet = await createTestnet(3, t.teardown)

  const server = new SeedingServer({
    ...testnet,
    seed: Buffer.alloc(32).fill(255)
  })
  await server.ready()

  t.alike(server.key, Buffer.from('76a1592044a6e4f511265bca73a604d90b0529d1df602be30a19a9257660d1f5', 'hex'))

  server.close()
})

test('seedAdd', async (t) => {
  const testnet = await createTestnet(3, t.teardown)

  const server = new SeedingServer(testnet)
  await server.ready()

  // Client side
  const swarm = new Hyperswarm(testnet)
  const client = new Client({ swarm })
  const corestore = new Corestore(RAM)

  swarm.on('connection', socket => corestore.replicate(stream))

  const core = corestore.get({ name: 'test' })
  await core.append(['foo', 'bar'])

  // Setup rpc on client side
  const stream = swarm.dht.connect(server.key)

  const response = await client.seedAdd(server.key, core.key)
  t.is(response, 'ok')

  const opened = [...server.seeder.store.cores.values()]
    .filter(c => c.key.equals(core.key))[0]
  t.alike(opened.key, core.key)

  const ts = t.test('synced')
  ts.plan(1)

  const interval = setInterval(() => {
    if (!opened.peers[0]?.remoteSynced) return

    ts.pass('synced')
    clearInterval(interval)
  }, 1)

  await ts

  server.close()
  swarm.destroy()
})
