import express = require("express")
var twit = require('twit')
var CoinKey = require('coinkey')
var twitterlogin = require("node-twitter-api")
var config = require('../config.js')
import * as Crypto from '../libs/Crypto'
import * as Database from '../libs/Database'
var testmode = process.env.TESTMODE.toLowerCase() == 'true' ? true : false;

if (testmode === true) {
    console.log('\x1b[33m%s\x1b[0m', 'RUNNING IN TEST MODE')
}

if (config.access_token !== undefined && config.access_token_secret !== undefined) {
    var Twitter = new twit(config);
}

const coinInfo = {
    private: 0xae,
    public: 0x30,
    scripthash: 0x0d
};

var _requestSecret
if (process.env.TWITTER_CONSUMERKEY !== undefined && process.env.TWITTER_CONSUMERSECRET !== undefined) {
    var twtlogin = new twitterlogin({
        consumerKey: process.env.TWITTER_CONSUMERKEY,
        consumerSecret: process.env.TWITTER_CONSUMERSECRET,
        callback: process.env.URL + '/twitter/callback'
    });
} else {
    console.log('\x1b[41m%s\x1b[0m', 'SETUP TWITTER FIRST!')
}

function sleep(ms) {
    return new Promise(response => {
        setTimeout(function () {
            response(true)
        }, ms)
    })
}

export function getAuth(req: express.Request, res: express.res) {
    twtlogin.getRequestToken(function (err, requestToken, requestSecret) {
        if (err)
            res.status(500).send(err);
        else {
            _requestSecret = requestSecret;
            res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
        }
    });
}

export function getAccessToken(req: express.Request, res: express.res) {
    var requestToken = req.query.oauth_token,
        verifier = req.query.oauth_verifier;

    twtlogin.getAccessToken(requestToken, _requestSecret, verifier, function (err, accessToken, accessSecret) {
        if (err) {
            res.status(500).send(err);
        } else {
            twtlogin.verifyCredentials(accessToken, accessSecret, async function (err, user) {
                if (err) {
                    res.status(500).send(err);
                } else {
                    if (process.env.TWITTER_ACCESSTOKEN === undefined) {
                        res.send({
                            user
                        });
                        const fs = require('fs');
                        fs.appendFile('.env', "\r\n" + 'TWITTER_ACCESSTOKEN=' + accessToken, function (err) {
                            console.log('ACCESS TOKEN WRITTEN')
                        })
                        fs.appendFile('.env', "\r\n" + 'TWITTER_TOKENSECRET=' + accessSecret, function (err) {
                            console.log('TOKEN SECRET WRITTEN')
                        })
                        fs.appendFile('.env', "\r\n" + 'TWITTER_USERNAME=' + user.screen_name, function (err) {
                            console.log('USERNAME WRITTEN')
                        })
                    } else {
                        const db = new Database.Mongo
                        let userDB = await db.find('followers', { id: user.id })
                        if (userDB !== null && userDB.address !== undefined) {
                            if (userDB.prv !== undefined) {
                                res.send("<div style='padding: 30px;'>You're connected with the address <b>" + userDB.address + "</b><br>which have been created by us.<br>The private key is: " + userDB.prv + ".<br><br><span style='color:#f00'>You should change your address by tweeting: `#scryptabot address YourLyraAddress`</span><br><br>Don't remember to import your private key into Manent or Scrypta Core Wallet!</div>")
                            } else {
                                res.send("<div style='padding: 30px;'>You're connected with the address <b>" + userDB.address + "</b><br><br><span style='color:green'>Well done! You have connected your address :-)</span></div>")
                            }
                        } else {
                            res.send("I'm sorry, but i can't find your user. Interact with @scryptachain or tweet your address tweeting `#scryptabot address YourLyraAddress`")
                        }
                    }
                }
            });
        }
    });

}

