#!/bin/bash -ve

./node_modules/mocha/bin/mocha --harmony $(find test -name '*_test.js') $@;
