var config = require('./../../config/development');
var bugStore = require('./../../lib/bug_store');
var bugzilla = require('./../../lib/bugzilla');
var github = require('./../../lib/github');

/**
 * A runtime for testing for ease of including.
 */
module.exports = function * () {
  return {
    config: config,
    bugStore: yield bugStore.init(config),
    githubApi: yield github.init(config),
    bugzillaApi: yield bugzilla.init(config)
  };
};
