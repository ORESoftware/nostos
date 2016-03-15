#!/usr/bin/env node

//https://www.xormedia.com/git-check-if-a-commit-has-been-pushed/
//http://stackoverflow.com/questions/2016901/viewing-unpushed-git-commits/30720302

//TODO: with verbose option, should log status of each git repo

const nopt = require('nopt');
const assert = require('assert');
const async = require('async');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const colors = require('colors/safe');
const _ = require('lodash');

const gitPaths = [];

const knownOpts = Object.freeze({
    force: Boolean,
    verbose: Boolean
});

const shorthands = Object.freeze({
    f: ['--force'],
    v: ['--verbose']
});


const parsedArgs = nopt(knownOpts, shorthands, process.argv, 2);

// user defined args
const force = parsedArgs.force;


var paths = [];

try {
    assert(parsedArgs.argv.remain.length > 0, 'No file path(s) provided.');
    paths.push.apply(paths, parsedArgs.argv.remain);
}
catch (err) {
    //nostos cmd utility is using your current working directory, b/c you did not pass in a path
    //TODO should verify with user to use CWD to search?
    paths.push(process.cwd());
}

paths = paths.map(function (p) {
    return p && path.resolve(path.normalize(p));
});

var t = Date.now();
console.log('time before:', t);

paths.filter(function (p) {

    try {
        return fs.statSync(p) && path.isAbsolute(p);
    }
    catch (err) {
        console.log('\n', 'The following path was assumed to be a directory but it is not valid =>', '\n', colors.grey(p));
    }

}).forEach(function ($path, index) {

    console.log('index =>' + index + ', path =>' + $path);

    (function recurse(dir) {

        if (String(dir).match(/node_modules/)) {
            return;
        }

        //console.log('dir:', dir);

        var stat, p;

        try {
            stat = fs.statSync(path.resolve(dir));
        }
        catch (err) {
            return;
        }

        if (!stat.isDirectory()) {
            return;
        }

        function continueRecursion() {
            fs.readdirSync(dir).forEach(function (item) {
                recurse(path.resolve(path.normalize(dir + path.sep + item)));
            });
        }

        try {
            p = path.resolve(dir + path.sep + '.git');
            stat = fs.statSync(p);

            if (stat.isDirectory()) {  //TODO: sometimes .git is a file
                gitPaths.push(path.normalize(p));  //we stop recursion if we hit first .git dir on a path
            }
            else {
                continueRecursion();
            }
        }
        catch (err) {
            continueRecursion();
        }

    })($path);

});


