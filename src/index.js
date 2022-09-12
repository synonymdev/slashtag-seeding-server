import App from './app.js'
import Seeder from './seeder.js'
import SlashServer from './slashtag-server.js'

// getting started
const seeder = new Seeder()
await seeder.start()

// Create the HTTP server app
const app = new App()
app.on('keyDiscovered', async (data) => seeder.registerHypercore(data.key))
app.on('deleteKey', async (data) => seeder.removeHypercore(data.key))
await app.start()

// Create the slashtag server
const slashtagServer = new SlashServer()
slashtagServer.on('keyDiscovered', async (data) => seeder.registerHypercore(data.key))
slashtagServer.on('deleteKey', async (data) => seeder.removeHypercore(data.key))
await slashtagServer.start()