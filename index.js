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
const gitPaths = [];


const knownOpts = Object.freeze({
    force: Boolean
});

const shortHands = Object.freeze({
    f: ['--force']
});


const parsedArgs = nopt(knownOpts, shortHands, process.argv, 2);

console.log(parsedArgs);

const force = parsedArgs.force;

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

const paths = [];

try {
    assert(parsedArgs.argv.remain.length > 0, 'No file path(s) provided.');
    paths.push.apply(paths, parsedArgs.argv.remain);
}
catch (err) {
    console.log('Using current working directory.');
    paths.push(process.cwd());
}

paths.map(function (p) {

    return p && path.resolve(path.normalize(p));

}).filter(function (p) {

    return p && path.isAbsolute(p);

}).forEach(function ($path, index) {

    console.log('$path:', $path);

    (function recurse(dir) {

        var stat;

        fs.readdirSync(dir).forEach(function (item) {

            item = path.resolve(path.normalize(dir + '/' + item));

            if (endsWith(item, '.git')) {
                gitPaths.push(item);
            }
            else {
                stat = fs.statSync(item);
                if (stat.isDirectory()) {
                    recurse(item);
                }
            }

        });

    })($path);

});


console.log('gitpaths =', gitPaths);

async.map(gitPaths, function (item, cb) {

    const orig = String(path.normalize(path.resolve(item + '/../')));

    var $cwd;

    if (force) {

        if (os.platform() === 'win32') {
            $cwd = path.normalize(orig);
        }
        else {
            $cwd = path.normalize(orig);
        }

        async.parallel([
            function (cb) {
                const c = ('git log --oneline origin/master..HEAD');
                console.log('c1:', c);
                cp.exec(c, {cwd: $cwd}, function (err, stdout, stderr) {
                    if (err) {
                        cb(err);
                    }
                    else {
                        console.log('stdout git log --oneline:', stdout);
                        console.log('stderr git log --oneline:', stderr);
                        var result = String(stdout).match(/\S/); //match any non-whitespace
                        var error = String(stderr).match(/\S/); //match any non-whitespace
                        if (error) {
                            cb(stderr);
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
                console.log('c2:', c);
                cp.exec(c, {cwd: $cwd}, function (err, stdout, stderr) {
                    if (err) {
                        cb(err);
                    }
                    else {
                        console.log('stdout status short:', stdout);
                        console.log('stderr status short:', stderr);
                        var result = String(stdout).match(/\S/); //match any non-whitespace
                        var error = String(stderr).match(/\S/); //match any non-whitespace

                        if (error) {
                            cb(stderr);
                        }
                        else if (result) {
                            cb(null, orig);
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
                results.filter(function (item) {
                    return item;
                }).forEach(function () {
                    runPush = true;
                });

                if (runPush) {

                    const c = 'git add . && git add -A && git commit -am "auto-commit" && git push';

                    cp.exec(c, {cwd: $cwd}, function (err, stdout, stderr) {
                        if (err) {
                            console.error(err);
                            cb(null);
                        }
                        else {
                            console.log('stdout:', stdout);
                            console.log('stderr:', stderr);
                            const error1 = String(stdout).match(/Error/i);
                            const error2 = String(stderr).match(/Error/i);
                            if (error1 || error2) {
                                cb(null, orig);
                            }
                            else {
                                cb(null);
                            }
                        }
                    });
                }
                else {
                    console.log('All git repos up to date.\n');
                }
            }
        });


    }
    else {

        var c = os.platform() === 'win32' ? 'cd ' + path.normalize(orig) :
        'cd ' + path.normalize(orig) + ' && git status --short';


        cp.exec(c, {}, function (err, stdout, stderr) {
            if (err) {
                cb(err);
            }
            else {
                const result = String(stdout).match(/\S/); //match any non-whitespace
                const error = String(stderr).match(/Error/i); //match any non-whitespace
                if (error) {
                    cb(err);
                }
                if (result) {
                    cb(null, orig);
                }
                else {
                    cb(null);
                }
            }
        });
    }


}, function complete(err, results) {
    if (err) {
        console.log(err);
    }
    else {
        console.log('Results:', results);

        var allGood = true;

        results.filter(function (item) {

            return item && String(item).length > 0;

        }).forEach(function (item) {
            if (allGood) {
                allGood = false;
                console.log('\nNostos: The following git repos have uncommitted material.');
            }
            console.log(' => ', item);
        });

        if (allGood) {
            console.log('\nGiven the following path(s): ' + paths);
            console.log('We searched all directories below, and not one git repo has uncommitted code, you are all good.\n');
        }
        else {
            console.log('\n');
        }
    }

});


