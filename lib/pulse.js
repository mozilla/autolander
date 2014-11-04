var amqp = require('amqplib');
var co = require('co');
var debug = require('debug')('autolander:bug_pulse');
var thunkify = require('thunkify');

/**
 * Initializes the pulse API.
 */
exports.init = function *(config) {
  var _handler;
  var connection = yield amqp.connect(config.pulseConfig.url);
  var ch = yield connection.createChannel();

  var ok = yield ch.assertQueue(config.pulseConfig.queueName, config.amqpConfig);
  var q = ok.queue;

  ch.assertExchange(config.pulseConfig.exchange, 'topic');
  ch.bindQueue(q, config.pulseConfig.exchange, '#', {});

  ch.consume(q, co(function * (msg) {
    var response = msg.content.toString();
    response = JSON.parse(response);
    debug('listen', response);
    if (_handler) {
      yield _handler(response);
    } else {
      debug('handler not ready for message', response);
    }
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
      yield runtime.bugStore.subscribe(bugId);
    },

    /**
     * Unsubscribes to a bugId.
     * @param {Object} runtime
     * @param {Integer} bugId
     */
    unsubscribe: function * (runtime, bugId) {
      yield runtime.bugStore.remove(bugId);
      debug('unsubscribed', bugId);
    },

    /**
     * Checks if we are subscribed to a bug.
     * @param {Object} runtime
     * @param {Integer} bugId
     */
    isSubscribed: function * (runtime, bugId) {
      return yield runtime.bugStore.isSubscribed(bugId);
    }
  };
}
