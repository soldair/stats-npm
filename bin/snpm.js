#!/usr/bin/env node
var server = require('../')
var path = require('path')
var fs = require('fs')
var argv = process.argv
var rc = require('rc')


var npmrc = rc('npm', {registry: 'https://registry.npmjs.org/',port:8770})


var idx = argv.indexOf('--registry')
var reg = npmrc.registry

if(idx > -1) {
  reg = argv[idx+1];
  argv.splice(idx,2)
}

// need port because this action needs auth saved in npmrc
// todo work around this!!!

var idx = argv.indexOf('--port')
var port = npmrc.port
if(idx > -1) {
  port = +argv[idx+1];
  argv.splice(idx,2)
}

// LOAD PRIVATE AND PUBLIC KEYS.
// PROBABLY ONLY WORKS FOR ME

if(npmrc['ssh-key']) {

  privateKeyPath = path.resolve(process.env.HOME,npmrc['ssh-key'])
  publicKeyPath = path.resolve(process.env.HOME,npmrc['ssh-public-key'])

  try{
    var pk = fs.readFileSync(privateKeyPath)
    var pub = fs.readFileSync(publicKeyPath)
  } catch(e){
    console.error('error loading private or public keys.\nplease make sure `npm config get ssh-key` and `npm config get ssh-public-key` point to real files.\n delete these config values if you do not want to use package signing.') 
  }

}
// read registry token
var token = require('registry-auth-token')(reg)

var id = Date.now().toString(32)
var s = server({
  id:id,
  registry:reg,
  port:port,
  auth:token,
  pk:pk,
  pub:pub
})

// write stats to file.
var file = path.join(process.env.HOME||process.cwd(),'snpm-stats.log')
var ws = fs.createWriteStream(file,{flags:'a'})

var messages = 0
server.logger = function(s){

  messages++
  ws.write(s+"\n")
}

var npmProc;

s.on('listening',function(){
  var spawn = require('child_process').spawn;
  var opts = {
    cwd: process.cwd,
    env: process.env,
    stdio: 'inherit',
  };

  var time = Date.now()

  var original = process.argv.slice(2);
  original.push('--registry',this.niceAddress)
  npmProc = spawn('npm', original, opts)
  .on('exit',function(code){ 
    s.close()
    if(!messages) {
      console.error('npm didn\'t make any requests. no stats to report.')
      process.exit(code) 
    } else {
      ws.write(JSON.stringify({id:id,type:"exit",elapsed:Date.now()-time,start:time,end:Date.now(),code:code,argv:argv.slice(2)}))
      ws.on('close',function(){
        console.error('npm stats written to '+file)
        process.exit(code); 
      })
      ws.end()
    }
  });
})

process.on('uncaughtException',function(e){
  npmProc.kill()
  console.error(e)
  console.error(e.stack)
  process.exit(1)
})
