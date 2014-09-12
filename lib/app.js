var koa = require('koa');

module.exports = function* createApp() {
	var app = koa();
	app.use(require('koa-body-parser')());
	app.use(require('koa-trie-router')(app));

	var githubEvents = {
		pull_request: require('../routes/pull_request')()
	};

	app.post('/github', function * () {
    console.log('Request:', this.request.body);
	});

	return app;
}
