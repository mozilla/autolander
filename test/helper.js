var childProcess = require('child_process');
var co = require('co');
var createRepo = require('./support/create_repo');
var debug = require('debug')('test:setup');
var deleteRepo = require('./support/delete_repo');
var spawn = childProcess.spawn;
var thunkify = require('thunkify');

debug('test setup');

var childProcesses = [];
var childServers = [];

process.on('exit', killChildProcesses);

function getTunnelUrl() {
  return function(fn) {
    var ngrok = childProcess.fork('./test/ngrok_runner.js')
    childProcesses.push(ngrok);
    ngrok.on('message', function(m) {
      debug('Url is:', m.url);
      fn(null, m.url);
    });
    ngrok.on('exit', function(data) {
      debug('ngrok exit ' + data);
    });
    ngrok.on('close', function(data) {
      debug('ngrok close ' + data);
    });
    ngrok.on('error', function(data) {
      debug('ngrok error ' + data);
    });
  };
}

/**
 * Kills all running child processes.
 */
function killChildProcesses() {
  debug('killing all child processes');
  childProcesses.forEach(function(child) {
    child.kill();
  });
  childProcesses = [];
  childServers = [];
};

/**
 * Starts the two necessary servers to run the tests.
 * Both the web and worker servers are started as a child process.
 */
exports.startTestServers = function() {
    debug('starting the web server and worker');
    var worker = spawn('node', [
        '--harmony',
        './bin/worker',
      ], {
      execArgv: ['--harmony'],
      stdio: 'inherit',
      env: process.env
    });
    childProcesses.push(worker);
    childServers.push(worker);

    var web = spawn('node', [
        '--harmony',
        './bin/web'
      ], {
      execArgv: ['--harmony'],
      stdio: 'inherit',
      env: process.env
    });
    childProcesses.push(web);
    childServers.push(web);
};

/**
 * Kills all running child servers.
 * This kills the web and worker servers.
 */
exports.killTestServers = function() {
  debug('killing all test servers');
  childServers.forEach(function(child) {
    // Remove the server process from being tracked in the master childProcesses list.
    var childProcessesIdx = childProcesses.indexOf(child);
    childProcesses.splice(childProcessesIdx, 1);

    // Kill the child server.
    child.kill();
  });
  childServers = [];
};

exports.setup = function *(runtime) {

  // Try to start from a clean slate.
  // Delete the repo if it exists.
  try {
    yield deleteRepo(runtime, 'autolander');
  } catch(e) {
    debug('could not delete repo', e);
  }

  debug('creating autolander-test repoitory');
  yield createRepo(runtime, 'autolander');
  var thunkTunnelUrl = thunkify(getTunnelUrl());
  var tunnelUrl = yield thunkTunnelUrl();

  // Developers can bypass the test server by running tests with NO_SERVER=1 npm test.
  // This is useful for debugging so you can spin up your own web/worker servers locally.
  if (!process.env.NO_SERVER) {
    exports.startTestServers();
  }

  debug('attaching github hook', tunnelUrl);
  yield runtime.sleep();
  var createHook = thunkify(runtime.githubApi.repos.createHook.bind(runtime.githubApi.repos));
  var hookReq = yield createHook({
    user: 'autolander',
    repo: 'autolander-test',
    name: 'web',
    active: true,
    events: [
      'push',
      'pull_request'
    ],
    config: {
      url: tunnelUrl,
      content_type: 'json'
    },
    token: runtime.config.githubConfig.token
  });
};

exports.teardown = function *(runtime) {
  // Commented out for now for testing.
  //yield deleteRepo(runtime, 'autolander');
  killChildProcesses();
};
