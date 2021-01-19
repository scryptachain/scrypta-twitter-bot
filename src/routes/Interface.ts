import express = require("express")
import * as Database from '../libs/Database'

export function rendervue(req: express.Request, res: express.res) {
    let fs = require('fs')
    fs.readFile('index.html', null, function (error, data) {
        if (error) {
            res.writeHead(404);
            res.write('Whoops! File not found!');
        } else {
            res.write(data);
        }
        res.end();
    });
};

export function returnLastTips(req: express.Request, res: express.res) {
    const db = new Database.Mongo
    db.find('tips', {}, {timestamp: -1}).then(tips => {
        res.send(tips)
    })
};