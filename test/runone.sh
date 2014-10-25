#!/bin/bash -ve

./test/setup.js;

./node_modules/mocha/bin/mocha --harmony test/$1;

./test/teardown.js;
