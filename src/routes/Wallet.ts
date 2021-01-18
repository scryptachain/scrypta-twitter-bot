import express = require("express")
import * as Crypto from '../libs/Crypto'
var redis = require("redis")
var db = redis.createClient()
const {promisify} = require('util')

export async function getinfo(req: express.Request, res: express.Response) {
    var wallet = new Crypto.Wallet;
    wallet.request('getinfo').then(function(info){
        res.json(info['result'])
    })
};