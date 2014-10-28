# Autolander

Autolander is a tool which manages continuous integration workflows between Bugzilla and Github.

## Development

Ensure that the :autolander (https://github.com/autolander) github account has push access to your repository.

Using ngrok for a tunnel to localhost is the easiest way to develop. Fork your repository of choice. Once you have a tunnel setup, add a webhook to your repository that points to https://<id>.ngrok.com/github.

```
./ngrok 80
```

Create configuration if needed. Copy the template config file to the environment (development/production), and fill in the keys. Ask me if you need development keys.
```
cp config/development.js.tpl config/development.js
// Or, if testing/running in production:
cp config/development.js.tpl config/production.js
```

Start the server.
```
node ./bin/app

// Or start with debug logging:
DEBUG=* node --harmony ./bin/app

// Start for production and debugging
DEBUG=* node --harmony ./bin/app production

```

## Running tests

Run end-to-end integration tests with the application server already running.
```
# Run all tests for the project:
npm test

# Run a single test:
./test/runone.sh some_test.js
```
