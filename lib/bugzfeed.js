var thunkify = require('thunkify');

/**
 * Subscribes to a bugzfeed bug.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {Object} event The github event.
 */
exports.subscribe = function *(runtime, bugId, event) {
  runtime.bugzfeedApi.send({command: 'subscribe', bugs: [bugId], since: ''});
  console.log('subscribed to bug: ', bugId);
};
