#!/usr/bin/env node

const { SeedingServer } = require('.')
const App = require('./src/app.js')
const path = require('path')
const fs = require('fs')

main()

async function main () {
  const config = getConfig()

  const opts = {
    dbName: config.store.dbName
  }

  const storage = config.store.path
  opts.storage = storage && path.join(__dirname, storage)

  try {
    opts.topic = Buffer.from(config.slashtags.topicKey, 'hex')
  } catch {
    throw new Error('Must set See slashtags.topicKey in config')
  }

  try {
    opts.seed = Buffer.from(config.slashtags.seed, 'hex')
  } catch { }

  // Create the slashtag seeding server
  const server = new SeedingServer(opts)

  // Setup HTTP server over the same seeding instance
  const app = new App(server.seeder, { logger: true, port: config.http.port })
  await app.start()
}

function getConfig () {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, './config/config.json'))
        .toString()
    )
  } catch (error) {
    console.warn('Error while reading config', error)
    return {}
  }
}
