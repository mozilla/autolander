var amqp = require('amqplib');
var koa = require('koa');
var debug = require('debug')('autolander:worker');

/**
 * The web handler is the only web-facing interface of Autolander.
 * It exposes an HTTP endpoint, and is currently only used for
 * github webhook updates. Currently the only thing this handler
 * does is chuck stuff into our AMQP queue for processing by the worker.
 */
module.exports = function * createApp(config) {
  var app = koa();
  app.use(require('koa-body-parser')());
  app.use(require('koa-trie-router')(app));

  var connection = yield amqp.connect(config.pulseConfig.url);
  var ch = yield connection.createChannel();

  var ok = yield ch.assertQueue(config.pulseConfig.queueName, config.amqpConfig);
  var q = ok.queue;

  // Documented at: https://wiki.mozilla.org/Auto-tools/Projects/Pulse/Exchanges
  // Production pull request exchange looks like: 'exchange/autolander/github/pull-request'
  var pullRequestExchange = 'exchange/' + config.taskPulseConfig.username + '/github/pull-request';
  ch.assertExchange(pullRequestExchange, 'topic');
  ch.bindQueue(q, pullRequestExchange, '#', {});

  var handledEvents = {
    pull_request: true
  };

  app.post('/github', function * () {
    var eventName = this.get('X-GitHub-Event');
    debug('got /github post', eventName);
    if (!eventName) {
      this.throw(400, 'Hook must contain event type');
      return;
    }

    if (!handledEvents[eventName]) {
      debug('no handler for github event', eventName);
      return;
    }

    var body = this.request.body;
    if (!body) {
      return this.throw(400, 'Must contain a body');
    }
    // The POST body is of form:
    // https://developer.github.com/v3/activity/events/types/#pullrequestevent
    var pull = body.pull_request;

    // Do not send the request to a worker if this repo requires a key in the name
    // to process, and this pull request does not contain that key.
    // E.g., we may require pull requests to contain some key like +autoland to land.
    // XXX: Should be some option per repository in the future.
    /*
    var requiredTag = '+autoland';
    if (requiredTag && pull.title.indexOf(requiredTag) === -1) {
      debug('pull request is missing required tag', pull.number, requiredTag);
      return;
    }
    */

    var repoParts = pull.base.repo.full_name.split('/');
    var routingKey = [
      repoParts[0].replace(/\./g, "-"),
      repoParts[1],
      pull.number
    ].join('.');
    ch.publish(pullRequestExchange, routingKey, new Buffer(JSON.stringify({
      source: 'github',
      type: 'pull_request',
      meta: {
        owner: repoParts[0],
        repo: repoParts[1],
        number: pull.number,
        action: body.action
      }
    })));
    this.status = 200;
  });

  return app;
}