export async function followers(twitter_user) {
    return new Promise(async response => {
        const db = new Database.Mongo
        console.log('LOOKING FOR @' + twitter_user + ' FOLLOWERS')
        Twitter.get('followers/list', { screen_name: twitter_user, count: 30 }, async function (err, data) {
            if (!err) {
                var followers = data.users
                var newfollowers = 0
                for (var index in followers) {
                    var user_follow = followers[index].id
                    var user_mention_followers = followers[index].followers_count
                    if (user_mention_followers >= process.env.MIN_FOLLOWERS) {
                        let check = await db.find('followers', { id: user_follow })
                        if (check === null || check.address === undefined) {
                            var user_registration = new Date(followers[index].created_at)
                            var now = new Date();
                            var diff = now.getTime() - user_registration.getTime();
                            var elapsed = diff / (1000 * 60 * 60 * 24)
                            if (elapsed >= parseInt(process.env.MIN_DAYS)) {
                                newfollowers++
                                console.log('NEW FOLLOWER: ' + followers[index].screen_name + '!')
                                await tipuser(followers[index], 'FOLLOW', twitter_user, process.env.TIP_FOLLOW, process.env.COIN)
                            } else {
                                console.log('USER ' + user_follow + ' IS TOO YOUNG.')
                            }
                        }
                    } else {
                        console.log('USER ' + followers[index].screen_name + ' DON\'T HAVE THE REQUIRED FOLLOWERS (' + user_mention_followers + ')')
                    }
                }
                console.log('FOUND ' + newfollowers + ' NEW FOLLOWERS!')
                response(true)
            } else {
                console.log('ERROR WHILE GETTING FOLLOWERS LIST!', err.message)
                response(false)
            }
        })
    })
};

export async function tag(tag, twitter_user) {
    return new Promise(async response => {
        const db = new Database.Mongo
        console.log('LOOKING FOR TAG: ' + tag)
        Twitter.get('search/tweets', { q: tag }, async function (err, data) {
            if (!err) {
                var found = data.statuses
                var mentions = []
                for (var index in found) {
                    if (found[index].user !== twitter_user) {
                        mentions.push(found[index])
                    }
                }
                var newmentions = 0
                for (var index in mentions) {
                    // console.log('\x1b[42m%s\x1b[0m', mentions[index].text,  mentions[index].user.screen_name)
                    var user_mention = mentions[index].user.screen_name
                    var user_id = mentions[index].user.id
                    var user_mention_followers = mentions[index].user.followers_count
                    if (user_mention_followers >= process.env.MIN_FOLLOWERS) {
                        var mention_id = mentions[index]['id_str']
                        var tipped = await db.find('mentions', { mention_id: mention_id, user_id: user_id })
                        if (tipped === null && user_mention !== process.env.TWITTER_USERNAME) {
                            var user_registration = new Date(mentions[index].user.created_at)
                            var now = new Date();
                            var diff = now.getTime() - user_registration.getTime();
                            var elapsed = diff / (1000 * 60 * 60 * 24)
                            if (elapsed > parseInt(process.env.MIN_DAYS)) {
                                let tip = await tipuser(mentions[index].user, 'MENTION', mention_id, process.env.TIP_MENTION, process.env.COIN)
                                if (tip !== 'ERROR') {
                                    newmentions++
                                    await db.insert('mentions', { mention_id: mention_id, user_id: user_id, timestamp: new Date().getTime() })
                                }
                            } else {
                                console.log('USER ' + user_mention + ' IS TOO YOUNG.')
                            }
                        }
                    } else {
                        console.log('USER ' + user_mention + ' DON\'T HAVE THE REQUIRED FOLLOWERS (' + user_mention_followers + ')')
                    }
                }
                console.log('FOUND ' + newmentions + ' NEW CASHTAGS MENSIONS')
                response(true)
            } else {
                console.log('ERROR WHILE GETTING USER MENTIONS!', err.message)
                response(false)
            }
        })
    })
};

