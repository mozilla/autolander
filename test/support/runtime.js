var config = require('./../../config/development');
var bugStore = require('./../../lib/bug_store');
var bugzilla = require('./../../lib/bugzilla');
var github = require('./../../lib/github');

var Promise = require('promise');

/**
 * A runtime for testing for ease of including.
 */
module.exports = function * () {
  return {
    config: config,
    bugStore: yield bugStore.init(config),
    githubApi: yield github.init(config),
    bugzillaApi: yield bugzilla.init(config),

    /**
     * Delays execution for a given time.
     * This is mostly used for polling, and also github APIs which are currently slow
     * and can cause testing problems if we poll them too quickly.
     * @param n=3000 The amount of time to sleep for.
     */
    sleep: function * (n) {
      n = n || 5000;
      return new Promise(function(accept) {
        return setTimeout(accept, n);
      });
    }
  };
};
