var TreeherderProject = require('mozilla-treeherder/project');
var TreehederGHFactory = require('mozilla-treeherder/factory/github');
var GraphFactory = require('taskcluster-task-factory/graph');
var Scheduler = require('taskcluster-client').Scheduler;

var debug = require('debug')('autolander:taskgraph');
var github = require('./github');
var fetchContent = require('./github/fetch_content');
var jsTemplate = require('json-templater/object');
var merge = require('deap').merge;
var slugid = require('slugid');
var thunkify = require('thunkify');

const GITHUB_CONTENT_URL = 'https://raw.githubusercontent.com';
const PROJECT_NAME = 'gaia-try';

const TASKGRAPH_PATHS = [
  'autolander.json',
  'taskgraph.json'
];

var formatCommitsForResultSet = function(project, commits) {
  return commits.map(function(commit) {
    return {
      comment: commit.message,
      revision: commit.sha,
      repository: project,
      author: commit.committer.name + ' <' + commit.committer.email + '>'
    };
  });
};

var getDefaultTask = function() {
  return {
    provisionerId: 'aws-provisioner',
    workerType: 'gaia',
    retries: 5,
    extra: {
      github: {
        baseUser: '{{githubBaseUser}}',
        baseRepo: '{{githubBaseRepo}}',
        baseRevision: '{{githubBaseRevision}}',
        baseBranch: '{{githubBaseBranch}}',

        headUser: '{{githubHeadUser}}',
        headRepo: '{{githubHeadRepo}}',
        headRevision: '{{githubBaseRevision}}}',
        headBranch: '{{githubHeadBranch}}',
      }
    },
    metadata: {},
    payload: {
      env: {
        CI: true,
        GITHUB_PULL_REQUEST: '{{githubPullNumber}}',

        // Base details
        GITHUB_BASE_REPO: '{{githubBaseRepo}}',
        GITHUB_BASE_USER: '{{githubBaseUser}}',
        GITHUB_BASE_GIT: 'https://github.com/{{githubBaseUser}}/{{githubBaseRepo}}',
        GITHUB_BASE_REV: '{{githubBaseRevision}}',
        GITHUB_BASE_BRANCH: '{{githubBaseBranch}}',

        // Head details
        GITHUB_HEAD_REPO: '{{githubHeadRepo}}',
        GITHUB_HEAD_USER: '{{githubHeadUser}}',
        GITHUB_HEAD_GIT: 'https://github.com/{{githubHeadUser}}/{{githubHeadRepo}}',
        GITHUB_HEAD_REV: '{{githubHeadRevision}}',
        GITHUB_HEAD_BRANCH: '{{githubHeadBranch}}',

        // Treeherder
        TREEHERDER_PROJECT: '{{treeherderRepo}}',
        TREEHERDER_REVISION: '{{treeherderRevision}}'
      },
      maxRunTime: 7200,
      features: {}
    }
  };
};

/**
 * Creates a taskgraph for processing on treeherder.
 * @seealso https://github.com/lightsofapollo/gaia-taskcluster
 * @param {Object} runtime
 * @param {Number} bugId
 * @param {Object} pull
 * @param {Object} integrationMerge
 */
