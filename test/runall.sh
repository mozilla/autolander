#!/bin/bash -ve

./node_modules/mocha/bin/mocha --harmony \
	test/pull_request_attaches_to_bug_test.js \
	test/pull_request_invalid_title_comment_test.js \
	test/pull_request_non_integrable_test.js \
	test/taskgraph_failure_test.js \
	test/taskgraph_success_test.js \
	test/without_taskgraph_finishes_test.js \
	;
