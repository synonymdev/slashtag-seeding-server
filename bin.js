#!/usr/bin/env node

const config = require('config')
const { SeedingServer } = require('.')
const App = require('./src/app.js')
const path = require('path')

main()

async function main() {
  const opts = {
    dbName: config.get('store.dbName')
  }

  const storage = config.get('store.path');
  opts.storage = storage && path.join(__dirname, storage)

  try {
    opts.topic = Buffer.from(config.get('slashtags.topicKey'), 'hex')
  } catch {
    throw new Error('Must set See slashtags.topicKey in config')
  }

  try {
    opts.seed = Buffer.from(config.get('slashtags.seed'), 'hex')
  } catch { }

  // Create the slashtag seeding server
  const server = new SeedingServer(opts)

  // Setup HTTP server over the same seeding instance
  const app = new App(server.seeder)
  await app.start()
}
