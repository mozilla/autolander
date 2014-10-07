var amqp = require('amqplib');
var azureTable = require('azure-table-node');
var co = require('co');
var debug = require('debug')('autolander:pulse');
var thunkify = require('thunkify');

/**
 * Initializes the pulse API.
 */
exports.initApi = function *(config, azureApi) {

  // A mapping of subscribed bugs.
  // When a pull request is opened for a bug we subscribe to it so we can quickly tell if we need to
  // look it up and process it from a pulse request.
  var queryEntities = thunkify(azureApi.queryEntities.bind(azureApi));
  var storedBugs = yield queryEntities('boogz', {
    query: azureTable.Query.create('PartitionKey', '==', 'bug'),
    onlyFields: ['RowKey']
  });
  var subscribedBugs = {};
  storedBugs[0].forEach(function(record) {
    subscribedBugs[record.RowKey] = true;
  });
  debug('stored bugs', subscribedBugs);

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
    debug('listen', response);
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

      var insertEntity = thunkify(runtime.azureApi.insertEntity.bind(runtime.azureApi));
      yield insertEntity('boogz', {
        PartitionKey: 'bug',
        RowKey: bugId
      });
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
