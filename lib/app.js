var bugzilla = require('./bugzilla');
var github = require('./github');
var pulse = require('./pulse');
var koa = require('koa');
var thunkify = require('thunkify');
var azureTable = require('azure-table-node');

module.exports = function * createApp(config) {
  var app = koa();
  app.use(require('koa-body-parser')());
  app.use(require('koa-trie-router')(app));

  azureTable.setDefaultClient(config.azureConfig);
  var azureApi = azureTable.getDefaultClient();

  // Setup the azure table if it doesn't exist.
  var createTable = thunkify(azureApi.createTable.bind(azureApi));
  yield createTable('boogz', {
    ignoreIfExists: true
  });

  var runtime = {
    config: config,
    azureApi: azureApi,
    githubApi: yield github.initApi(config),
    bugzillaApi: yield bugzilla.initApi(config),
    pulseApi: yield pulse.initApi(config, azureApi)
  };

  var githubEvents = {
    pull_request: require('../routes/pull_request')(runtime)
  };

  var pulseEvents = {
    pulse_update: require('../routes/pulse_update')(runtime)
  };

  runtime.pulseApi.setHandler(function * (response) {
    yield pulseEvents.pulse_update(response.payload);
  });

  app.post('/github', function * () {
    var eventName = this.get('X-GitHub-Event');
    if (!eventName) {
      this.throw(400, 'Hook must contain event type');
      return;
    }

    if (!githubEvents[eventName]) {
      this.throw(400, 'Cannot handle "' + eventName + '" events');
      return;
    }

    yield githubEvents[eventName];
  });

  return app;
}
