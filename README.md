# Autolander

Autolander is a tool which manages continuous integration workflows between Bugzilla and Github. Autolander has several features including:

* Automatic pull request to bugzilla attachment linking.
* Integrates code for you once the bug has a R+ (from a suggested reviewer) and the autoland keyword.
* The integration step includes several processes, but here is a quick summary:
  * Merges code to an integration branch.
  * The commits are ordered in the order that they are meant to be landed in master.
  * A taskgraph is submitted to taskcluster for each integration.
  * If a taskgraph fails, the commit is discarded, and newer commits are re-run on the integration branch.
  * On a successful taskgraph run, we fast-forward the base branch to the integration commit.
  * If we can not fast-forward the base branch, we re-create the integration branch from the base branch and replay all integrations on top of it.
* Autolander will update the bug with the landing commit, and resolve the bug as fixed.

Validations:

* Pull request titles - a bug number is required in the pull request title.
* Commit messages - Each commit message in the pull request must have a bug number.
* TBD: If we should require a r= in each commit message (we may be able to include this info in the future from the bug automatically).

Autolander interacts between several components, some of which are:

* Bugzilla - Attaches pull requests and comments on bugs.
* Github - Listens for webhooks, and lands code.
* Taskcluster - Publishes taskgraphs from integration branches before landing.
* Treeherder - Updates treeherder UI with integration results.
* Azure - Stores the list of bugs that we are interested in.
* Pulse/AMQP - Receives updates for bugs and taskgraph updates.


## Configuration

Create configuration if needed. Copy the template config file to the environment (development or production), and fill in the keys. An example config/production.js file already exists which uses environment defines - this is useful for deploying to a server which already has these defined. Ask me if you need development keys.
```
cp config/development.js.tpl config/development.js
```


## Running tests

End-to-end integration tests which test against real instances of bugzilla, pulse, github, taskcluster and treeherder. Running tests is the recommended way to develop for autolander.
```
# Run all tests for the project:
npm test

# Run a single test:
./test/runone.sh test/some_test.js

# Each test will automatically spin up the worker and web servers by default.
# It can be useful to run these on your own for debugging purposes.
# To do this, first spin up the web and worker instances.
DEBUG=* ./bin/web
DEBUG=* ./bin/worker

# Run tests with NO_SERVER=1 if you do this.
NO_SERVER=1 npm test
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

## Enabling Autolander for additional repositories

We don't yet have a UI in place to easily do this, so for the time being, Autolander needs a few things in place to function:

* Add the Autolander user (https://github.com/autolander/) to your repository with permissions.
* Add the heroku webhook to your repository, and make sure it receives events for pull requests: http://autolander.herokuapp.com/github
* Until bug 1094926 is finished, the BUGZILLA_SUPPORTED_PRODUCTS configuration value needs to be updated to contain your bugzilla product.
