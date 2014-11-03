var bugzilla = require('../lib/bugzilla');
var debug = require('debug')('autolander:route:taskgraph_update');
var github = require('../lib/github');
var removeBranch = require('../lib/github/remove_branch');
var Scheduler = require('taskcluster-client').Scheduler;
var thunkify = require('thunkify');

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
          yield bugzilla.resolveFix(runtime, bugId);

          // If there are no more currently integrating bugs, remove the integration branch.
          if (!runtime.bugStore.activeBugs.length) {
            yield removeBranch(runtime, params.githubBaseUser, params.githubBaseRepo, 'integration-' + params.githubBaseBranch);
          }
        } catch(e) {
          debug('could not add landing commit', bugId, commitUrl);
        }
        break;
      case 'blocked':
        // Comment on bugzilla and github.
        var comment = 'http://docs.taskcluster.net/tools/task-graph-inspector/#' + detail.payload.status.taskGraphId + '\n\n' + github.COMMENTS.CI_FAILED;
        yield bugzilla.addCiFailedComment(runtime, bugId, comment);
        yield github.addComment(runtime, pullInfo.user, pullInfo.repo, pullInfo.number, comment);

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
  yield removeBranch(runtime, params.githubBaseUser, params.githubBaseRepo, 'integration-' + params.githubBaseBranch);

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
