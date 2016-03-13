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

const shortHands = Object.freeze({
    f: ['--force'],
    v: ['--verbose']
});


const parsedArgs = nopt(knownOpts, shortHands, process.argv, 2);

// user defined args
const force = parsedArgs.force;


/////////

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

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

paths.filter(function (p) {

    return p && path.isAbsolute(p);

}).forEach(function ($path, index) {

    console.log('index =>' + index + ', path =>' + $path);

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


console.log('gitpaths => \n' + gitPaths);

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
            const cmd = ('git log --oneline origin/master..HEAD');
            cp.exec(cmd, {cwd: $cwd}, function (err, stdout, stderr) {
                if (err) {
                    cb(err);
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
                            git: 'push'
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

        },
        function (cb) {
            const cmd = ('git status --short');
            cp.exec(cmd, {cwd: $cwd}, function (err, stdout, stderr) {
                if (err) {
                    cb(err);
                }
                else {
                    if (parsedArgs.verbose) {
                        console.log(colors.cyan('Git repo commit status (' + $cwd + '/.git) =>'));
                        console.log(stdout);
                        console.log(stderr);
                    }
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
            cb(null);
        }
        else {

            var runPush = false;
            results.filter(function (item) {
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
                        //TODO: if no upstream is defined, does stdout or stderr show "error" or "Error"??
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
                                push: true,
                                root: orig
                            });
                        }
                    }
                });
            }
            else if (force) {  //
                cb(null, {
                    push: null,
                    root: orig
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
                cb(null);
            }
        }
    });


}, function complete(err, results) {
    if (err) {
         if(String(err).match(/insufficient permission/i)){
             console.error('\nInsufficient permission to run git commands, try sudo, and LOL have fun typing in your password for the 100th time this week.\n');
         }
        else{
             console.error('Unexpected error:\n', err);  //is the sudo error here
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
        else{

        }
    }

});


