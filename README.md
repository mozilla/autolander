# Autolander

Autolander is a tool which manages continuous integration workflows between Bugzilla and Github. Autolander interacts between several components, some of which are:

* Bugzilla - Attaches pull requests and comments on bugs.
* Github - Listens for webhooks, and lands code.
* Taskcluster - Publishes taskgraphs from integration branches before landing.
* Treeherder - Updates treeherder UI with integration results.
* Azure - Stores the list of bugs that we are interested in.
* Pulse/AMQP - Receives updates for bugs and taskgraph updates.


## Configuration

Create configuration if needed. Copy the template config file to the environment (development/production), and fill in the keys. Ask me if you need development keys.
```
cp config/development.js.tpl config/development.js
// Or, if testing/running in production:
cp config/development.js.tpl config/production.js
```


## Running tests

End-to-end integration tests which test against real instances of bugzilla, pulse, github, taskcluster and treeherder. Running tests is the recommended way to develop for autolander.
```
# Run all tests for the project:
npm test

# Run a single test:
./test/runone.sh test/some_test.js
```


## Local Environment

Ensure that the :autolander (https://github.com/autolander) github account has push access to your repository.

Using ngrok for a tunnel to localhost is the easiest way to develop. Fork your repository of choice. Once you have a tunnel setup, add a webhook to your repository that points to https://<id>.ngrok.com/github.

```
./ngrok 80
```

Start the server.
```
// You need to start both the web interface, and the listener.
node ./bin/web
node ./bin/worker

// Or start with debug logging:
DEBUG=* node --harmony ./bin/web
DEBUG=* node --harmony ./bin/worker

// Start for production and debugging
DEBUG=* node --harmony ./bin/web production
DEBUG=* node --harmony ./bin/worker production

```
