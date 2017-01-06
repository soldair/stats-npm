var split = require('split2')
var t2 = require('through2')

var installations = {}
var requests = new Map()

var time = 0


var prev
process.stdin.pipe(split()).pipe(t2.obj(function(chunk,enc,cb){

  var o = JSON.parse(chunk)
  console.log(o)

  if(!time) {
    time = o.start
    console.log('start ',o.id)
  }

  

  if(o.type === 'request-start'){
    //requests.set(o.snpmid,o)
    console.log('request start ',o.snpmid)
  } else if(o.type === 'request'){
    //requests.delete(o.snpmid)
    console.log('request end',o.snpmid)
  }
  //render()
  cb()
}))


function render(){
  //var line = 
  for(request of requests) {
    
  }
}

