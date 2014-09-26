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
```

## TODO
* Handle when a github merge fails - we should comment on the pull request that we could not merge it and remove the checkin-needed flag.
* Store bugs we're interested in somewhere so we don't have to process *every* bug.
* Write end-to-end integration tests.
* Update bug comments with full merge path.
* Verify and write tests for multiple pull request attachments.
* Verify that autolander does not get confused with non pull-request attachments.
