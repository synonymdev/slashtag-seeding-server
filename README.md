# slashtag-seeding-server

Seeds Hypercores

Make HTTP requests to the this server to tell it about new Hypercores to be seeded. It will then track and maintain an in-sync copy of the hypercore.

## The Web Server

By default listens on port 3000 (see config)

POST `/register-core` with a json body...
```
{
    "core": "public key of hypercore"
}
```

## Config

* **http.logger**: true to enable logging on the HTTP server
* **http.port**: the port for the http server to listen on
* **store.path**: The path to a folder where the app will store data (for hypercores, key/value store etc)
* **store.dbName**: A name used to derive the keys for the hyperbee key value store
* **testClient.path**: The path to store data for the test client
* **testClient.coreName**: The name used to derive the keys for the test hypercore that is created

To change the config from the defaults found in `config/default.json`, you should create a new file `config/local.json` and override any settings you want to be different from the defaults in there. `local.json` is git ignored.

## Inner workings...

When a new hypercore is given to the seeding server (via an http request), we create a local copy of the hypercore. We join a topic (the hypercores discovery key) in the hyperswarm to find other peers that are online and download any updates.

Finally we store the new hypercores key in a key/value store (Hyperbee).

During startup, all keys in the key/value store and fetched so we can restart the process of monitoring all the hypercores we are responsible for tracking.

## todo

* A way to remove a hypercore that no longer should be seeded
* A way to drop seeding of hypercores that are empty for a long time, or not used for a long time
* Make the startup process a little more efficient, as there are a lot of blocking steps that will take forever to complete if we are tracking 100,000's of hypercores.
