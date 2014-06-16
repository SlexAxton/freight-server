var spawn = require('child_process').spawn;
var path = require('path');

var Promise = require('bluebird');
var rimraf = require('rimraf');
var freight = require('freight')();

module.exports = function (log, conf, jobs) {
  function Tracker() {
  }

  jobs.process('check_repository', 1, function (job, done) {
    var repository = job.data.title;

    log.debug('Calling creates');

    return fetchRepository(repository)
      .then(function (projectDirectory) {
        var options = {
          // TODO: http(s)
          url: 'http://' + conf.get('ip') + ':' + conf.get('port') + '/',
          action: 'create',
          server: true,
          log: log,
          directory: projectDirectory,
          verbose: true
        };
        return freight.init(options)
          .then(
            function () {
              return new Promise(function (resolve, reject) {
                rimraf(projectDirectory, function (err) {
                  if (err) {
                    return reject(err);
                  }
                  log.debug('Directory Clean:', projectDirectory);
                  return resolve();
                });
              });
            }
          );
      })
      .then(
        function() {
          console.log('setting up another job');
          jobs.create('check_repository', { title: repository })
            .delay(1200000)
            .save();

          jobs.promote(1200000, 1);
          done();
        },
        function (err) {
          log.error(err);
          done(err);
        }
      );

  });

  Tracker.create = function (repository, callback) {
    log.debug('Calling create');
    var job = jobs.create('check_repository', { title: repository })
      .save();

    job.on('complete', function(result){
      console.log("Job completed with data ", result);
      callback(null);
    }).on('failed', function(){
      callback(new Error('Create failed'));
    })
  };

  function fetchRepository(repository) {
    return new Promise(function (resolve, reject) {
      var cloneDir = path.join(conf.get('tempDir'), 'clone' + Date.now());
      var cmd = 'git';
      var args = ['clone', repository, '--depth=1', cloneDir];
      var gitClone = spawn(cmd, args, { cwd: process.cwd() });

      gitClone.stdout.on('data', function (data) {
        if (data) {
          log.debug(data.toString());
        }
      });

      gitClone.stderr.on('data', function (data) {
        if (data) {
          log.debug(data.toString());
        }
      });

      gitClone.on('close', function (code) {
        if (code === 0) {
          resolve(cloneDir);
        } else {
          reject();
        }
      });
    });
  }

  return Tracker;
};