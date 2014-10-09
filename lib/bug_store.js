var azureTable = require('azure-table-node');
var debug = require('debug')('autolander:bugstore');
var thunkify = require('thunkify');

const BUG_TABLE = 'subscribedbugs';

// Reference to the current azure API.
var azureApi;

/**
 * Initializes the Bug Storage API.
 * When a pull request is opened for a bug we subscribe to it so we can quickly tell if we need to
 * look it up and process it from a pulse request.
 */
exports.initApi = function *(config) {
  debug('init', config)
  azureTable.setDefaultClient(config.azureConfig);
  azureApi = azureTable.getDefaultClient();

  // Setup the azure table if it doesn't exist.
  var createTable = thunkify(azureApi.createTable.bind(azureApi));
  yield createTable(BUG_TABLE, {
    ignoreIfExists: true
  });
  return this;
};

/**
 * Checks if we are subscribed to a single bug.
 */
exports.isSubscribed = function *(bugId) {
  debug('isSubscribed bugId', bugId);
  var getEntity = thunkify(azureApi.getEntity.bind(azureApi));
  var partitionKey = 'bug';

  var storedBug;
  try {
    storedBug = yield getEntity(BUG_TABLE, partitionKey, String(bugId));
  } catch(e) {
    debug('subscription not found');
    return false;
  }
  debug('bug subscription found', storedBug);

  return storedBug;
};

/**
 * Stops tracking a stored bug.
 * @param {Integer} bugId
 */
exports.remove = function *(bugId) {
  var deleteEntity = thunkify(azureApi.deleteEntity.bind(azureApi));
  yield deleteEntity(BUG_TABLE, {
    PartitionKey: 'bug',
    RowKey: String(bugId)
  }, {force: true});
  debug('bug subscription removed', bugId);
};

/**
 * starts tracking a stored bug.
 * @param {Integer} bugId
 */
exports.subscribe = function *(bugId) {
  var insertOrReplaceEntity = thunkify(azureApi.insertOrReplaceEntity.bind(azureApi));
  var response = yield insertOrReplaceEntity(BUG_TABLE, {
    PartitionKey: 'bug',
    RowKey: bugId
  });
  debug('subscribe', response);
};
