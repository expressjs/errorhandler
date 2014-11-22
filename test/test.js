
process.env.NODE_ENV = 'test';

var assert = require('assert')
var errorHandler = require('..')
var http = require('http')
var request = require('supertest');
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
    it('should set the status code to 500 if a non error status code was given', function (done) {
      var server = createServer({status: 200})
      request(server)
      .get('/')
      .expect(500, done)
    });

    it('should pass an error status code to the response object', function (done) {
      var server = createServer({status: 404})
      request(server)
      .get('/')
      .expect(404, done)
    });
  });

  describe('response content type', function () {
    var error
    var server

    before(function () {
        error = new Error('boom!')
        server = createServer(error)
    });

    it('should return a html response when html is accepted', function (done) {
      request(server)
      .get('/')
      .set('Accept', 'text/html')
      .expect('Content-Type', /text\/html/)
      .expect(/<title>/)
      .expect(/Error: boom!/)
      .expect(/ &nbsp; &nbsp;at/)
      .end(done)
    });

    it('should return a json response when json is accepted', function (done) {
      request(server)
      .get('/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /application\/json/)
      .end(function (err, res) {
        if (err) throw err;
        var errorMessage = JSON.parse(res.text);

        assert.strictEqual(typeof errorMessage, 'object')
        assert.deepEqual(Object.keys(errorMessage).sort(), ['error'])
        assert.deepEqual(Object.keys(errorMessage.error).sort(), ['message', 'stack'])

        done();
      });
    });

    it('should return a plain text response when json or html is not accepted', function (done) {
      request(server)
      .get('/')
      .set('Accept', 'bogus')
      .expect('Content-Type', /text\/plain/)
      .expect(500, error.stack.toString(), done)
    });
  });

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
      .expect(200, done);
    });
  });

  describe('write error to console.error', function () {
    var log
    var old

    before(function () {
      old = console.error
      console.error = function () {
        log = util.format.apply(null, arguments)
      }
      process.env.NODE_ENV = ''
    })
    beforeEach(function () {
      log = undefined
    })
    after(function () {
      console.error = old
      process.env.NODE_ENV = 'test'
    })

    it('should write stack', function (done) {
      var server = createServer(new Error('boom!'))
      request(server)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log.substr(0, 19), 'Error: boom!\n    at')
        done()
      })
    })

    it('should stringify primitive', function (done) {
      var server = createServer('boom!')
      request(server)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, 'boom!')
        done()
      })
    })

    it('should stringify plain object', function (done) {
      var server = createServer({hop: 'pop'})
      request(server)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, '{ hop: \'pop\' }')
        done()
      })
    })

    it('should stringify number', function (done) {
      var server = createServer(42)
      request(server)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, '42')
        done()
      })
    })

    it('should stringify plain object with toString', function (done) {
      var server = createServer({toString: function () { return 'boom!' }})
      request(server)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, 'boom!')
        done()
      })
    })
  })
})

function createServer(error) {
  var _errorHandler = errorHandler()

  return http.createServer(function (req, res) {
    _errorHandler(error, req, res, function (err) {
      res.statusCode = err ? 500 : 404
      res.end(err ? 'Critical: ' + err.stack : 'oops')
    })
  })
}
