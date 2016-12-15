#!/usr/bin/env node
var server = require('../')
var path = require('path')
var fs = require('fs')
var argv = process.argv
var os = require('os')

var idx = argv.indexOf('--registry')
var reg = 'https://registry.npmjs.org'
if(idx > -1) {
  reg = argv[idx+1];
  argv.splice(idx,2)
}

// read registry token
var token = require('registry-auth-token')(reg)

var id = Date.now().toString(32)
var s = server({
  id:id,
  registry:reg,
  port:0,
  auth:token
})

// write stats to file.
var file = path.join(process.cwd(),'snpm-stats.log')
var ws = fs.createWriteStream(file,{flags:'a+'})

var messages = 0
server.logger = function(s){
  messages++
  ws.write(s+"\n")
}

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

  console.log('spawning npm with args:  ',original)

  spawn(getNpmExecutableName(), original, opts)
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

function getNpmExecutableName() {
  var npmExecutableName = 'npm'

  if (os.type() === 'Windows_NT') {
    npmExecutableName += '.cmd'
  }

  return npmExecutableName
}