console.log('time after:', Date.now() - t);
console.log('gitpaths =>');
gitPaths.forEach(item => console.log(item));

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
            async.waterfall([
                function (cb) {
                    const cmd = ('git branch & echo ### & git rev-parse --abbrev-ref --symbolic-full-name @{u}'); //
                    cp.exec(cmd, {cwd: $cwd}, function (err, stdout, stderr) {
                        if (err) {
                            cb(null, {
                                error: err
                            });
                        }
                        else {
                            if (parsedArgs.verbose) {
                                console.log(colors.cyan('Git repo current branch and upstream branch:'));
                                console.log(stdout);
                                console.log(stderr);
                            }
                            var result = String(stdout).match(/###/); //match any non-whitespace
                            var branch, remote, data;
                            if (result) {
                                result = String(stdout).split('###');
                                var name = result[0].trim().split(/\s/);
                                branch = name[name.length - 1].trim();
                                remote = result[1].trim();
                            }
                            var error = String(stderr).match(/Error/i);
                            if (error) {
                                cb(null, {
                                    error: stderr,
                                    root: orig,
                                    git: 'push'
                                });
                            }
                            else if (result) {
                                cb(null, remote);
                            }
                            else {
                                cb(null, {
                                    error: 'no result from git cmd'
                                });
                            }
                        }
                    });
                },
                function (data, cb) {
                    const cmd = ('git log --oneline ' + data + '..HEAD');   //git log --oneline origin/master..HEAD
                    cp.exec(cmd, {cwd: $cwd}, function (err, stdout, stderr) {
                        if (err) {
                            cb(null, {
                                error: err
                            });
                        }
                        else {
                            if (parsedArgs.verbose) {
                                console.log(colors.cyan('Git repo push status:'));
                                console.log(stdout);
                                console.log(stderr);
                            }
                            var result = String(stdout).match(/\S/); //match any non-whitespace
                            var error = String(stderr).match(/Error/i);
                            if (error) {
                                cb(null, {
                                    error: stderr,
                                    root: orig,
                                    git: 'push-status',
                                    result: null
                                });
                            }
                            else if (result) {  //we have an unpushed status
                                cb(null, {
                                    root: orig,
                                    git: 'push-status',
                                    result: stdout
                                });
                            }
                            else {
                                cb(null, {
                                    root: orig,
                                    git: 'push-status',
                                    result: null
                                });
                            }
                        }
                    });
                }
            ], function complete(err, result) {
                if (err) {
                    cb(null, {
                        error: err
                    });
                }
                else {
                    cb(null, {
                        result: result
                    });
                }

            });

        },
        function (cb) {
            const cmd = ('git status --short');
            cp.exec(cmd, {cwd: $cwd}, function (err, stdout, stderr) {
                if (err) {
                    cb(null, {
                        git: 'commit',
                        error: err,
                        result: null
                    });
                }
                else {
                    if (parsedArgs.verbose) {
                        console.log(colors.cyan('Git repo commit status (' + $cwd + '/.git) =>'));
                        console.log(stdout);
                        console.log(stderr);
                    }
                    var result = String(stdout).match(/\S/); //match any non-whitespace
                    var error = String(stderr).match(/Error/i); //sometimes there is just a warning...

                    if (error) {
                        cb(null, {
                            git: 'commit-status',
                            stderr: stderr,
                            root: orig,
                            result: null
                        });
                    }
                    else if (result) {   // result means there is uncommitted code
                        cb(null, {
                            git: 'commit-status',
                            root: orig,
                            result: result
                        });
                    }
                    else {
                        cb(null, {
                            git: 'commit-status',
                            root: orig,
                            result: null
                        });
                    }
                }
            });
        }

    ], function complete(err, results) {

        if (err) {
            console.error(err);
            cb(err);
        }
        else {

            var runPush = false;

            results.filter(function (item) {
                return item.result;   //note: result is defined if there is uncommitted or unpushed code
            }).forEach(function () {
                runPush = true;
            });

            if (force && runPush) {

                const cmd = 'git add . && git add -A && git commit -am "auto-commit" && git push';
                cp.exec(cmd, {cwd: $cwd}, function (err, stdout, stderr) {
                    if (err) {
                        err.root = orig;
                        cb(err);
                    }
                    else {
                        //TODO: if no upstream is defined, does stdout or stderr show "error"/"Error"??
                        const error1 = String(stdout).match(/Error/i);
                        const error2 = String(stderr).match(/Error/i);
                        if (error1 || error2) {
                            cb(null, {
                                root: orig,
                                error: (stdout + '\n' + stderr),
                                git: 'run-all',
                                push: false
                            });
                        }
                        else {
                            cb(null, {
                                root: orig,
                                push: true,
                                git: 'run-all'
                            });
                        }
                    }
                });
            }
            else if (force) {
                cb(null, {
                    push: null,
                    root: orig,
                    git: 'run-all'
                });
            }
            else if (runPush) {
                cb(null, {
                    push: null,
                    root: orig,
                    git: 'run-all'
                });
            }
            else {
                cb(null, {
                    root: orig,
                    push: null,
                    git: 'run-all'
                });
            }
        }
    });


}, function complete(err, results) {
    if (err) {
        if (String(err).match(/insufficient permission/i)) {
            console.error('\nInsufficient permission to run git commands, try sudo.\n');
        }
        else {
            console.error('Unexpected error, most likely at path=', err.root, '\n', err);  //is the sudo error here
        }
    }
    else {
        console.log('Results => \n', results);

        var allGood = true;

        results.filter(function (item) {
            return item && String(item).length > 0;

        }).forEach(function (item) {

            if (item.error) {
                allGood = false;
                console.log('\nNostos: The following project roots git errors.');
                console.log(' => ', JSON.stringify(item.root), '\n');
            }
            else if (item.push === null) {
                console.log('\nNostos: The following project experienced no errors, but were not pushed.');
                console.log(' => ', JSON.stringify(item.root), '\n');
            }
            else if (item.push === true) {
                allGood = false;
                console.log('\nNostos: The following project root had uncommitted or unpushed changes, and was pushed successfully.');
                console.log(' => ', JSON.stringify(item.root), '\n');
            }
            else if (item.push === false) {
                allGood = false;
                console.log('\nNostos warning: The following project experienced no errors, but were not pushed.');
                console.log(' => ', JSON.stringify(item.root), '\n');
            }
            else if (item.root) {
                allGood = false;
                console.log('\nNostos warning: The following project has uncommitted or unpushed code =>');
                console.log(' => ', JSON.stringify(item.root), '\n');
            }

        });

        if (allGood) {
            console.log('\nGiven the following path(s): ' + paths);
            console.log('We searched all git projects, and not one git repo has uncommitted/unpushed code, you are all good.\n');
        }
        else if (force) {
            if (parsedArgs.verbose) {
                console.log('The following repos were checked and covered by nostos:');
                paths.forEach(function (p) {
                    console.log(colors.blue(p), '\n');
                })
            }
            else {
                console.log('All git repos with uncommitted/unpushed code were successfully pushed.');
            }
        }
        else {

        }
    }

});


