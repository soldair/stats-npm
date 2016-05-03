#!/usr/bin/env node
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
  .version(require('../package.json').version)

var argv = yargs.argv
var server = require('../')
var s = server(argv)

s.on('listening',function(){
  console.log('listening on',this.niceAddress)
  console.log('please use this as your --registry config when running npm commands you want to collect stats on.')
  console.log("\t--registry "+this.niceAddress)
})
