var amqp = require('amqplib');
var co = require('co');

/**
 * Initializes the pulse API.
 */
exports.initApi = function *(config) {

  // A mapping of subscribed bugs.
  // When a pull request is opened for a bug we subscribe to it so we can quickly tell if we need to
  // look it up and process it from a pulse request.
  var subscribedBugs = {};

  var _handler;
  var connection = yield amqp.connect(config.pulseConfig.url);
  var ch = yield connection.createChannel();

  var ok = yield ch.assertQueue(config.pulseConfig.queueName, {
    exclusive: true,
    autoDelete: true
  });
  var q = ok.queue;

  ch.assertExchange(config.pulseConfig.exchange, 'topic');
  ch.bindQueue(q, config.pulseConfig.exchange, '#', {});

  ch.consume(q, co(function * (msg) {
    var response = msg.content.toString();
    response = JSON.parse(response);
    yield _handler(response);
  }), {noAck: true});

  return {

    /**
     * Sets the handler for channel updates.
     */
    setHandler: function(handler) {
      _handler = handler;
    },

    /**
     * Sends an object to the queue.
     */
    send: function(obj) {
      var msg = JSON.stringify(obj);
      ch.sendToQueue(config.pulseConfig.queueName, new Buffer(msg));
    },

    /**
     * Subscribes to a bugId.
     * @param {Object} runtime
     * @param {Integer} bugId
     */
    subscribe: function * (runtime, bugId) {
      subscribedBugs[bugId] = true;
    },

    /**
     * Unsubscribes to a bugId.
     * @param {Object} runtime
     * @param {Integer} bugId
     */
    unsubscribe: function * (runtime, bugId) {
      delete subscribedBugs[bugId];
    },

    /**
     * Checks if we are subscribed to a bug.
     * @param {Object} runtime
     * @param {Integer} bugId
     */
    isSubscribed: function * (runtime, bugId) {
      return subscribedBugs[bugId];
    }
  };
}