export async function commands() {
    return new Promise(async response => {
        const db = new Database.Mongo
        console.log('LOOKING FOR DIRECT COMMANDS UPDATES.')
        Twitter.get('search/tweets', { q: '#scryptabot' }, async function (err, data) {
            if (!err) {
                for (var index in data.statuses) {
                    // console.log('\x1b[42m%s\x1b[0m', mentions[index].text,  mentions[index].user.screen_name)
                    let twitter_user = data.statuses[index].user
                    let text = data.statuses[index].text
                    if (text.indexOf('address') !== -1) {
                        let exploded = text.split(' ')
                        for (let j in exploded) {
                            console.log('--> CHECKING ' + exploded[j])
                            if (exploded[j].substr(0, 1) === 'L') {
                                let address = exploded[j]
                                var check = await db.find('followers', { id: twitter_user.id })
                                if (check === null) {
                                    console.log('CREATING NEW FOLLWER WITH ADDRESS ' + address + '!')
                                    twitter_user.address = address
                                    await db.insert('followers', twitter_user)
                                    await message(
                                        twitter_user.id_str,
                                        "Compliments, you're now a Scrypta Ambassador! You will receive rewards for each interaction with us at address " + address + "!"
                                    )
                                } else if (check.address !== address) {
                                    console.log('UPDATING USER ' + twitter_user.screen_name + ' WITH ADDRESS ' + address)
                                    await db.update('followers', { id: twitter_user.id }, { $set: { address: address } })
                                    await message(
                                        twitter_user.id_str,
                                        "Compliments, your address is now updated with " + address + "!"
                                    )
                                }
                            }
                        }
                    } else if (text.indexOf('tip') !== -1) {
                        let exploded = text.split(' ')
                        for (let j in exploded) {
                            console.log('--> CHECKING ' + exploded[j])
                            if (exploded[j].substr(0, 1) === '@') {
                                let totip_screenname = exploded[j].replace('@', '')
                                let totip_user = await db.find('followers', { screen_name: totip_screenname })
                                if (check === null) {
                                    console.log('CREATING NEW TIPPED USER @' + totip_screenname + '!')
                                    totip_user = await Twitter.get('users/show', { screen_name: '#scryptabot' })
                                    var ck = CoinKey.createRandom(coinInfo)
                                    totip_user.address = ck.publicAddress
                                    totip_user.prv = ck.privateWif
                                    await db.insert('followers', totip_user)
                                    totip_user = await db.find('followers', { screen_name: totip_screenname })
                                }

                                // TODO: Send from twitter user to mentioned user
                                // TODO: Send a public message where A sent to B
                            }
                        }
                    }
                }
                response(true)
            } else {
                console.log('ERROR WHILE GETTING USER MENTIONS!', err.message)
                response(false)
            }
        })
    })
};

export async function mentions(twitter_user) {
    return new Promise(async response => {
        const db = new Database.Mongo
        console.log('LOOKING FOR @' + twitter_user + ' MENTIONS')
        Twitter.get('search/tweets', { q: '@' + twitter_user }, async function (err, data) {
            if (!err) {
                var found = data.statuses
                var mentions = []
                for (var index in found) {
                    if (found[index].user !== twitter_user) {
                        mentions.push(found[index])
                    }
                }
                var newmentions = 0
                for (var index in mentions) {
                    // console.log('\x1b[44m%s\x1b[0m', mentions[index].text)
                    var user_mention = mentions[index].user.screen_name
                    var user_id = mentions[index].user.id
                    var user_mention_followers = mentions[index].user.followers_count
                    if (user_mention_followers >= process.env.MIN_FOLLOWERS) {
                        var mention_id = mentions[index]['id_str']
                        var tipped = await db.find('mentions', { mention_id: mention_id, user_id: user_id })
                        if (tipped === null && user_mention !== process.env.TWITTER_USERNAME) {
                            var user_registration = new Date(mentions[index].user.created_at)
                            var now = new Date();
                            var diff = now.getTime() - user_registration.getTime();
                            var elapsed = diff / (1000 * 60 * 60 * 24)
                            if (elapsed > parseInt(process.env.MIN_DAYS)) {
                                let tip = await tipuser(mentions[index].user, 'MENTION', mention_id, process.env.TIP_MENTION, process.env.COIN)
                                if (tip !== 'ERROR') {
                                    newmentions++
                                    await db.insert('mentions', { mention_id: mention_id, user_id: user_id, timestamp: new Date().getTime() })
                                }
                            } else {
                                console.log('USER ' + user_mention + ' IS TOO YOUNG.')
                            }
                        }
                    } else {
                        console.log('USER ' + user_mention + ' DON\'T HAVE THE REQUIRED FOLLOWERS (' + user_mention_followers + ')')
                    }
                }
                console.log('FOUND ' + newmentions + ' NEW MENTIONS')
                response(true)
            } else {
                console.log('ERROR WHILE GETTING USER MENTIONS!', err.message)
                response(false)
            }
        })
    })
};

