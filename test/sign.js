var test = require('tape')
var fs = require('fs')
var sign = require('../lib/sign')

var ghkeys = require('github-keys-pem')

// PROBABLY ONLY WORKS FOR ME.
var pk = fs.readFileSync(process.env.HOME+'/.ssh/id_rsa')
var pub = fs.readFileSync(process.env.HOME+'/.ssh/id_rsa.pub')
// ssh-keygen -e -m PKCS8 -f ~/.ssh/id_rsa.pub > id_rsa.pub.pkcs8
var pubPem = fs.readFileSync(process.env.HOME+'/.ssh/id_rsa.pub.pkcs8')

test("can",function(t){
   
  var o = sign(pk,pub,'foo')

  console.log(o)


  t.ok(sign.verify(pubPem,o.signature,'foo'),'can verify!')

  ghkeys('soldair',function(err,keys){

    keys.forEach(function(k){
      console.log(o.pubSha+' '+k.sha+' : ',sign.verify(k.pem,o.signature,'foo'))
    })
    t.end()
  })
})
