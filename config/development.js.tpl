module.exports = {
  port: process.env.port || 80,
  token: '<yourtokenhere>',
  bugzillaConfig: {
    url: "https://bugzilla.mozilla.org/rest/",
    username: 'bugs@bugmail.com',
    password: ''
  },
  bugsfeedConfig: {
    url: 'ws://bugzfeed.mozilla.org/'
  }
}
