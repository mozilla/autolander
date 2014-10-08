var azureTable = require('azure-table-node');
var debug = require('debug')('autolander:bugstore');
var thunkify = require('thunkify');

const BUG_TABLE = 'subscribedbugs';

// Reference to the current azure API.
var azureApi;

/**
 * Initializes the pulse API.
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
 * Returns a list of subscribed bugs.
 */
exports.findBugs = function *() {
  var queryEntities = thunkify(azureApi.queryEntities.bind(azureApi));
  var storedBugs = yield queryEntities(BUG_TABLE, {
    query: azureTable.Query.create('PartitionKey', '==', 'bug'),
    onlyFields: ['RowKey']
  });
  debug('findBugs', storedBugs);

  var subscribedBugs = {};
  storedBugs[0].forEach(function(record) {
    subscribedBugs[record.RowKey] = true;
  });
  return subscribedBugs;
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
