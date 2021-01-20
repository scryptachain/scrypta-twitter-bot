"use strict";
import * as Utilities from './Utilities'
let request = require("request")
const ScryptaCore = require('@scrypta/core')

module Crypto {

    export class Scrypta {

        public async request(method, params = []) {
            return new Promise(response => {
                var rpcuser = process.env.RPCUSER
                var rpcpassword = process.env.RPCPASSWORD
                var rpcendpoint = 'http://' + process.env.RPCADDRESS + ':' + process.env.RPCPORT
                if (process.env.DEBUG === "full") {
                    console.log('Connecting to ' + rpcendpoint + ' WITH ' + rpcuser + '/' + rpcpassword)
                }
                let req = {
                    url: rpcendpoint,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic ' + Buffer.from(rpcuser + ":" + rpcpassword).toString("base64")
                    },
                    body: JSON.stringify({
                        id: Math.floor((Math.random() * 100000) + 1),
                        params: params,
                        method: method
                    })
                };
                request(req, function (err, res, body) {
                    try {
                        if (process.env.DEBUG === "full") {
                            console.log(body)
                        }
                        response(JSON.parse(body))
                    } catch (err) {
                        response(body)
                    }
                });
            })
        }

        public async checkAvailableCoin(coin) {
            return new Promise(async response => {
                coin = coin.replace('$','')
                if (coin === 'LYRA') {
                    response('LYRA')
                } else if (coin.substr(0, 1) === '6') {
                    const scrypta = new ScryptaCore
                    const sidechains = await scrypta.get('/sidechain/list')
                    for (let k in sidechains.data) {
                        let sidechain = sidechains.data[k]
                        if (sidechain.address === coin) {
                            response(sidechain.genesis.symbol)
                        }
                    }
                } else {
                    response(false)
                }
            })
        }

        public async returnCoinAddress(coin) {
            return new Promise(async response => {
                coin = coin.replace('$','')
                if (coin === 'LYRA') {
                    response('LYRA')
                } else {
                    const scrypta = new ScryptaCore
                    const sidechains = await scrypta.get('/sidechain/list')
                    let found = false
                    for (let k in sidechains.data) {
                        let sidechain = sidechains.data[k]
                        if (sidechain.genesis.symbol === coin) {
                            found = sidechain.address
                        }
                    }
                    if (found === false) {
                        response(false)
                    } else {
                        response(found)
                    }
                }
            })
        }

        public sendLyra(privateKey, from, to, amount) {
            return new Promise(async response => {
                const scrypta = new ScryptaCore
                scrypta.staticnodes = true
                console.log('CHECKING BALANCE OF ' + from)
                let balance = await scrypta.get('/balance/' + from)
                if (balance.balance >= amount) {
                    try {
                        console.log('SENDING COINS FROM ' + from + ' TO ' + to)
                        let temp = await scrypta.importPrivateKey(privateKey, '-', false)
                        let sent = await scrypta.send(temp.walletstore, '-', to, amount)
                        if (sent !== false && sent !== null && sent.length === 64) {
                            response(sent)
                        } else {
                            response(false)
                        }
                    } catch (e) {
                        console.log("SENDING ERROR, WILL RETRY LATER")
                        response(false)
                    }
                }else{
                    response('NO_BALANCE')
                }
            })
        }

        public sendPlanum(privateKey, from, to, amount, sidechain) {
            return new Promise(async response => {
                const scrypta = new ScryptaCore
                scrypta.staticnodes = true
                scrypta.usePlanum(sidechain)
                console.log('CHECKING BALANCE OF ' + from)
                let balance = await scrypta.returnPlanumBalance(from)
                if (balance.balance >= amount) {
                    try {
                        console.log('SENDING TOKENS FROM ' + from + ' TO ' + to)
                        let temp = await scrypta.importPrivateKey(privateKey, '-', false)
                        let time = new Date().getTime()
                        let sent = await scrypta.sendPlanumAsset(temp.walletstore, '-', to, amount, '', '', time, true)
                        if (sent !== false && sent !== null && sent.length === 64) {
                            response(sent)
                        } else {
                            response(false)
                        }
                    } catch (e) {
                        console.log("SENDING ERROR, WILL RETRY LATER")
                        response(false)
                    }
                }else{
                    response('NO_BALANCE')
                }
            })
        }

    }

}

export = Crypto;