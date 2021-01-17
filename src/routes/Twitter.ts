import express = require("express")
var twit = require('twit')
import * as Database from '../libs/Database'
var CoinKey = require('coinkey')
import * as Crypto from '../libs/Crypto'
var crypto = require('crypto');
var twitterlogin = require("node-twitter-api")
var config = require('../config.js');
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
    if (process.env.TWITTER_ACCESSTOKEN === undefined && process.env.TWITTER_TOKENSECRET === undefined) {
        twtlogin.getRequestToken(function (err, requestToken, requestSecret) {
            if (err)
                res.status(500).send(err);
            else {
                _requestSecret = requestSecret;
                res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
            }
        });
    } else {
        res.send({ error: "This bot is configured, to configure it again please remove TWITTER_ACCESSTOKEN and TWITTER_TOKENSECRET from your dotenv file." })
    }
}

export function getAccessToken(req: express.Request, res: express.res) {
    var requestToken = req.query.oauth_token,
        verifier = req.query.oauth_verifier;

    twtlogin.getAccessToken(requestToken, _requestSecret, verifier, function (err, accessToken, accessSecret) {
        if (err) {
            res.status(500).send(err);
        } else {
            twtlogin.verifyCredentials(accessToken, accessSecret, function (err, user) {
                if (err) {
                    res.status(500).send(err);
                } else {
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

export async function ambassadors() {
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
                                        twitter_user.id,
                                        "Compliments, you're now a Scrypta Ambassador! You will receive rewards for each interaction with us at address " + address + "!"
                                    )
                                } else if (check.address !== address) {
                                    console.log('UPDATING USER ' + twitter_user.screen_name + ' WITH ADDRESS ' + address)
                                    await db.update('followers', { id: twitter_user.id }, { $set: { address: address } })
                                    await message(
                                        twitter_user.id,
                                        "Compliments, your address is now updated with " + address + "!"
                                    )
                                }
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
                var lyrapub = ck.publicAddress;
                var lyraprv = ck.privateWif;
                var lyrakey = ck.publicKey.toString('hex');
                var buf = crypto.randomBytes(16);
                var buf = crypto.randomBytes(16);
                var password = buf.toString('hex');

                var newwallet = {
                    prv: lyraprv,
                    key: lyrakey
                };

                const cipher = crypto.createCipher('aes-256-cbc', password);
                let wallethex = cipher.update(JSON.stringify(newwallet), 'utf8', 'hex');
                wallethex += cipher.final('hex');

                var walletstore = lyrapub + ':' + wallethex;
                var fs = require('fs');

                fs.appendFile('public/ids/' + ck.publicAddress + '.sid', walletstore, function (err) {
                    if (err) throw err;
                    console.log('ADDRESS SUCCESSFULLY CREATED!');
                });

                var message_text = " Your Scrypta Account with LYRA Address are created!\r\n"
                message_text += "All your reactions with our Twitter posts will receive a reward in LYRA on the address that we have just provided to you.\r\n"
                message_text += "Now you can download your .sid file from here: https://faucet.scryptachain.org/ids/" + ck.publicAddress + ".sid\r\nUsing this file you can access in Scrypta dApps and manage your funds.\r\n\r\n"
                message_text += "Please keep .sid file safe! if you lost it, you can&rsquo;t login into your Scrypta Account, so at your funds!\r\n\r\n"
                message_text += "You can import .sid on\r\n"
                message_text += "Scrypta Manent [Withdraw and send fuction]: https://manent.scryptachain.org\r\n"
                message_text += "or import it in\r\nScryptaID [browser extension for manage your ID and access in all Scrypta dApps]: https://id.scryptachain.org\r\n"
                message_text += "using this password: " + password + "\r\n\r\n"
                message_text += "ATTENTION: We don't store that password so please SAFELY STORE where you prefer and DESTROY THIS MESSAGE! Keeps your funds SAFE! THIS MESSAGE WILL BE DESTROYED FROM OUR TWITTER FOR SECURITY REASON. NO ONE CAN RECOVER YOUR PASSWORD IF YOU LOSE OR FORGET IT.\r\n\r\n"
                message_text += "ADDITIONAL INFO: - To receive LYRA bounty you must be have an active Twitter account since 1 MONTH  - You can react with our post and receive LYRA every " + process.env.MIN_TIMEFRAME + " minutes"

                var result = await message(
                    twitter_user.id,
                    message_text
                )

                if (result === true) {
                    pubAddr = ck.publicAddress
                    await db.update('followers', { id: twitter_user.id }, { $set: { address: pubAddr } })
                } else {
                    if (testmode === false) {
                        // Twitter.post('statuses/update', { status: "@" + twitter_user.screen_name + " I wish send to you " + amount + ' $' + coin + ', but i can\'t send your private key. Please follow me!' })
                    }
                }
            }

            if (pubAddr !== '') {
                console.log('PUB ADDRESS IS ' + pubAddr)
                var wallet = new Crypto.Wallet;
                wallet.request('getinfo').then(function (info) {
                    if (info !== undefined) {
                        if (testmode === false) {
                            var balance = info['result']['balance']
                            if (balance > amount) {
                                console.log('SENDING TO ADDRESS ' + pubAddr + ' ' + amount + ' ' + coin)
                                wallet.request('sendtoaddress', [pubAddr, parseFloat(amount)]).then(function (txid) {
                                    console.log(txid)
                                    if (txid !== undefined && txid['result'] !== undefined && txid['result'].length === 64) {
                                        db.insert('tips', { user_id: twitter_user.id, id: action_id, timestamp: new Date().getTime() })
                                        message(
                                            twitter_user.id,
                                            "I've sent " + amount + " $" + coin + " to you! Check your TXID: " + txid['result'] + "!"
                                        )
                                        console.log('TXID IS ' + txid['result'])
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
                            db.insert('tips', { user_id: twitter_user.id, timestamp: new Date().getTime() })
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
            var result = await message(
                twitter_user.id,
                'Not so fast! You must wait at least ' + process.env.MIN_TIMEFRAME + ' minutes between retweet or mention us to be rewarded!'
            )
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
                    await sleep(2000)
                    response(true)
                } else {
                    console.log("Can't send message to user, sorry.")
                    await sleep(2000)
                    response(false)
                }
            })
        } else {
            response(true)
        }
    })
}