var azureTable = require('azure-table-node');
var crypto = require('crypto');
var debug = require('debug')('autolander:bugstore');
var thunkify = require('thunkify');

const BUG_TABLE = 'autolandersubscribedbugs';

/**
 * Returns the partition for a bug ID.
 * Hashes the bugId.
 */
function partitionForBug(bugId) {
  var shasum = crypto.createHash('sha1');
  return shasum.update(String(bugId)).digest('hex');
}

var AzureApi = function(config) {
  // XXX: A local cache of taskgraphs we're currently running integration for.
  this.activeIntegrations = [];
  this.activeTaskGraphIds = {};
  this._config = config;
  return this;
}

AzureApi.prototype.init = function *() {
  azureTable.setDefaultClient(this._config.azureConfig);
  this._api = azureTable.getDefaultClient();

  // Setup the azure table if it doesn't exist.
  var createTable = thunkify(this._api.createTable.bind(this._api));
  yield createTable(BUG_TABLE, {
    ignoreIfExists: true
  });

  return this;
};

/**
 * Checks if we are subscribed to a single bug.
 */
AzureApi.prototype.isSubscribed = function *(bugId) {
  debug('isSubscribed bugId', bugId);
  var getEntity = thunkify(this._api.getEntity.bind(this._api));
  var partitionKey = partitionForBug(bugId);

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
AzureApi.prototype.remove = function *(bugId) {
  var deleteEntity = thunkify(this._api.deleteEntity.bind(this._api));
  yield deleteEntity(BUG_TABLE, {
    PartitionKey: partitionForBug(bugId),
    RowKey: String(bugId)
  }, {force: true});
  debug('bug subscription removed', bugId);
};

/**
 * starts tracking a stored bug.
 * @param {Integer} bugId
 */
AzureApi.prototype.subscribe = function *(bugId) {
  var insertOrReplaceEntity = thunkify(this._api.insertOrReplaceEntity.bind(this._api));
  var response = yield insertOrReplaceEntity(BUG_TABLE, {
    PartitionKey: partitionForBug(bugId),
    RowKey: bugId
  });
  debug('subscribe', response);
};

/**
 * Initializes the Bug Storage API.
 * When a pull request is opened for a bug we subscribe to it so we can quickly tell if we need to
 * look it up and process it from a pulse request.
 */
exports.init = function *(config) {
  var api = new AzureApi(config);
  return yield api.init();
};
