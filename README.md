# slashtag-seeding-server

Seeds Hypercores

Make HTTP requests to the this server to tell it about new Hypercores to be seeded. It will then track and maintain an in-sync copy of the hypercore.

## Add seeds using Slashtags

```
// The slashtags (mine one, and the seeding servers)
const mySlashtag = 'slash:...my slashtag...'
const serverSlashtag = 'slash:...servers slashtag here...'

// A hypercore you want to seed (probably shared on hyperswarm)
const core = ... your hypercore that you want to seed ...

// Create the protocol and add the hypercores public key to the seeding list
const protocol = new SeedingProtocol(mySlashtag)
const response = await protocol.seedAdd(serverSlashtag, core.key.toString('hex'))
```

## The Web Server

By default listens on port 3000 (see config)

POST `/seeding/hypercore` with a json body...
```
{
    "publicKey": "public key of hypercore, hex encoded"
}
```

GET `/seeding/hypercore/:key`
where :key is the hex encoded public key of a hypercore.
Queries the seeding server for up to date information about a specific hypercore.
A 200 response will contain the following
```
{
    key: <public key>,
    length: <current length of the hypercore on the seeding server>,
    lastUpdated: <when the seeding server last saw a change (ms timestamp)>,
}
```

## Config

* **http.logger**: true to enable logging on the HTTP server
* **http.port**: the port for the http server to listen on
* **store.path**: The path to a folder where the app will store data (for hypercores, key/value store etc)
* **store.dbName**: A name used to derive the keys for the hyperbee key value store
* **slashtags.primaryKey**: The key used to derive the servers slashtag
* **testClient.path**: The path to store data for the test client
* **testClient.coreName**: The name used to derive the keys for the test hypercore that is created

To change the config from the defaults found in `config/default.json`, you should create a new file `config/local.json` and override any settings you want to be different from the defaults in there. `local.json` is git ignored.

## Inner workings...

When a new hypercore is given to the seeding server (eg via an http request), we create a local copy of the hypercore. We join a topic (the hypercores discovery key) in the hyperswarm to find other peers that are online and download any updates.

Finally we store the new hypercores key in a key/value store (Hyperbee).

During startup, all keys in the key/value store are fetched so we can restart the process of monitoring all the hypercores we are responsible for tracking.
