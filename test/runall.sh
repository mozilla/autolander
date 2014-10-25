#!/bin/bash -ve

./node_modules/mocha/bin/mocha --harmony \
	test/checkin_taskgraph_finished_test.js \
	test/pull_request_attaches_to_bug_test.js \
	test/pull_request_invalid_title_comment_test.js \
	;