export async function tipuser(twitter_user, action, action_id, amount, coin) {
    const db = new Database.Mongo
    return new Promise(async response => {
        console.log('\x1b[32m%s\x1b[0m', 'TIPPING USER ' + twitter_user.screen_name + ' WITH ' + amount + ' ' + coin + ' FOR ' + action + '!')
        var last_tip = await db.find('tips', { user_id: twitter_user.id }, { timestamp: -1 })
        var eligible = false
        if (last_tip[0] === undefined) {
            eligible = true
        } else {
            var now = new Date().getTime()
            var elapsed = (now - last_tip[0].timestamp) / (1000 * 60)
            if (elapsed >= parseInt(process.env.MIN_TIMEFRAME)) {
                eligible = true
            }
        }

        if (eligible === true) {
            var user = await db.find('followers', { id: twitter_user.id })
            if (user === null) {
                console.log('CREATING NEW FOLLWER!')
                await db.insert('followers', twitter_user)
                var user = await db.find('followers', { id: twitter_user.id })
            }

            var address = user.address
            var pubAddr = ''

            if (address !== undefined) {
                //SEND TO ADDRESS
                pubAddr = address
            } else {
                //CREATE ADDRESS FOR USER
                var ck = CoinKey.createRandom(coinInfo)
                pubAddr = ck.publicAddress
                await db.update('followers', { id: twitter_user.id }, { $set: { address: pubAddr, prv: ck.privateWif } })
            }

            if (address !== undefined) {
                console.log('PUB ADDRESS IS ' + pubAddr)
                var wallet = new Crypto.Wallet;
                wallet.request('getinfo').then(function (info) {
                    if (info !== undefined) {
                        if (testmode === false) {
                            var balance = info['result']['balance']
                            if (balance > amount) {
                                console.log('SENDING TO ADDRESS ' + pubAddr + ' ' + amount + ' ' + coin)
                                wallet.request('sendtoaddress', [pubAddr, parseFloat(amount)]).then(async function (txid) {
                                    if (txid !== undefined && txid['result'] !== undefined && txid['result'].length === 64) {
                                        await db.insert('tips', { user_id: twitter_user.id, id: action_id, timestamp: new Date().getTime(), amount: amount, coin: coin, channel: 'TWITTER', address: address, txid: txid['result'] })
                                        console.log('TXID IS ' + txid['result'])
                                        await post('Just sent ' + amount + ' $' + coin + ' to @' + twitter_user.screen_name + '. Check the transaction at https://bb.scryptachain.org/tx/' + txid['result'] + '!')
                                        response(txid['result'])
                                    } else {
                                        console.log("ERROR WHILE SENDING TIP")
                                        response('ERROR')
                                    }
                                })
                            } else {
                                console.log('OPS, NOT ENOUGH FUNDS!')
                                response('ERROR')
                            }
                        } else {
                            db.insert('tips', { user_id: twitter_user.id, id: action_id, timestamp: new Date().getTime(), amount: amount, coin: coin, channel: 'TWITTER', address: address, txid: 'TXIDHASH' })
                            response('TXIDHASH')
                        }
                    } else {
                        console.log('WALLET NOT WORKING')
                        response('ERROR')
                    }
                })
            } else {
                console.log("USER IS WITHOUT ADDRESS")
                response('ERROR')
            }
        } else {
            console.log('USER WAS TIPPED IN THE PAST ' + process.env.MIN_TIMEFRAME + ' MINUTES, BAD LUCK!')
            response('BAD_LUCK')
        }
    })
}

export async function message(twitter_user, message) {
    return new Promise(async response => {
        console.log('SENDING MESSAGE TO ' + twitter_user)
        const db = new Database.Mongo
        if (testmode === false) {
            var msg = { "event": { "type": "message_create", "message_create": { "target": { "recipient_id": twitter_user }, "message_data": { "text": message } } } }
            Twitter.post('direct_messages/events/new', msg, async function (err, data) {
                if (data.event !== undefined) {
                    await sleep(10000)
                    response(true)
                } else {
                    console.log("Can't send message to user, sorry.")
                    await sleep(10000)
                    response(false)
                }
            })
        } else {
            response(true)
        }
    })
}

export async function post(message) {
    return new Promise(async response => {
        console.log('POSTING MESSAGE TO TWITTER')
        const db = new Database.Mongo
        if (testmode === false) {
            try {
                Twitter.post('statuses/update', { status: message })
                response(true)
            } catch (e) {
                console.log('ERROR POSTING STATUS')
                response(false)
            }
        } else {
            response(true)
        }
    })
}