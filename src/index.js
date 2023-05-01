const App = require('./app.js')
const Seeder = require('./seeder.js')
const SlashServer = require('./slashtag-server.js')

// getting started
const seeder = new Seeder()

// Create the HTTP server app
const app = new App(seeder)
await app.start()

// Create the slashtag server
const slashtagServer = new SlashServer(seeder)
await slashtagServer.start()
