#!/usr/bin/env node
var util  = require('util'),
    exec = require('child_process').exec,
    cube = require("../../"),
    websocket = require("websocket"),
    program = require('commander');

program
  .version('0.0.1')
  .option('-h, --host [host]', 'specify host to use [localhost]', 'localhost')
  .option('-p, --port [port]', 'specify port to use [default]', null)
  .option('-d, --database [name]', 'specify database to use [cube_development]', 'cube_development')

program
  .command('types')
  .description('list event types in Cube')
  .action(function() {
    var cmd = 'mongo --quiet --eval "db.getCollectionNames()" '+program.database;
    exec(cmd, function(error, stdout, stderr) {
      stdout.split(',').forEach(function(collection) {
        var match = collection.replace(/\n/g, '').match(/(.+)_events$/);
        if (match) {
          console.log(match[1]);
        }
      });
    });
  });

program
  .command('type <name>')
  .description('create an event type in Cube')
  .action(function(name) {
    var mongo_js = '\
      var event = "'+name+'_events", metric = "'+name+'_metrics"; \
      db.createCollection(event); \
      db[event].ensureIndex({t: 1}); \
      db.createCollection(metric, {capped: true, size: 1e6, autoIndexId: false}); \
      db[metric].ensureIndex({e: 1, l: 1, t: 1, g: 1}, {unique: true}); \
      db[metric].ensureIndex({i: 1, e: 1, l: 1, t: 1}); \
      db[metric].ensureIndex({i: 1, l: 1, t: 1});';
    var cmd = 'echo "'+mongo_js.replace(/"/g,'\\"')+'" | mongo '+program.database;
    exec(cmd, function(error, stdout, stderr) {
      if (error !== null) {
        console.log('exec error: ' + error);
      } else {
        console.log("Created type '"+name+"'");
      }
    }); 
  });

program
  .command('event <type> <data>')
  .description('create an event in Cube')
  .action(function(type, data) {
    var port = program.port || 1080;
    var client = cube.emitter();
    client
      .open(program.host, port)
      .send({
        type: type,
        time: Date.now(),
        data: JSON.parse(data) 
      })
    setTimeout(client.close, 100);
  });

program
  .command('query <timeago> <step> <expression>')
  .description('perform a query in Cube')
  .action(function(timeago, step, expression) {
    deltaUnits = {
      'm': 60 * 1000,
      'h': 3600 * 1000,
      'd': 24 * 3600 * 1000}
    deltaSec = parseInt(timeago.substr(0,timeago.length-1)) * deltaUnits[timeago.substr(-1,1)];
    start = ISODateString(new Date(Date.now() - deltaSec));
    stop = ISODateString(new Date(Date.now()));
    query = {'expression': expression, 'start': start, 'stop': stop, 'step': step}
    console.log(JSON.stringify(query));
    var client = new websocket.client();
    client.on("connect", function(connection) { socket = connection; flush(); });
    client.on("connectFailed", reopen);
    client.connect(url);

  });

program.parse(process.argv);

function ISODateString(d) {
    function pad(n){
        return n<10 ? '0'+n : n
    }
    return d.getUTCFullYear()+'-'
    + pad(d.getUTCMonth()+1)+'-'
    + pad(d.getUTCDate())+'T'
    + pad(d.getUTCHours())+':'
    + pad(d.getUTCMinutes())+':'
    + pad(d.getUTCSeconds())+'Z'
}

