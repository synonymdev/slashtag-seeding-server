import App from './app.js'
import Seeder from './seeder.js'

// getting started
const seeder = new Seeder()
await seeder.start()

// Create the HTTP server app
const app = new App()
app.on('keyDiscovered', async (data) => seeder.registerHypercore(data.key))
app.on('deleteKey', async (data) => seeder.removeHypercore(data.key))
await app.start()
