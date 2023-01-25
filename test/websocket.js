import test from 'brittle'
import RAM from 'random-access-memory'
import WebSocket, {createWebSocketStream} from 'ws'
import Corestore from 'corestore';

import Seeder from "../src/seeder.js"
import App from "../src/app.js"

test("can replicate over a websocket", async (t) => {
  const seeder = new Seeder();
  // TODO: move the construction of corestore and hyperswarm to the constructor function
  await seeder.start()

  const app = new App(seeder);
  await app.start()

  // Mock hypercore
  const core = app.seeder.store.get({ name : "foo" })
  await core.append(['foo', 'bar'])

  // Client side
  const corestore = new Corestore(RAM)

  const tc = t.test('client')
  tc.plan(2)

  const socket = new WebSocket("ws://localhost:" + app.port)
  socket.onopen = async () => {
    const s = corestore.replicate(true);
    s.pipe(createWebSocketStream(socket)).pipe(s)

    const readable = corestore.get({ key: core.key })
    await readable.get(0)

    tc.ok(readable.length, "not zero")
    tc.is(readable.length, core.length)
  }

  await tc

  await app.server?.close()

  // TODO: add seeder.close() funciton
  await seeder.swarm.destroy()
  clearInterval(seeder.interval)
  clearTimeout(seeder.timeout)
})
