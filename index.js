#!/usr/bin/env node

//https://www.xormedia.com/git-check-if-a-commit-has-been-pushed/

const async = require('async');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const args = process.argv.slice(2);
const $path = path.resolve(args[0] || process.cwd());

const force = args.indexOf('--force') > -1;


const gitPaths = [];

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

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


async.map(gitPaths, function (item, cb) {

    const orig = String(path.normalize(item));
    var arr = item.split(path.sep);
    arr.pop();
    item = arr.join(path.sep);

    var command;

    if(force){

        if (os.platform() === 'win32') {
            command = 'cd ' + path.normalize(item);
        }
        else {
            command = 'cd ' + path.normalize(item) + ' && git add . && git add -A && git commit -am "auto-commit" && git push';
        }

        cp.exec(command, {}, function (err, data) {
            if (err) {
                console.error(err);
                cb(null);
            }
            else {
                var result = String(data).match(/^\s/);
                if (result) {
                    cb(null, orig);
                }
                else {
                    cb(null); ///
                }
            }
        });

    }
    else{
        if (os.platform() === 'win32') {
            command = 'cd ' + path.normalize(item);
        }
        else {
            command = 'cd ' + path.normalize(item) + ' && git status --short';
        }

        cp.exec(command, {}, function (err, data) {
            if (err) {
                cb(err);
            }
            else {
                var result = String(data).match(/^\s/);
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

        var allGood = true;
        results.filter(function (item) {
            return item && String(item).length > 0;
        }).forEach(function (item) {
            if(allGood){
                allGood = false;
                console.log('\nNostos: The following git repos have uncommitted material.');
            }
            console.log(' => ', item);
        });
        if(allGood){
            console.log('\nGiven the following path: '+ $path);
            console.log('We searched all directories below, and not one git repo has uncommitted code, you are all good.\n');
        }
        else{
            console.log('\n');
        }
    }

});


