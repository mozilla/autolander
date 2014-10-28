var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:taskgraph_update');
var github = require('../lib/github');
var thunkify = require('thunkify');

var Scheduler = require('taskcluster-client').Scheduler;

/**
 * Called when we receive an update for a taskgraph.
 * @param {Object} runtime
 * @param {Object} detail The update object from pulse.
 */
module.exports = function(runtime) {
  return function * (detail) {
    debug('detail', detail);
    var taskGraphId = detail.payload.status.taskGraphId;

    var scheduler = new Scheduler({
      credentials: {
        clientId: runtime.config.taskclusterConfig.clientId,
        accessToken: runtime.config.taskclusterConfig.accessToken
      }
    });

    var taskInfo = yield scheduler.info(taskGraphId);
    debug('scheduler info', taskInfo);
    debug(Date.now());

    if (!runtime.bugStore.activeTaskGraphIds[taskGraphId]) {
      debug('could not find active taskGraphId', taskGraphId);
      return;
    }

    var revisionInfo = JSON.parse(taskInfo.tags.revisions);
    var pullInfo = JSON.parse(taskInfo.tags.pull);
    var params = JSON.parse(taskInfo.tags.params);
    var bugId = pullInfo.bugId;

    switch (detail.payload.status.state) {
      case 'running':
        debug('task is running');
        break;
      case 'finished':
        // Merge into the base branch if the run is successful.
        try {
          var merge = thunkify(runtime.githubApi.repos.merge.bind(runtime.githubApi.repos));
          var merged = yield merge({
            user: params.githubBaseUser,
            repo: params.githubBaseRepo,
            base: params.githubBaseBranch,
            head: params.githubHeadBranch,
            token: runtime.config.githubConfig.token
          });
        } catch(e) {
          debug('could not merge ref', e);
        }
        debug('merged is:', merged)

        removeActiveBug(runtime, bugId);
        delete runtime.bugStore.activeTaskGraphIds[taskGraphId];

        try {
          var commitUrl = 'https://github.com/' + params.githubBaseUser + '/' + params.githubBaseRepo + '/commit/' + params.githubHeadRevision;
          yield bugzilla.addLandingComment(runtime, bugId, commitUrl);
          yield bugzilla.removeCheckinNeeded(runtime, bugId);
        } catch(e) {
          debug('could not add landing commit', bugId, commitUrl);
        }
        break;
      case 'blocked':
        yield bugzilla.addCiFailedComment(runtime, bugId, 'http://docs.taskcluster.net/tools/task-graph-inspector/#' + detail.payload.status.taskGraphId);
        yield bugzilla.removeCheckinNeeded(runtime, bugId);
        yield rebuildIntegrationBranch(runtime, bugId, revisionInfo, pullInfo, params);
        break;
    }
  };
};

/** 
 * Removes a bug from the currently in-progress taskgraph runs.
 * @param {Object} runtime
 * @param {Number} bugId
 */
var removeActiveBug = function (runtime, bugId) {
  var bugIdx = runtime.bugStore.activeBugs.indexOf(bugId);
  runtime.bugStore.activeBugs.splice(bugIdx, 1);
  debug('removing active bug from queue', bugId, 'found at index', bugIdx);
  debug('remaining active bugs', runtime.bugStore.activeBugs);
}

/** 
 * Rebuilds the integration branch after a failed taskgraph.
 * @param {Object} runtime
 * @param {Number} bugId
 * @param {Object} revisionInfo
 * @param {Object} pullInfo
 * @param {Object} params
 */
var rebuildIntegrationBranch = function * (runtime, bugId, revisionInfo, pullInfo, params) {

  // Reset taskgraphIds that we care about
  runtime.bugStore.activeTaskGraphIds = {};

  // Remove the integration branch.
  try {
    var remove = thunkify(runtime.githubApi.gitdata.deleteReference.bind(runtime.githubApi.gitdata));
    yield remove({
      user: params.githubBaseUser,
      repo: params.githubBaseRepo,
      ref: 'heads/integration-' + params.githubBaseBranch,
      token: runtime.config.githubConfig.token
    });
  } catch(e) {
    debug('error removing integration branch');
  }

  // Re-create the integration branch.
  try {
    var getRef = thunkify(runtime.githubApi.gitdata.getReference.bind(runtime.githubApi.gitdata));
    var masterRef = yield getRef({
      user: params.githubBaseUser,
      repo: params.githubBaseRepo,
      ref: 'heads/' + params.githubBaseBranch,
      token: runtime.config.githubConfig.token
    });
    debug('got the master sha', masterRef.object.sha);

    var createRef = thunkify(runtime.githubApi.gitdata.createReference.bind(runtime.githubApi.gitdata));
    var ref = yield createRef({
      user: params.githubBaseUser,
      repo: params.githubBaseRepo,
      ref: 'refs/heads/integration-' + params.githubBaseBranch,
      sha: masterRef.object.sha,
      token: runtime.config.githubConfig.token
    });
  } catch(e) {
    debug('could not create the integration branch', e);
  }

  // Simulate a pulse update for each bug remaining.
  removeActiveBug(runtime, bugId);
  var bzPulse = require('./pulse_update')(runtime);
  for (var i = 0; i < runtime.bugStore.activeBugs.length; i++) {
    var eachBug = runtime.bugStore.activeBugs[i];
    yield bzPulse({
      id: eachBug
    });
  }
}
