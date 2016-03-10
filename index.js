/**
 * Created by amills001c on 3/9/16.
 */


const async = require('async');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const args = process.argv.slice(2);
const $path = args[0] || process.cwd();


const gitPaths = [];

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function recurse(dir) {

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

}

recurse($path);


async.map(gitPaths, function (item, cb) {

    const orig = String(path.normalize(item));
    var arr = item.split(path.sep);
    arr.pop();
    item = arr.join(path.sep);

    var command;
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
            console.log(data);
            var result = String(data).match(/^\s/);
            if (result) {
                cb(null, orig);
            }
            else {
                cb(null);
            }

        }
    });


}, function complete(err, results) {

    if (err) {
        console.log(err);
    }
    else {
        results.filter(function (item) {
            return item && String(item).length > 0;
        }).forEach(function (item) {
            console.log(item);
        });
    }

});


