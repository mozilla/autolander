var thunkify = require('thunkify');

/**
 * Subscribes to a bugId.
 * @param {Object} runtime
 * @param {Integer} bugId
 * @param {Object} event The github event.
 */
exports.subscribe = function *(runtime, bugId, event) {
  //runtime.pulseApi.send({command: 'subscribe', bugs: [bugId], since: ''});
  console.log('subscribe to bug? ', bugId);
};
