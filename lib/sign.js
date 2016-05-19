var crypto = require('crypto')
var fs = require('fs')

module.exports = sign
function sign(pk,pub,data){

  pub = cleanPub(pub)

  var sign = crypto.createSign('RSA-SHA256');
  sign.write(data);
  sign.end();

  var sha = crypto.createHash('sha').update(pub).digest('hex')
  
  return {signature:sign.sign(pk, 'hex'),pubSha:sha}
}

module.exports.verify = verify

function verify(pubPem,sig,data){
  var verify = crypto.createVerify('RSA-SHA256');
  verify.write(data);
  verify.end();

  return verify.verify(new Buffer(pubPem), sig,'hex')
}


function cleanPub(pub){
  return (pub+'').split(' ').slice(0,2).join(' ')
}


