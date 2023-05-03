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
    opts.topic = Buffer.from(config.get('hyperswarm.topicKey'), 'hex')
  } catch {
    throw new Error(
      'Must set the topic that the hyperswarm will listen on. See hyperswarm.topicKey in config'
    )
  }

  try {
    opts.seed = Buffer.from(config.get('hyperswarm.seed'), 'hex')
  } catch { }

  // Create the slashtag seeding server
  const server = new SeedingServer(opts)

  // Setup HTTP server over the same seeding instance
  const app = new App(server.seeder)
  await app.start()
}
