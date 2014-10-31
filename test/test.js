
process.env.NODE_ENV = 'test';

var assert = require('assert')
var connect = require('connect');
var errorHandler = require('..')
var http = require('http')
var request = require('supertest');
var util = require('util')

describe('errorHandler()', function () {
  var app, error, server;

  before(function () {
    app = connect();
    app.use(function (req, res, next) {
      next(error);
    });
    app.use(errorHandler());
    server = http.createServer(app).listen();
  });

  beforeEach(function () {
    error = null;
  });

  it('should set nosniff header', function (done) {
    error = new Error()
    request(server)
    .get('/')
    .expect('X-Content-Type-Options', 'nosniff')
    .expect(500, done)
  })

  describe('status code', function () {
    it('should set the status code to 500 if a non error status code was given', function (done) {
      error = {status: 200};
      request(server)
      .get('/')
      .expect(500, done)
    });

    it('should pass an error status code to the response object', function (done) {
      error = {status: 404};
      request(server)
      .get('/')
      .expect(404, done)
    });
  });

  describe('response content type', function () {
    beforeEach(function () {
        error = new Error('boom!');
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
    it('should not die', function (done) {
      var app = connect();
      var handler = errorHandler();
      app.use(function (req, res, next) {
        res.end('0');
        process.nextTick(function () {
          handler(new Error('msg'), req, res, function (error) {
            process.nextTick(function () {
              throw error;
            });
         });
       });
      });

      request(app)
      .get('/')
      .expect(200, done);
    });
  });

  describe('write error to console.error', function () {
    var app
    var error = null
    var log
    var old
    before(function () {
      old = console.error
      console.error = function () {
        log = util.format.apply(null, arguments)
      }
      process.env.NODE_ENV = ''
      app = connect()
      app.use(function (req, res, next) {
        next(error)
      })
      app.use(errorHandler())
    })
    beforeEach(function () {
      error = null
      log = undefined
    })
    after(function () {
      console.error = old
      process.env.NODE_ENV = 'test'
    })

    it('should write stack', function (done) {
      error = new Error('boom!')
      request(app)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log.substr(0, 19), 'Error: boom!\n    at')
        done()
      })
    })

    it('should stringify primitive', function (done) {
      error = 'boom!'
      request(app)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, 'boom!')
        done()
      })
    })

    it('should stringify plain object', function (done) {
      error = {hop: 'pop'}
      request(app)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, '{ hop: \'pop\' }')
        done()
      })
    })

    it('should stringify number', function (done) {
      error = 42
      request(app)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, '42')
        done()
      })
    })

    it('should stringify plain object with toString', function (done) {
      error = {toString: function () { return 'boom!' }}
      request(app)
      .get('/')
      .expect(500, function (err) {
        if (err) return done(err)
        assert.equal(log, 'boom!')
        done()
      })
    })
  })
})
