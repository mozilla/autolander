var amqp = require('amqplib/callback_api');
var bz = require('bz');
var GitHubApi = require('node-github');
var koa = require('koa');
var thunkify = require('thunkify');

function * createBugzfeedApi(config) {

  var connect = thunkify(amqp.connect.bind(amqp));
  var connection = yield connect(config.bugzfeedConfig.url);

  var createChannel = thunkify(connection.createChannel.bind(connection));
  var ch = yield createChannel();

  var assertQueue = thunkify(ch.assertQueue.bind(ch));
  var ok = yield assertQueue(config.bugzfeedConfig.queueName, {
    exclusive: true,
    autoDelete: true
  });
  var q = ok.queue;

  ch.assertExchange(config.bugzfeedConfig.exchange, 'topic');
  ch.bindQueue(q, config.bugzfeedConfig.exchange, '#');

  ch.consume(q, function(msg) {
    console.log('Got consume', msg.content.toString())
  }, {noAck: true});

  return {

    /**
     * Sends an object to the queue.
     */
    send: function(obj) {
      var msg = JSON.stringify(obj);
      ch.sendToQueue(config.bugzfeedConfig.queueName, new Buffer(msg));
    }
  };
}

function * createBugzillaApi(config) {
  config.bugzillaConfig.timeout = 30000;
  return bz.createClient(config.bugzillaConfig || {});
}

function * createGithubApi(config) {
  var githubApi = new GitHubApi({
    version: '3.0.0',
    debug: true,
    protocol: 'https',
    host: config.host,
    pathPrefix: '/api/v3',
    timeout: 5000
  });

  githubApi.authenticate({
    type: "oauth",
    token: config.token
  });

  return githubApi;
}

module.exports = function * createApp(config) {
  var app = koa();
  app.use(require('koa-body-parser')());
  app.use(require('koa-trie-router')(app));

  var runtime = {
    config: config,
    githubApi: yield createGithubApi(config),
    bugzfeedApi: yield createBugzfeedApi(config),
    bugzillaApi: yield createBugzillaApi(config)
  };

  var githubEvents = {
    pull_request: require('../routes/pull_request')(runtime)
  };

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
