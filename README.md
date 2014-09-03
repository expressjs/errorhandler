# errorhandler

[![NPM version](https://badge.fury.io/js/errorhandler.svg)](http://badge.fury.io/js/errorhandler)
[![Build Status](https://travis-ci.org/expressjs/errorhandler.svg?branch=master)](https://travis-ci.org/expressjs/errorhandler)
[![Coverage Status](https://img.shields.io/coveralls/expressjs/errorhandler.svg?branch=master)](https://coveralls.io/r/expressjs/errorhandler)

Previously `connect.errorHandler()`.

## Install

```sh
$ npm install errorhandler
```

## API

### errorhandler()

Create new middleware to handle errors and respond with content negotiation.
This middleware is only intended to be used in a development environment, as
the full error stack traces will be send back to the client when an error
occurs.

## Example

```js
var connect = require('connect')
var errorhandler = require('errorhandler')

var app = connect()

if (process.env.NODE_ENV === 'development') {
  app.use(errorhandler())
}
```

## License

[MIT](LICENSE)
