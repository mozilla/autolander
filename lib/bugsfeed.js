var thunkify = require('thunkify');

/**
 * Subscribes to a bugsfeed bug.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {Object} event The github event.
 */
exports.subscribe = function *(runtime, bugId, event) {
  runtime.bugsfeedApi.send(JSON.stringify({command: 'subscribe', bugs: [bugId], since: ''}));
  console.log('subscribed to bug: ', bugId);
};
