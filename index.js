var request = require('request')
var xtend = require('xtend')
var url = require('url')
var http = require('http')
var yargs = require('yargs')
var cleanMetadata = require('normalize-registry-metadata')
var sign = require('./lib/sign')


// just in case.
http.globalAgent.maxSockets = Infinity
require('https').globalAgent.maxSockets = Infinity

var activeRequests = 0
var address
var tarball
var started = 0
var ended = 0 

module.exports = function(argv){
 
  var s = http.createServer(function(req,res){
    req.id = argv.id || 0
    if(argv.token) {
      req.headers.authorization = 'Bearer '+argv.token
    }
    
    var buf = []

    if(req.method !== 'PUT') return proxy(argv.registry,req,res)

    req.on('data',function(b){

      buf.push(b)

    }).on('end',function(){

      buf = Buffer.concat(buf)
      try {
        var data = JSON.parse(buf)
      } catch(e) {}
      data = data||{}

      // not a publish
      if(!data._attachments) {
        req.ended = true
        req.buf = buf
        proxy(argv.registry,req,res)
        return
      }

      var tars = Object.keys(data._attachments)

      var tar = tars[0]

      // 
      // i have to find the attachment
      // find the version that the attachment is in
      // replace the proxy hostname with the registry hostname in the tarball url
      // pull the shasum with that version and sign it
      // set the signature header
      // set the pub shasum header
      // send it off.
      //

      var found;
      var shasum
      Object.keys(data.versions).forEach(function(v){
        var version = data.versions[v]
        var parsed = url.parse(version.dist.tarball)
        version.dist.tarball = url.resolve(argv.registry,parsed.pathname)
        var match = version.dist.tarball.substr(version.dist.tarball.length-tar.length);

        if(match === tar){
          found = version
          shasum = version.dist.shasum
        }
      })

      if(found && argv.pk) {
        // sign!
        var o = sign(argv.pk,argv.pub,shasum)  
        req.headers['x-rsa-signature'] = o.signature
        req.headers['x-rsa-pub-shasum'] = o.pubSha
      }

      req.buf = new Buffer(JSON.stringify(data))
      req.headers['content-length'] = req.buf.length
      req.ended = true;

      proxy(argv.registry,req,res)

    })
    
    //proxy(argv.registry,req,res)
    started++;
  }).listen(argv.port,function(err){
    if(err) throw err
    address = 'http://'+(argv.host?argv.host:'localhost:'+this.address().port)
    var parsed = url.parse(address)
    tarball = {host:parsed.host,protocol:parsed.protocol}

    this.niceAddress = address;
  })

  return s
}



module.exports.logger = console.log

function proxy(host,req,res,_attempts){
  if(!_attempts) activeRequests++;

  _attempts = _attempts || []
  var uri = req.url

  var headers = xtend({},req.headers) 
  if(!host) throw new Error("host required to proxy!")
  delete headers.host

  // must turn off keep-alive or everything hangs very quickly.
  headers.connection = 'close'

  var cpyOfHeaders = xtend({},headers)
  cpyOfHeaders.authorization = '[REDACTED]'
  console.log('sending headers: ',cpyOfHeaders)

  var time = Date.now()
  var finished = false
  var started = false

  var s = request(url.resolve(host,req.url),{method:req.method,headers:headers})
  s.on('response',function(pres){

    console.log('FROM '+host+' server response! ',pres.statusCode)

    // started sending response.
    started = true;
    Object.keys(pres.headers).forEach(function(k){
      //if(k === 'etag') pres.headers[k] += '-proxy'
      res.setHeader(k,pres.headers[k])
    })

    res.statusCode = pres.statusCode
    res.responseHeaders = pres.headers
    pres.on('error',function(err){
      console.log('proxy respone error ',err)
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

        console.log('REGISTRY RESPONSE',buf+'')
        if(o && o.name && o.versions){
          // im probably package metadata!
          var cleaned = cleanMetadata(o,{tarballUrl:tarball})
          if(cleaned) res.end(JSON.stringify(cleaned))
          else res.end(JSON.stringify(o))
        } else {
          res.end(buf)
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
        if(!started) res.end()
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
    // already buffered response. now send it!
    //s.write(req.buf)
    s.end(req.buf)
    return s
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
    var e = new Error()

    if(finished) return;
    finished = true

    activeRequests--
    // do not leak token.
    delete headers.authorization
    _attempts.push({
      id:req.id,
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

    module.exports.logger(JSON.stringify(_attempts))
  }

}


function json(b){
  try{
    return JSON.parse(b)
  } catch(e){
  
  }
}


