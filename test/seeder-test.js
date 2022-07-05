import assert from 'assert'
import exp from 'constants';
import sinon from "sinon"
import Seeder from '../src/seeder.js'

function once(fn) {
    var returnValue,
        called = false;
    return function () {
        if (!called) {
            called = true;
            returnValue = fn.apply(this, arguments);
        }
        return returnValue;
    };
}

describe('Array', function () {
    let clock

    beforeEach(() => {
        clock = sinon.useFakeTimers(Date.now())
    });

    afterEach(() => {
        clock.restore()
        sinon.restore()
    });

    it("It saves the right data to the keystore", async function () {
        // Setup
        const seeder = new Seeder()
        seeder.db = { put: () => { } }
        sinon.replace(seeder.db, "put", sinon.fake());

        // Call it
        await seeder._putValue('theKey', 42)

        // expected arguments
        const expected = {
            type: 'hypercore',
            length: 42,
            lastUpdated: Date.now()
        }

        assert(seeder.db.put.called);
        assert.equal(seeder.db.put.args[0][0], 'theKey');
        assert.equal(seeder.db.put.args[0][1], JSON.stringify(expected));
    });


    it("It returns null when no key is found", async function () {
        // Setup
        const seeder = new Seeder()
        seeder.db = { get: async () => null }

        // Call it
        const result = await seeder._getValue('theKey', 42)
        assert.equal(result, null);
    });

    it("It returns the decoded valuewhen the key is found", async function () {
        // Setup
        const expected = { test: 42, value: "thing" }
        const seeder = new Seeder()
        seeder.db = {
            get: async () => ({ key: 'test', value: JSON.stringify(expected) })
        }

        // Call it
        const result = await seeder._getValue('theKey', 42)
        assert.deepEqual(result, expected);
    });


    it("It sees empty keys as empty and old", async function () {
        // Setup
        const seeder = new Seeder()
        seeder.db = { get: async () => null }

        // try all the cases that will count as empty and old
        // not empty..
        assert.equal(await seeder._emptyAndOld('theKey', 5), false)

        // empty, but has no entry in the db..
        assert.equal(await seeder._emptyAndOld('theKey', 0), false)

        // now start returning something from the db
        seeder.db = {
            get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() }) })
        }

        // empty, has an entry, last updated now
        assert.equal(await seeder._emptyAndOld('theKey', 0), false)

        // now start returning something from the db that isn't quite old
        seeder.db = {
            get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() - seeder.emptyLifespan + 1 }) })
        }

        // empty, has an entry, last updated recently
        assert.equal(await seeder._emptyAndOld('theKey', 0), false)

        // return something that counts as old
        seeder.db = {
            get: async () => ({ key: 'test', value: JSON.stringify({ lastUpdated: Date.now() - seeder.emptyLifespan }) })
        }

        // empty, has an entry, last updated a while ago
        assert.equal(await seeder._emptyAndOld('theKey', 0), true)
    });


    it("It can detected Abandoned items", async function () {
        // Setup
        const seeder = new Seeder()
        seeder.db = { get: async () => null }

        // item does not exist
        assert.equal(await seeder._hasBeenAbandoned('theKey'), false)


        // return an item that exists, but is still recent
        seeder.db = {
            get: async () => ({ key: 'theKey', value: JSON.stringify({ lastUpdated: Date.now() }) })
        }

        //  last updated recently
        assert.equal(await seeder._hasBeenAbandoned('theKey'), false)

        // return an item that exists, but is still recent
        seeder.db = {
            get: async () => ({ key: 'theKey', value: JSON.stringify({ lastUpdated: Date.now() - seeder.fullLifespan }) })
        }

        //  last updated recently
        assert.equal(await seeder._hasBeenAbandoned('theKey'), true)
    });

    it("It can decide if a key already exists", async function () {
        // Setup
        const seeder = new Seeder()
        seeder.db = { get: async () => null }

        // item does not exist
        assert.equal(await seeder._alreadyExists('theKey'), false)

        // return an item that exists, but is still recent
        seeder.db = {
            get: async () => ({ key: 'theKey', value: JSON.stringify({ lastUpdated: Date.now() }) })
        }

        //  last updated recently
        assert.equal(await seeder._alreadyExists('theKey'), true)
    });

});
