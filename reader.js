var split = require('split2')
var t2 = require('through2')

var installations = {}
var requests = new Map()

var time = 0
var intervals = {}
var intervalms = 100
var count = 0

var prev
process.stdin.pipe(split()).pipe(t2.obj(function(chunk,enc,cb){

  var o = JSON.parse(chunk)

  var now = o.end||o.start

  var interval = Math.floor(now/intervalms)
  time = now;

  if(!intervals[interval]) {
    if(count++) render(interval,intervals)
    intervals[interval] = {} 
  }

  if(o.type === 'request-start'){
    intervals[interval][o.snpmid] = 1

    //console.log('request start ',o.snpmid)
  } else if(o.type === 'request'){
    //requests.delete(o.snpmid)
    //console.log('request end',o.snpmid)
  }
  cb()
},function(cb){
  // render the buffered interval.
  render(Math.floor(time/intervalms),intervals)
  cb()
}))


function render(interval, intervals){
  var keys = Object.keys(intervals)

  var first = keys[0]
  var requests = intervals[first]
  delete intervals[first]

  var s = interval+'\t:';
  Object.keys(requests).forEach(function(k){
    //requests[k]
    s += '|'
  })
  console.log(s)
}

