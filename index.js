var request = require('request')
var xtend = require('xtend')
var url = require('url')
var http = require('http')
var yargs = require('yargs')
var cleanMetadata = require('normalize-registry-metadata')

// just in case.
http.globalAgent.maxSockets = Infinity
require('https').globalAgent.maxSockets = Infinity

var yargs = require('yargs')
  .usage('$0 [options]')
  .option('port', {
    alias:'p',
    describe: 'port for server to listen on (8700).',
    default: 8700
  })
  .option('registry', {
    alias:'r',
    describe: 'npm registry to use. anonymous stats are sent to [registry]/-/api/v1/anon-stats',
    default: 'https://registry.npmjs.org'
  })
  .option('host', {
    describe: "the host you use to access this proxy. tarball urls are rewritten to this value. default is the ip address reported by server.address()"
  })
  .help('h')
  .alias('h', 'help')
  .version(require('./package.json').version)

var argv = yargs.argv
var activeRequests = 0

var address
var tarball

var started = 0
var ended = 0
http.createServer(function(req,res){
  proxy(argv.registry,req,res)
  started++;
}).listen(argv.port,function(err){
  if(err) throw err
  address = 'http://'+(argv.host?argv.host:'localhost:'+this.address().port)
  var parsed = url.parse(address)
  tarball = {host:parsed.host,protocol:parsed.protocol}
  console.log('started on ',address)
})

function proxy(host,req,res,_attempts){
  if(!_attempts) activeRequests++;

  _attempts = _attempts || []
  var uri = req.url

  var headers = xtend({},req.headers) 
  if(!host) throw new Error("host required to proxy!")
  delete headers.host

  // must turn off keep-alive or everything hangs very quickly.
  headers.connection = 'close'

  var time = Date.now()
  var finished = false
  var started = false

  var s = request(url.resolve(host,req.url),{method:req.method,headers:headers,agent:false})
  s.on('response',function(pres){
    // started sending response.
    started = true;
    Object.keys(pres.headers).forEach(function(k){
      //if(k === 'etag') pres.headers[k] += '-proxy'
      res.setHeader(k,pres.headers[k])
    })

    res.statusCode = pres.statusCode
    res.responseHeaders = pres.headers
    pres.on('error',function(err){
      // log failure.
      finished(err)
    })

    res.statusCode = pres.statusCode

    // stream tarball responses buffer everything else.
    if(!req.url.match(/.tgz$/)) {
      // if this is a package metadata request we need to rewrite the 
      // tarball url so npm will fetch the tarballs through this proxy
      var buf = []
      pres.on('data',function(b){
        buf.push(b)
      }).on('end',function(){
        buf = Buffer.concat(buf)
        var o = json(buf)
        if(!o) {
          // not json.
          res.end(buf)
        } else if(o.name && o.versions){
          // im probably package metadata!
          var cleaned = cleanMetadata(o,{tarballUrl:tarball})
          if(cleaned) res.end(JSON.stringify(cleaned))
          else res.end(JSON.stringify(o))
        }
        finish()
      })
      
    } else {

      // if econnreset happens after the response starts sending data this is really tough to catch.
      // im going to pipe as late as possible to make it so we can retry in more cases.
      pres.once('data',function(b){
        started = true
        res.write(b)
        pres.pipe(res)
      }).on('end',function(){
        // all done success!!
        finish()
      })

    }
  }).on('error',function(err){
    if(!started) {
      
      res.statusCode = 500
      return res.end(JSON.stringify({message:"error passing request"}))
    }
  }) 

  if(req.ended) {
    // retry
    s.write(Buffer.concat(req.buf))
    s.end()
  }

  req.buf = []
  req.on('data',function(b){
    // buffer whole request data
    req.buf.push(b)
  }).on('end',function(){
    req.ended = true
    req.buf = Buffer.concat(req.buf)
    s.write(req.buf)
    s.end()
  }).on('error',function(err){
    // do not retry we did not get whole request body.
    started = true;
    finish(err)
  })

  return s


  function finish(err){
    if(finished) return;
    finished = true

    activeRequests--
    // do not leak token.
    delete headers.authorization
    _attempts.push({
      elapsed:Date.now()-time,
      start:time,
      end:Date.now(),
      error:err,
      status:res.statusCode,
      url:req.url,
      method:req.method,
      host:host,
      requests:activeRequests,
      body:req.buf.length,
      reqHeaders:headers,
      resHeaders:res.responseHeaders
    })

    if(!started && _attempts.length < 4) {
      return proxy(host,req,res,_attempts) 
    }

    //log it!!!

    if(err) {
      res.statusCode = 500
      res.end(JSON.stringify({message:"failed after many attempts. ",attempts:_attempts}))
    }

    console.log(JSON.stringify(_attempts))
  }

}



function json(b){
  try{
    return JSON.parse(b)
  } catch(e){
  
  }
}


