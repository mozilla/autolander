var azureTable = require('azure-table-node');
var crypto = require('crypto');
var debug = require('debug')('autolander:activestore');
var thunkify = require('thunkify');

/**
 * The active integration store manages the currently integrating pull requests.
 * For each open pull request and taskgraph we track the information in azure storage.
 * This is necessary so we can rebuild the integration branch at any point when needed.
 * For example, we may rebuild the integration branch after a taskgraph fails,
 * but is followed by other jobs.
 */

const ACTIVE_TABLE = 'autolanderactiveintegrations';

/**
 * Returns the partition for a user/repo combination.
 */
function getPartitionKey(user, repo) {
  var shasum = crypto.createHash('sha1');
  var key = user + '/' + repo;
  return shasum.update(key).digest('hex');
}

var ActiveStore = function(config, api) {
  this._api = api;
  this._config = config;
  return this;
}

/**
 * Sets up the necessary azure table if it doesn't exist.
 */
ActiveStore.prototype.init = function * (config) {
  var createTable = thunkify(this._api.createTable.bind(this._api));
  yield createTable(ACTIVE_TABLE, {
    ignoreIfExists: true
  });

  return this;
};

/**
 * Checks if we are currently integrating a bug.
 * @param {String} user
 * @param {String} repo
 * @param {Number} bugId
 */
ActiveStore.prototype.isBugIntegrating = function * (user, repo, bugId) {
  debug('isIntegrating bugId', bugId);
  var integrations = this.getCurrentIntegrations(user, repo, bugId);
  debug('found integration length', integrations.length);
  return integrations > 0;
};

/**
 * Checks if we are currently integrating a taskgraphId.
 * @param {String} user
 * @param {String} repo
 * @param {String} taskgraphId
 */
ActiveStore.prototype.isTaskgraphIntegrating = function * (user, repo, taskgraphId) {
  debug('isTaskgraphIntegrating id', taskgraphId);
  var getEntity = thunkify(this._api.getEntity.bind(this._api));
  var partitionKey = getPartitionKey(user, repo);

  var record;
  try {
    record = yield getEntity(ACTIVE_TABLE, partitionKey, taskgraphId);
  } catch(e) {
    debug('record not found');
    return false;
  }
  debug('record found', record);

  return record;
};

/**
 * Gets all curently integrating jobs for a repo.
 * XXX: This is currently limited to ~1k records which should be fine
 * because we should never have more than 1k in-progress integrations.
 * @param {String} user
 * @param {String} repo
 * @param {Number} bugId= Filters by bugId if passed.
 */
ActiveStore.prototype.getCurrentIntegrations = function * (user, repo, bugId) {
  debug('getCurrentIntegrations', user, repo, bugId);
  var queryEntities = thunkify(this._api.queryEntities.bind(this._api));

  var integrations;
  try {
    var details = {
      query: azureTable.Query.create('PartitionKey', '==', getPartitionKey(user, repo))
    };

    if (bugId) {
      details.query.and('bugId', '==', bugId);
    }

    integrations = yield queryEntities(ACTIVE_TABLE, details);
    integrations = integrations[0];

    // Sort the integrations in ascending date order.
    integrations.sort(function(a, b) {
      var aDate = new Date(a.Timestamp);
      var bDate = new Date(b.Timestamp);
      return aDate.getTime() - bDate.getTime();
    });

  } catch(e) {
    debug('integrations not found', e);
    return [];
  }
  return integrations;
};

/**
 * Tracks starting integration.
 * @param {String} taskgraphId
 * @param {Object} params
 */
ActiveStore.prototype.startTracking = function * (taskgraphId, params) {
  debug('startTracking', taskgraphId);
  var insertOrReplaceEntity = thunkify(this._api.insertOrReplaceEntity.bind(this._api));

  var entity = {
    PartitionKey: getPartitionKey(params.githubBaseUser, params.githubBaseRepo),
    RowKey: taskgraphId
  };
  for (var i in params) {
    entity[i] = params[i];
  }

  var response = yield insertOrReplaceEntity(ACTIVE_TABLE, entity);
  debug('startTracking', response);
};

/**
 * Tracks ending integrations.
 * @param {String} taskgraphId
 * @param {Object} params
 */
ActiveStore.prototype.stopTracking = function * (taskgraphId, params) {
  debug('stopTracking', taskgraphId);
  var deleteEntity = thunkify(this._api.deleteEntity.bind(this._api));
  yield deleteEntity(ACTIVE_TABLE, {
    PartitionKey: getPartitionKey(params.githubBaseUser, params.githubBaseRepo),
    RowKey: taskgraphId
  }, {force: true});
  debug('bug subscription removed', taskgraphId);
};

/**
 * Initializes the Active Integration Storage API.
 */
exports.init = function * (config, api) {
  var api = new ActiveStore(config, api);
  return yield api.init();
};
