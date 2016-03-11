#!/usr/bin/env node

//https://www.xormedia.com/git-check-if-a-commit-has-been-pushed/
//http://stackoverflow.com/questions/2016901/viewing-unpushed-git-commits/30720302

const nopt = require('nopt');
const assert = require('assert');
const async = require('async');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const debug = require('debug')('nostos:core');
const colors = require('colors/safe');
const _ = require('lodash');


const gitPaths = [];

const knownOpts = Object.freeze({
    force: Boolean
});

const shortHands = Object.freeze({
    f: ['--force']
});


const parsedArgs = nopt(knownOpts, shortHands, process.argv, 2);

debug(parsedArgs);

const force = parsedArgs.force;

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

var paths = [];

try {
    assert(parsedArgs.argv.remain.length > 0, 'No file path(s) provided.');
    paths.push.apply(paths, parsedArgs.argv.remain);
}
catch (err) {
    //console.log('nostos cmd utility is using your current working directory, b/c you did not pass in a path.');
    paths.push(process.cwd());
}

paths = paths.map(function (p) {

    return p && path.resolve(path.normalize(p));

});

paths.filter(function (p) {

    return p && path.isAbsolute(p);

}).forEach(function ($path, index) {

    debug('index =>' + index + ', path =>' + $path);

    (function recurse(dir) {

        var stat;

        try {
            fs.readdirSync(dir).forEach(function (item) {

                item = path.resolve(path.normalize(dir + '/' + item));

                if (endsWith(item, '.git')) {
                    gitPaths.push(item);  //we stop recursion if we hit first .git dir on a path
                }
                else {
                    stat = fs.statSync(item);
                    if (stat.isDirectory()) {
                        recurse(item);
                    }
                }

            });
        }
        catch (err) {
            console.log('\n', 'The following path was assumed to be a directory but it is not valid =>', '\n', colors.grey(dir));
        }

    })($path);

});


debug('gitpaths => \n' + gitPaths);

if (gitPaths.length < 1) {
    console.log('\n', colors.magenta('Warning => No git projects found given the root path(s) used =>'), '\n', colors.grey(paths.map(p => '"' + p + '"' + '\n')), '\n');
    return;
}

async.map(gitPaths, function (item, cb) {

    const orig = String(path.normalize(path.resolve(item + '/../')));  //sink one directory

    var $cwd;

    if (os.platform() === 'win32') {
        $cwd = path.normalize(orig);
    }
    else {
        $cwd = path.normalize(orig);
    }

    async.parallel([
        function (cb) {
            const c = ('git log --oneline origin/master..HEAD');
            cp.exec(c, {cwd: $cwd}, function (err, stdout, stderr) {
                if (err) {
                    cb(err);
                }
                else {
                    debug('stdout git log --oneline:', stdout);
                    debug('stderr git log --oneline:', stderr);
                    var result = String(stdout).match(/\S/); //match any non-whitespace
                    var error = String(stderr).match(/Error/i);
                    if (error) {
                        cb(null, {
                            error: stderr,
                            root: orig,
                            git: 'push'
                        });
                    }
                    else if (result) {
                        cb(null, orig);
                    }
                    else {
                        cb(null);
                    }
                }
            });

        },
        function (cb) {
            const c = ('git status --short');
            cp.exec(c, {cwd: $cwd}, function (err, stdout, stderr) {
                if (err) {
                    cb(err);
                }
                else {
                    debug('\nstdout status short:\n' + stdout);
                    debug('\nstderr status short:\n' + stderr);

                    var result = String(stdout).match(/\S/); //match any non-whitespace
                    var error = String(stderr).match(/Error/i);

                    if (error) {
                        cb(null, {
                            git: 'commit',
                            error: stderr,
                            root: orig
                        });
                    }
                    else if (result) {
                        cb(null, {
                            root: orig
                        });
                    }
                    else {
                        cb(null);
                    }
                }
            });
        }

    ], function complete(err, results) {

        if (err) {
            console.error(err);
        }
        else {
            var runPush = false;
            results = results.filter(function (item) {
                return item;
            }).forEach(function () {
                runPush = true;
            });

            if (force && runPush) {

                const c = 'git add . && git add -A && git commit -am "auto-commit" && git push';
                cp.exec(c, {cwd: $cwd}, function (err, stdout, stderr) {
                    if (err) {
                        console.error(err);
                        cb(err);
                    }
                    else {
                        debug('\nrun push stdout:\n' + stdout);   //TODO: if no upstream is defined, does stdout or stderr show "error" or "Error"??
                        debug('\nrun push stderr:\n' + stderr);
                        const error1 = String(stdout).match(/Error/i);
                        const error2 = String(stderr).match(/Error/i);
                        if (error1 || error2) {
                            cb(null, {
                                root: orig,
                                error: (stdout + '\n' + stderr),
                                git: 'run-all'
                            });
                        }
                        else {
                            cb(null, {
                                push: orig
                            });
                        }
                    }
                });
            }
            else if(force){  //
                cb(null, results);
            }
            else if (runPush) {
                cb(null, {
                    root: orig,
                    git: 'run-all'
                });
            }
            else {
                console.log('All git repos up to date.\n');
                cb(null);
            }
        }
    });


}, function complete(err, results) {
    if (err) {
        console.log(err);
    }
    else {
        debug('Results => \n', results);

        var allGood = true;

        results.filter(function (item) {

            return item && String(item).length > 0;

        }).forEach(function (item) {
            if (allGood) {
                allGood = false;
                console.log('\nNostos: The following project roots have uncommitted/unpushed material, or git errors, or both.');
            }
            console.log(' => ', JSON.stringify(item.root), '\n');
        });

        if (allGood) {
            console.log('\nGiven the following path(s): ' + paths);
            console.log('We searched all git projects, and not one git repo has uncommitted/unpushed code, you are all good.\n');
        }
        else {
            console.log('\n');
        }
    }

});


