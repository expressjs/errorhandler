
process.env.NODE_ENV = 'test'

var after = require('after')
var assert = require('assert')
var errorHandler = require('..')
var http = require('http')
var request = require('supertest')
var util = require('util')

describe('errorHandler()', function () {
  it('should set nosniff header', function (done) {
    var server = createServer(new Error('boom!'))
    request(server)
      .get('/')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect(500, done)
  })

  describe('status code', function () {
    describe('when non-error status code', function () {
      it('should set the status code to 500', function (done) {
        var server = createServer({ status: 200 })
        request(server)
          .get('/')
          .expect(500, done)
      })
    })

    describe('when err.status exists', function () {
      it('should set res.statusCode', function (done) {
        var server = createServer({ status: 404 })
        request(server)
          .get('/')
          .expect(404, done)
      })
    })

    describe('when err.statusCode exists', function () {
      it('should set res.statusCode', function (done) {
        var server = createServer({ statusCode: 404 })
        request(server)
          .get('/')
          .expect(404, done)
      })
    })

    describe('when err.statusCode and err.status exist', function () {
      it('should prefer err.status', function (done) {
        var server = createServer({ statusCode: 400, status: 404 })
        request(server)
          .get('/')
          .expect(404, done)
      })
    })
  })

  describe('error value', function () {
    describe('when Error object', function () {
      it('should use "stack" property', function (done) {
        var error = new TypeError('boom!')
        var server = createServer(error)
        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, error.stack.toString(), done)
      })
    })

    describe('when string', function () {
      it('should pass-through string', function (done) {
        var server = createServer('boom!')
        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, 'boom!', done)
      })
    })

    describe('when number', function () {
      it('should stringify number', function (done) {
        var server = createServer(42.1)
        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, '42.1', done)
      })
    })

    describe('when object', function () {
      it('should use util.inspect', function (done) {
        var server = createServer({ hop: 'pop' })
        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, '{ hop: \'pop\' }', done)
      })
    })

    describe('with "toString" property', function () {
      it('should use "toString" value', function (done) {
        var server = createServer({ toString: function () { return 'boom!' } })
        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, 'boom!', done)
      })
    })
  })

  describe('response content type', function () {
    var error
    var server

    before(function () {
      error = new Error('boom!')
      error.description = 'it went this way'
      server = createServer(error)
    })

    describe('when "Accept: text/html"', function () {
      it('should return a html response', function (done) {
        request(server)
          .get('/')
          .set('Accept', 'text/html')
          .expect('Content-Type', /text\/html/)
          .expect(/<title>Error: boom!<\/title>/)
          .expect(/<h2><em>500<\/em> Error: boom!<\/h2>/)
          .expect(/<li> &nbsp; &nbsp;at/)
          .expect(500, done)
      })

      it('should contain inspected object', function (done) {
        request(createServer({ foo: 'bar', fizz: 'buzz' }))
          .get('/')
          .set('Accept', 'text/html')
          .expect('Content-Type', /text\/html/)
          .expect(/<title>Error<\/title>/)
          .expect(/<h2><em>500<\/em> Error<\/h2>/)
          .expect(/<li>{ foo: &#39;bar&#39;, fizz: &#39;buzz&#39; }<\/li>/)
          .expect(500, done)
      })
    })

    describe('when "Accept: application/json"', function () {
      it('should return a json response', function (done) {
        var body = {
          error: {
            message: 'boom!',
            description: 'it went this way',
            stack: error.stack.toString()
          }
        }

        request(server)
          .get('/')
          .set('Accept', 'application/json')
          .expect('Content-Type', /application\/json/)
          .expect(500, body, done)
      })
    })

    describe('when "Accept: text/plain"', function () {
      it('should return a plain text response', function (done) {
        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect('Content-Type', /text\/plain/)
          .expect(500, error.stack.toString(), done)
      })
    })

    describe('when "Accept: x-unknown"', function () {
      it('should return a plain text response', function (done) {
        request(server)
          .get('/')
          .set('Accept', 'x-unknown')
          .expect('Content-Type', /text\/plain/)
          .expect(500, error.stack.toString(), done)
      })
    })
  })

  describe('headers sent', function () {
    var server

    before(function () {
      var _errorHandler = errorHandler()
      server = http.createServer(function (req, res) {
        res.end('0')
        process.nextTick(function () {
          _errorHandler(new Error('boom!'), req, res, function (error) {
            process.nextTick(function () {
              throw error
            })
          })
        })
      })
    })

    it('should not die', function (done) {
      request(server)
        .get('/')
        .expect(200, done)
    })
  })

  describe('console', function () {
    var _consoleerror

    before(function () {
      _consoleerror = console.error
      process.env.NODE_ENV = ''
    })
    afterEach(function () {
      console.error = _consoleerror
      process.env.NODE_ENV = 'test'
    })

    it('should output error', function (done) {
      var cb = after(2, done)
      var error = new Error('boom!')
      var server = createServer(error)

      console.error = function () {
        var log = util.format.apply(null, arguments)

        if (log !== error.stack.toString()) {
          return _consoleerror.apply(this, arguments)
        }

        cb()
      }

      request(server)
        .get('/')
        .set('Accept', 'text/plain')
        .expect(500, error.stack.toString(), cb)
    })
  })
})

