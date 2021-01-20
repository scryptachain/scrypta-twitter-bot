import express = require("express")
import * as Database from '../libs/Database'
import * as Crypto from '../libs/Crypto'

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
    db.find('tips', {}, { timestamp: -1 }).then(tips => {
        res.send(tips)
    })
};

export function returnEndorsements(req: express.Request, res: express.res) {
    const db = new Database.Mongo
    db.find('followers', { "endorse": { "$exists": true } }, { timestamp: -1 }).then(async followers => {
        let endorsements = []
        const wallet = new Crypto.Scrypta
        for (let k in followers) {
            if (followers[k].endorse !== undefined) {
                for (let j in followers[k].endorse) {
                    if (followers[k].endorse[j].ignore === undefined || (followers[k].endorse[j].ignore !== undefined && followers[k].endorse[j].ignore === false)) {
                        let ticker = await wallet.checkAvailableCoin(followers[k].endorse[j].coin.replace('$', ''))
                        endorsements.push({
                            user: '@' + followers[k].screen_name,
                            searcher: followers[k].endorse[j].searcher,
                            coin: '$' + ticker,
                            tip: followers[k].endorse[j].tip
                        })
                    }
                }
            }
        }
        res.send(endorsements)
    })
};