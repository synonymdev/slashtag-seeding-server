const test = require('brittle')
const RAM = require('random-access-memory')

const Seeder = require('../src/seeder.js')

test('It saves the right data to the keystore', async (t) => {
  // Setup
  const seeder = new Seeder({ storage: RAM })

  let expected = {}

  seeder.db = {
    put: (key, value) => {
      t.is(key, 'theKey')
      t.is(value, JSON.stringify(expected))
    }
  }

  // Call it
  expected = {
    type: 'hypercore',
    length: 42,
    lastUpdated: Date.now()
  }
  await seeder._putValue('theKey', 42)

  await seeder.close()
})

test('It returns null when no key is found', async (t) => {
  // Setup
  const seeder = new Seeder({ storage: RAM })
  seeder.db = { get: async () => null }

  // Call it
  const result = await seeder._getValue('theKey')
  t.is(result, null)

  await seeder.close()
})

test('It returns the decoded value when the key is found', async (t) => {
  // Setup
  const expected = { test: 42, value: 'thing' }
  const seeder = new Seeder({ storage: RAM })
  seeder.db = {
    get: async () => ({ key: 'test', value: JSON.stringify(expected) })
  }

  // Call it
  const result = await seeder._getValue('theKey')
  t.alike(result, expected)

  await seeder.close()
})
