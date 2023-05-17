const test = require('brittle')
const RAM = require('random-access-memory')

const Seeder = require('../src/seeder.js')

test("It saves the right data to the keystore", async (t) => {
    // Setup
    const seeder = new Seeder({ storage: RAM })

    let expected = {};

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
    };
    await seeder._putValue('theKey', 42);

    await seeder.close()
})

test("It returns null when no key is found", async (t) => {
    // Setup
    const seeder = new Seeder({ storage: RAM })
    seeder.db = { get: async () => null }

    // Call it
    const result = await seeder._getValue('theKey', 42)
    t.is(result, null);

    await seeder.close()
});

test("It returns the decoded value when the key is found", async (t) => {
    // Setup
    const expected = { test: 42, value: "thing" }
    const seeder = new Seeder({ storage: RAM })
    seeder.db = {
        get: async () => ({ key: 'test', value: JSON.stringify(expected) })
    }

    // Call it
    const result = await seeder._getValue('theKey', 42)
    t.alike(result, expected);

    await seeder.close()
});

// _emptyAndOld is no longer in the seeder
test.skip("It sees empty keys as empty and old", async (t) => {
    // Setup
    const seeder = new Seeder({ storage: RAM })
    seeder.db = { get: async () => null }

    // try all the cases that will count as empty and old
    // not empty..
    t.is(await seeder._emptyAndOld('theKey', 5), false)

    // empty, but has no entry in the db..
    t.is(await seeder._emptyAndOld('theKey', 0), false)

    // now start returning something from the db
    seeder.db = {
        get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() }) })
    }

    // empty, has an entry, last updated now
    t.is(await seeder._emptyAndOld('theKey', 0), false)

    // now start returning something from the db that isn't quite old
    seeder.db = {
        get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() - seeder.emptyLifespan + 1 }) })
    }

    // empty, has an entry, last updated recently
    t.is(await seeder._emptyAndOld('theKey', 0), false)

    // return something that counts as old
    seeder.db = {
        get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() - seeder.emptyLifespan }) })
    }

    // empty, has an entry, last updated a while ago
    t.is(await seeder._emptyAndOld('theKey', 0), true)

    await seeder.close()
});


// _emptyAndOld is no longer in the seeder
test.skip("It sees empty keys as empty and old", async (t) => {
    // Setup
    const seeder = new Seeder({ storage: RAM })
    seeder.db = { get: async () => null }

    // try all the cases that will count as empty and old
    // not empty..
    t.is(await seeder._emptyAndOld('theKey', 5), false)

    // empty, but has no entry in the db..
    t.is(await seeder._emptyAndOld('theKey', 0), false)

    // now start returning something from the db
    seeder.db = {
        get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() }) })
    }

    // empty, has an entry, last updated now
    t.is(await seeder._emptyAndOld('theKey', 0), false)

    // now start returning something from the db that isn't quite old
    seeder.db = {
        get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() - seeder.emptyLifespan + 1 }) })
    }

    // empty, has an entry, last updated recently
    t.is(await seeder._emptyAndOld('theKey', 0), false)

    // return something that counts as old
    seeder.db = {
        get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() - seeder.emptyLifespan }) })
    }

    // empty, has an entry, last updated a while ago
    t.is(await seeder._emptyAndOld('theKey', 0), true)

    await seeder.close()
});


// _hasBeenAbandoned is no longer in the seeder
test.skip("It can detected Abandoned items", async (t) => {
    // Setup
    const seeder = new Seeder({ storage: RAM })
    seeder.db = { get: async () => null }

    // item does not exist
    t.is(await seeder._hasBeenAbandoned('theKey'), false)


    // return an item that exists, but is still recent
    seeder.db = {
        get: async () => ({ key: 'theKey', value: JSON.stringify({ lastUpdated: Date.now() }) })
    }

    //  last updated recently
    t.is(await seeder._hasBeenAbandoned('theKey'), false)

    // return an item that exists, but is still recent
    seeder.db = {
        get: async () => ({ key: 'theKey', value: JSON.stringify({ lastUpdated: Date.now() - seeder.fullLifespan }) })
    }

    //  last updated recently
    t.is(await seeder._hasBeenAbandoned('theKey'), true)

    await seeder.close()
});

// _alreadyExists is no loger in the seeder
test.skip("It can decide if a key already exists", async (t) => {
    // Setup
    const seeder = new Seeder({ storage: RAM })
    seeder.db = { get: async () => null }

    // item does not exist
    t.is(await seeder._alreadyExists('theKey'), false)

    // return an item that exists, but is still recent
    seeder.db = {
        get: async () => ({ key: 'theKey', value: JSON.stringify({ lastUpdated: Date.now() }) })
    }

    //  last updated recently
    t.is(await seeder._alreadyExists('theKey'), true)

    await seeder.close()
});
