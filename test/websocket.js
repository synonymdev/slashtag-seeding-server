const test = require('brittle')
const RAM = require('random-access-memory')
const WebSocket = require('ws')
const Corestore = require('corestore');

const { createWebSocketStream } = WebSocket

const Seeder = require("../src/seeder.js")
const App = require("../src/app.js")

test("can replicate over a websocket", async (t) => {
  const seeder = new Seeder({ storage: RAM });

  const app = new App(seeder);
  await app.start()

  // Mock hypercore
  const core = app.seeder.store.get({ name: "foo" })
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

  await seeder.close()
})
