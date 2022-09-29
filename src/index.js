import App from './app.js'
import Seeder from './seeder.js'
import SlashServer from './slashtag-server.js'

// getting started
const seeder = new Seeder()
await seeder.start()

// Create the HTTP server app
const app = new App(seeder)
await app.start()

// Create the slashtag server
const slashtagServer = new SlashServer(seeder)
await slashtagServer.start()