describe('errorHandler(options)', function () {
  describe('log', function () {
    it('should reject a string', function () {
      assert.throws(errorHandler.bind(null, { log: 'yes, please' }), /option log must be/)
    })

    describe('when "undefined"', function () {
      var _consoleerror

      before(function () {
        _consoleerror = console.error
      })
      afterEach(function () {
        console.error = _consoleerror
      })

      describe('when NODE_ENV == test', function () {
        alterEnvironment('NODE_ENV', 'test')

        it('should produce no output', function (done) {
          var error = new Error('boom!')
          var server = createServer(error)

          console.error = function () {
            var log = util.format.apply(null, arguments)

            if (log !== error.stack.toString()) {
              return _consoleerror.apply(this, arguments)
            }

            done(new Error('console.error written to'))
          }

          request(server)
            .get('/')
            .set('Accept', 'text/plain')
            .expect(500, error.stack.toString(), done)
        })
      })

      describe('when NODE_ENV != test', function () {
        alterEnvironment('NODE_ENV', '')

        it('should write to console', function (done) {
          var cb = after(2, done)
          var error = new Error('boom!')
          var server = createServer(error)

          console.error = function () {
            var log = util.format.apply(null, arguments)

            if (log !== error.stack.toString()) {
              return _consoleerror.apply(this, arguments)
            }

            cb()
          }

          request(server)
            .get('/')
            .set('Accept', 'text/plain')
            .expect(500, error.stack.toString(), cb)
        })
      })
    })

    describe('when "true"', function () {
      var _consoleerror

      before(function () {
        _consoleerror = console.error
      })
      afterEach(function () {
        console.error = _consoleerror
      })

      it('should write to console', function (done) {
        var cb = after(2, done)
        var error = new Error('boom!')
        var server = createServer(error, { log: true })

        console.error = function () {
          var log = util.format.apply(null, arguments)

          if (log !== error.stack.toString()) {
            return _consoleerror.apply(this, arguments)
          }

          cb()
        }

        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, error.stack.toString(), cb)
      })
    })

    describe('when "false"', function () {
      var _consoleerror

      alterEnvironment('NODE_ENV', '')
      before(function () {
        _consoleerror = console.error
      })
      afterEach(function () {
        console.error = _consoleerror
      })

      it('should not write to console', function (done) {
        var error = new Error('boom!')
        var server = createServer(error, { log: false })

        console.error = function () {
          var log = util.format.apply(null, arguments)

          if (log !== error.stack.toString()) {
            return _consoleerror.apply(this, arguments)
          }

          done(new Error('console.error written to'))
        }

        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, error.stack.toString(), done)
      })
    })

    describe('when a function', function () {
      it('should call function', function (done) {
        var cb = after(2, done)
        var error = new Error('boom!')
        var server = createServer(error, { log: log })

        function log (err, str, req, res) {
          assert.strictEqual(err, error)
          assert.strictEqual(str, error.stack.toString())
          assert.strictEqual(req.url, '/')
          assert.strictEqual(res.statusCode, 500)
          cb()
        }

        request(server)
          .get('/')
          .set('Accept', 'text/plain')
          .expect(500, error.stack.toString(), cb)
      })
    })
  })
})

function createServer (error, options) {
  var _errorHandler = errorHandler(options)

  return http.createServer(function (req, res) {
    _errorHandler(error, req, res, function (err) {
      res.statusCode = err ? 500 : 404
      res.end(err ? 'Critical: ' + err.stack : 'oops')
    })
  })
}

function alterEnvironment (key, value) {
  var prev

  before(function () {
    prev = process.env[key]
    process.env[key] = value
  })
  after(function () {
    process.env[key] = prev
  })
}
