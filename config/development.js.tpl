function ENV(key) {
  return process.env[key]
}

module.exports = {
  port: ENV('PORT') || 80,
  amqpConfig: {
    autoDelete: true,
    exclusive: false,
    durable: false
  },
  azureConfig: {
    accountUrl: 'http://' + ENV('AZURE_ACCOUNT_NAME') + '.table.core.windows.net/',
    accountName: ENV('AZURE_ACCOUNT_NAME'),
    accountKey: ENV('AZURE_ACCOUNT_KEY')
  },
  githubConfig: {
    username: ENV('GITHUB_USERNAME'),
    token: ENV('GITHUB_TOKEN')
  },
  // A test user and token which does not have access to the autolander-test repo.
  // This is only used for testing support and does not need to be defined for production.
  githubTestUser: {
    username: ENV('GITHUB_TEST_USERNAME'),
    token: ENV('GITHUB_TEST_TOKEN')
  },
  bugzillaConfig: {
    url: 'https://bugzilla-dev.allizom.org/rest/',
    username: ENV('BUGZILLA_EMAIL'),
    password: ENV('BUGZILLA_PASSWORD')
  },
  // A test user which is not a suggested reviewer of any component.
  bugzillaTestUser1: {
    url: 'https://bugzilla-dev.allizom.org/rest/',
    username: ENV('BUGZILLA_TEST_USERNAME'),
    password: ENV('BUGZILLA_TEST_PASSWORD')
  },
  // Comma seperated list of supported products.
  // Should be removed once bug 1094926 is fixed.
  bugzillaSupportedProducts: ENV('BUGZILLA_SUPPORTED_PRODUCTS') || 'Firefox OS',
  pulseConfig: {
    url: 'amqp://public:public@pulse.mozilla.org',
    queueName: 'gaia-autolander-prod',
    exchange: 'exchange/bugzilla/simple'
  },
  taskclusterConfig: {
    name: ENV('TC_CLIENT_NAME'),
    clientId: ENV('TC_CLIENT_ID'),
    accessToken: ENV('TC_CLIENT_TOKEN')
  },
  taskPulseConfig: {
    username: ENV('TC_PULSE_USER'),
    password: ENV('TC_PULSE_PASSWORD')
  },
  treeherderConfig: {
    name: 'gaia-try',
    route: 'tc-treeherder-staging',
    baseUrl: ENV('TREEHERDER_URL') || 'https://treeherder.mozilla.org/',
    consumerKey: ENV('TREEHERDER_KEY'),
    consumerSecret: ENV('TREEHERDER_SECRET')
  }
}