exports.create = function * (runtime, bugId, pull, integrationMerge) {
  var branch = 'integration-' + pull.base.ref;
  var repoParts = pull.base.repo.full_name.split('/');

  // If there is no integrationMerge commit throw an error.
  // We need the successful merge to the integration branch in order to create a taskgraph.
  if (!integrationMerge || !integrationMerge.commit) {
    debug('integration merge not found', integrationMerge);
    return;
  }

  // Get the commits for the pull request
  var getCommits = thunkify(runtime.githubApi.pullRequests.getCommits.bind(runtime.githubApi.pullRequests));
  var commits = yield getCommits({
    user: repoParts[0],
    repo: repoParts[1],
    number: pull.number,
    token: runtime.config.githubConfig.token
  });
  commits.push(integrationMerge);
  commits = commits.map(function(item) {
    var obj = item.commit;
    obj.sha = obj.tree.sha;
    return obj;
  });
  debug('got commits', commits);

  // Owner email address note that we use who submitted the pr not who
  // authored the code originally.
  var fakeEmailDomain = 'autolander.taskcluster.net';
  var owner = pull.user.login + '@' + fakeEmailDomain;

  var resultset = {
    revision_hash: integrationMerge.sha,
    type: 'push',
    author: owner,
    revisions: formatCommitsForResultSet(PROJECT_NAME, commits),
    push_timestamp: Date.now() / 1000
  };
  debug('built resultset', resultset);

  // submit the resultset to treeherder
  var thConfig = runtime.config.treeherderConfig;
  var thRepository = new TreeherderProject(PROJECT_NAME, {
    consumerKey: thConfig.consumerKey,
    consumerSecret: thConfig.consumerSecret,
    baseUrl: thConfig.baseUrl + 'api/'
  });
  debug('created treeherder project', thRepository);
  try {
    yield thRepository.postResultset([resultset]);
  } catch(e) {
    yield github.addComment(runtime, repoParts[0], repoParts[1], pull.number, github.COMMENTS.TREEHERDER_POST_ERROR);
    debug('failed posing resultset to treeherder.');
    debug(e, e.message);
  }

  // Get the content for the first taskgraph file we can find.
  var foundTaskGraph;
  var graph;
  for (var i = 0; i < TASKGRAPH_PATHS.length; i++) {
    debug('trying to fetch taskgraph');
    try {
      foundTaskGraph = TASKGRAPH_PATHS[i];
      graph = JSON.parse(
        yield fetchContent(runtime, repoParts[0], repoParts[1], branch, foundTaskGraph)
      );
      break;
    } catch(e) {
      debug('could not find taskgraph', foundTaskGraph);
    }
  }
  debug('fetched graph', graph);

  var source = GITHUB_CONTENT_URL + '/' +
    repoParts[0] + '/' +
    repoParts[1] + '/' +
    branch + '/' +
    foundTaskGraph;

  var params = {
    bugId: bugId,
    // Base repository details...
    githubBaseRepo: repoParts[1],
    githubBaseUser: repoParts[0],
    githubBaseRevision: pull.base.sha,
    githubBaseBranch: pull.base.ref,
    // Head repository details are the same as base for push.
    githubHeadRepo: repoParts[1],
    githubHeadUser: repoParts[0],
    githubHeadRevision: pull.head.sha,
    githubHeadBranch: branch,
    // Details that are useful to have on taskgraph updates.
    githubPullNumber: pull.number,
    githubPullMergeSha: integrationMerge.sha,
    // Treeherder details...
    treeherderRepo: PROJECT_NAME,
    treeherderRevision: integrationMerge.sha
  };

  var treeherderRoute = runtime.config.treeherderConfig.route + '.' +
    PROJECT_NAME + '.' +
    integrationMerge.sha;

  graph = merge(
    // remember these values _override_ values set elsewhere
    {
      scopes: [
        '*'
      ],
      // Bug 1091212: Audit autolander scopes
      // treeherderRoute
      metadata: {
        owner: owner,
        source: source,
      },
      routes: [
        [
          runtime.config.taskPulseConfig.route,
          pull.number,
          repoParts[0],
          repoParts[1]
        ].join('.')
      ],
      tags: {
        revisions: JSON.stringify(resultset.revisions),
        bugId: String(bugId),
        params: JSON.stringify(params)
      }
    },
    // original graph from github
    graph
    // defaults set by config
    // runtime.graph
  );

  graph.tasks = graph.tasks.map(function(task) {
    var task = merge(
      // strict overrides
      {
        task: {
          metadata: {
            owner: owner,
            source: source
          }
        }
      },
      // original task in the graph
      task,
      // defaults set by config
      {
        task: getDefaultTask()
      }
    );
    task.task.routes = task.task.routes || [];
    task.task.scopes = task.task.scopes || [];

    // Treeherder
    task.task.routes.push(treeherderRoute);

    // Bug 1143801 - Overwrite all artifact expire dates to be one year in the future.
    // This is a quick fix as autolander.json is checked into the repository and is static for now.
    if (task.task.payload && task.task.payload.artifacts) {

      var nextYear = new Date(Date.now());
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      nextYear = nextYear.toJSON();

      for (var i in task.task.payload.artifacts) {
        if (task.task.payload.artifacts[i].expires) {
          task.task.payload.artifacts[i].expires = nextYear;
        }
      }
    }


    return task;
  });
  graph = GraphFactory.create(jsTemplate(graph, params));

  graph.tasks = graph.tasks.map(function(task) {
    task.taskId = slugid.v4();
    return task;
  });

  var id = slugid.v4();
  debug('create graph', {
    id: id,
    graph: JSON.stringify(graph)
  });

  var scheduler = new Scheduler({
    credentials: {
      clientId: runtime.config.taskclusterConfig.clientId,
      accessToken: runtime.config.taskclusterConfig.accessToken
    }
  });
  var graphStatus = yield scheduler.createTaskGraph(id, graph);
  debug('scheduled graph', graphStatus);

  // Track each bug as an active integration. This lets us rebuild the integration branch when needed
  // and also notify successfully integrated coalesced bugs of landing.
  yield runtime.activeStore.startTracking(id, params);
};
