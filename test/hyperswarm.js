import test from 'brittle'
import RAM from 'random-access-memory'
import Corestore from 'corestore';
import Hyperswarm from 'hyperswarm'
import createTestnet from '@hyperswarm/testnet'

import Seeder from "../src/seeder.js"

test("can replicate over a seeders topic", async (t) => {
  const testnet = await createTestnet(3, t.teardown)

  const seeder = new Seeder({bootstrap: testnet.bootstrap, storage: RAM});
  await seeder.ready()

  // Mock hypercore
  const core = seeder.store.get({ name : "foo" })
  await core.append(['foo', 'bar'])

  // Client side
  const swarm = new Hyperswarm(testnet)
  const corestore = new Corestore(RAM)

  swarm.on("connection", (conn) => {
    corestore.replicate(conn)
  })

  swarm.join(seeder.topic, {server: false, client: true})
  const done = corestore.findingPeers()
  swarm.flush().then(done, done)

  const readable = corestore.get({ key: core.key })
  await readable.update()

  console.log(readable)
  t.is(readable.length, 2)
  t.is(readable.length, core.length)

  await seeder.close()
  await swarm.destroy()
})
