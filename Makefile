test:
	npm test

coverage:
	./node_modules/.bin/jscoverage --no-highlight lib lib-cov
	NODE_COV=1 ./node_modules/.bin/mocha -R html-cov ./test/*.js > coverage.html
	rm -rf ./lib-cov

.PHONY: test