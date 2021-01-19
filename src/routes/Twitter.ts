import express = require("express")
var twit = require('twit')
var CoinKey = require('coinkey')
var twitterlogin = require("node-twitter-api")
var config = require('../config.js')
const ScryptaCore = require('@scrypta/core')
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
                        if (userDB === null) {
                            var ck = CoinKey.createRandom(coinInfo)
                            user.address = ck.publicAddress
                            user.prv = ck.privateWif
                            await db.insert('followers', user)
                            userDB = await db.find('followers', { id: user.id })
                        }
                        let storage = {
                            name: userDB.name,
                            screen_name: userDB.screen_name,
                            reward_address: userDB.reward_address,
                            prv: userDB.prv,
                            address: userDB.address,
                            image: userDB.profile_image_url_https
                        }
                        res.send('<html><script>localStorage.setItem(`user`,`' + JSON.stringify(storage) + '`);window.location=`/#/`;</script></html>')
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
                    if (user_mention !== process.env.TWITTER_BOT) {
                        if (user_mention_followers >= process.env.MIN_FOLLOWERS) {
                            var mention_id = mentions[index]['id_str']
                            var tipped = await db.find('mentions', { mention_id: mention_id, user_id: user_id })
                            if (tipped === null && user_mention !== process.env.TWITTER_USERNAME && user_mention !== process.env.TWITTER_BOT) {
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
                }
                console.log('FOUND ' + newmentions + ' NEW CASHTAGS MENTIONS')
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
                        console.log('--> CHECKING ' + text)
                        for (let j in exploded) {
                            if (exploded[j].substr(0, 1) === 'L') {
                                let address = exploded[j]
                                var check = await db.find('followers', { id: twitter_user.id })
                                if (check === null) {
                                    console.log('CREATING NEW FOLLWER WITH ADDRESS ' + address + '!')
                                    twitter_user.reward_address = address
                                    await db.insert('followers', twitter_user)
                                    await message(
                                        twitter_user.id_str,
                                        "Compliments, you're now a Scrypta Ambassador! You will receive rewards for each interaction with us at address " + address + "!"
                                    )
                                } else if (check.reward_address === undefined || (check.reward_address !== undefined && check.reward_address !== address)) {
                                    console.log('UPDATING USER ' + twitter_user.screen_name + ' WITH ADDRESS ' + address)
                                    await db.update('followers', { id: twitter_user.id }, { $set: { reward_address: address } })
                                    await message(
                                        twitter_user.id_str,
                                        "Compliments, your reward address is now updated with " + address + "! You can continue use " + check.address + " to send coins and interact with other people!"
                                    )
                                }
                            }
                        }
                    } else if (text.indexOf('tip') !== -1) {
                        let exploded = text.split(' ')
                        console.log('--> CHECKING ' + text)
                        for (let j in exploded) {
                            if (exploded[j].substr(0, 1) === '@') {
                                let check_tip = await db.find('tips', { id: data.statuses[index]['id_str'] })
                                let check_action = await db.find('actions', { id: data.statuses[index]['id_str'] })
                                if (check_tip === null && check_action === null) {
                                    var sender_user = await db.find('followers', { id: twitter_user.id })
                                    if (sender_user !== null && sender_user.prv !== undefined) {
                                        let totip_screenname = exploded[j].replace('@', '')
                                        let totip_user = await db.find('followers', { screen_name: totip_screenname })
                                        if (totip_user === null) {
                                            console.log('CREATING NEW TIPPED USER @' + totip_screenname + '!')
                                            let twitter_user = await Twitter.get('users/show', { screen_name: totip_screenname })
                                            var ck = CoinKey.createRandom(coinInfo)
                                            twitter_user.data.address = ck.publicAddress
                                            twitter_user.data.prv = ck.privateWif
                                            await db.insert('followers', twitter_user.data)
                                            totip_user = await db.find('followers', { screen_name: totip_screenname })
                                        }
                                        if (totip_user !== null) {
                                            let amount = parseFloat(exploded[3])
                                            if (amount > 0) {
                                                if (testmode === false) {
                                                    const scrypta = new ScryptaCore
                                                    scrypta.staticnodes = true
                                                    console.log('CHECKING BALANCE OF ' + sender_user.address)
                                                    let balance = await scrypta.get('/balance/' + sender_user.address)
                                                    if (balance.balance >= amount) {
                                                        try {
                                                            console.log('SENDING COINS FROM ' + sender_user.address + ' TO ' + totip_user.address)
                                                            let temp = await scrypta.importPrivateKey(sender_user.prv, '-', false)
                                                            let sent = await scrypta.send(temp.walletstore, '-', totip_user.address, amount)
                                                            if (sent !== false && sent !== null && sent.length === 64) {
                                                                await db.insert('tips', { user_id: twitter_user.id, id: data.statuses[index]['id_str'], timestamp: new Date().getTime(), amount: amount, coin: 'LYRA', channel: 'TWITTER', address: totip_user.address, txid: sent, source: twitter_user.screen_name })
                                                                await post('@' + twitter_user.screen_name + ' just sent ' + amount + ' $LYRA to @' + totip_user.screen_name + '. Check the transaction here: https://bb.scryptachain.org/tx/' + sent)
                                                            } else {
                                                                console.log("SEND WAS UNSUCCESSFUL, WILL RETRY LATER")
                                                            }
                                                        } catch (e) {
                                                            console.log(e)
                                                            console.log("SENDING ERROR, WILL RETRY LATER")
                                                        }
                                                    }else{
                                                        console.log("NOT ENOUGH BALANCE, IGNORING MESSAGE.")
                                                        await db.insert('actions', { id: data.statuses[index]['id_str'] })
                                                    }
                                                } else {
                                                    console.log('STORING IN DB, TESTMODE IS ON')
                                                    await db.insert('tips', { user_id: twitter_user.id, id: data.statuses[index]['id_str'], timestamp: new Date().getTime(), amount: amount, coin: 'LYRA', channel: 'TWITTER', address: totip_user.address, txid: 'TXIDHASH', source: twitter_user.screen_name })
                                                }
                                            } else {
                                                console.log('AMOUNT IS NOT VALID ' + amount)
                                            }
                                        } else {
                                            console.log("USER DON'T EXISTS!")
                                        }
                                    } else {
                                        console.log('USER IS NOT REGISTERED TO SERVICE.')
                                    }
                                }
                            }
                        }
                    } else if (text.indexOf('disable') !== -1) {
                        let exploded = text.split(' ')
                        console.log('--> CHECKING ' + text)
                        for (let j in exploded) {
                            if (exploded[j] === 'disable') {
                                let check_action = await db.find('actions', { id: data.statuses[index]['id_str'] })
                                if (check_action === null) {
                                    await db.insert('actions', { id: data.statuses[index]['id_str'] })
                                    console.log('---> REMOVING ENDORSEMENT FOUND!')
                                    let ni = parseInt(j) + 1
                                    let endorsement = exploded[ni]
                                    if (endorsement !== undefined && endorsement !== null) {
                                        var check = await db.find('followers', { id: twitter_user.id })
                                        if (check !== null) {
                                            let update = []
                                            for (let k in check.endorse) {
                                                if (check.endorse[k].searcher !== endorsement) {
                                                    update.push(check.endorse[k])
                                                } else {
                                                    check.endorse[k].ignore = true
                                                    update.push(check.endorse[k])
                                                }
                                            }

                                            await db.update('followers', { id: twitter_user.id }, { $set: { endorse: update } })
                                            await message(
                                                twitter_user.id_str,
                                                "Oh no, you're now stopped endorsing " + endorsement + ".."
                                            )

                                        }
                                    }
                                }
                            }
                        }
                    } else if (text.indexOf('enable') !== -1) {
                        let exploded = text.split(' ')
                        console.log('--> CHECKING ' + text)
                        for (let j in exploded) {
                            if (exploded[j] === 'enable') {
                                let check_action = await db.find('actions', { id: data.statuses[index]['id_str'] })
                                if (check_action === null) {
                                    await db.insert('actions', { id: data.statuses[index]['id_str'] })
                                    console.log('---> ENABLING ENDORSEMENT AGAIN!')
                                    let ni = parseInt(j) + 1
                                    let endorsement = exploded[ni]
                                    if (endorsement !== undefined && endorsement !== null) {
                                        var check = await db.find('followers', { id: twitter_user.id })
                                        if (check !== null) {
                                            let update = []
                                            for (let k in check.endorse) {
                                                if (check.endorse[k].searcher !== endorsement) {
                                                    update.push(check.endorse[k])
                                                } else {
                                                    check.endorse[k].ignore = false
                                                    update.push(check.endorse[k])
                                                }
                                            }

                                            await db.update('followers', { id: twitter_user.id }, { $set: { endorse: update } })
                                            await message(
                                                twitter_user.id_str,
                                                "Yeah! You're now endorsing " + endorsement + " again!"
                                            )

                                        }
                                    }
                                }
                            }
                        }
                    } else if (text.indexOf('endorse') !== -1) {
                        let exploded = text.split(' ')
                        console.log('--> CHECKING ' + text)
                        for (let j in exploded) {
                            if (exploded[j] === 'endorse') {
                                let check_action = await db.find('actions', { id: data.statuses[index]['id_str'] })
                                if (check_action === null) {
                                    await db.insert('actions', { id: data.statuses[index]['id_str'] })
                                    console.log('---> ENDORSEMENT FOUND!')
                                    let ni = parseInt(j) + 1
                                    let nit = parseInt(j) + 2
                                    let nic = parseInt(j) + 3
                                    let endorsement = exploded[ni]
                                    let tip = exploded[nit]
                                    let coin = exploded[nic]
                                    if (endorsement !== undefined && endorsement !== null && tip !== undefined && coin !== null && coin !== undefined && tip !== null && parseFloat(tip) > 0) {
                                        var check = await db.find('followers', { id: twitter_user.id })
                                        if (check == null) {
                                            var ck = CoinKey.createRandom(coinInfo)
                                            twitter_user.address = ck.publicAddress
                                            twitter_user.prv = ck.privateWif
                                            twitter_user.endorse = []
                                            await db.insert('followers', twitter_user)
                                            check = await db.find('followers', { id: twitter_user.id })
                                        }

                                        let endorse = []
                                        let found = false

                                        if (check.endorse !== undefined) {
                                            endorse = check.endorse
                                        }

                                        for (let k in endorse) {
                                            if (endorse[k].searcher === endorsement) {
                                                found = true
                                            }
                                        }

                                        if (!found) {
                                            endorse.push({
                                                searcher: endorsement,
                                                coin: coin,
                                                tip: tip
                                            })

                                            await db.update('followers', { id: twitter_user.id }, { $set: { endorse: endorse } })
                                            await message(
                                                twitter_user.id_str,
                                                "Compliments, you're now endorsing " + endorsement + ". Each user that tweets your endorsement will receive  " + parseFloat(tip) + " $LYRA from you! Please be sure your address is always filled with some " + coin + "!"
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    } else if (text.indexOf('withdraw') !== -1) {
                        let exploded = text.split(' ')
                        console.log('--> CHECKING ' + text)
                        for (let j in exploded) {
                            if (exploded[j] === 'withdraw') {
                                let check_action = await db.find('actions', { id: data.statuses[index]['id_str'] })
                                if (check_action === null) {
                                    var sender_user = await db.find('followers', { id: twitter_user.id })
                                    if (sender_user !== null && sender_user.prv !== undefined) {
                                        if (testmode === false) {
                                            let amount = parseFloat(exploded[3])
                                            let address = parseFloat(exploded[2])
                                            if (amount > 0) {
                                                const scrypta = new ScryptaCore
                                                scrypta.staticnodes = true
                                                console.log('CHECKING BALANCE OF ' + sender_user.address)
                                                let balance = await scrypta.get('/balance/' + sender_user.address)
                                                if (balance.balance >= amount) {
                                                    try {
                                                        console.log('SENDING COINS FROM ' + sender_user.address + ' TO ' + address)
                                                        let temp = await scrypta.importPrivateKey(sender_user.prv, '-', false)
                                                        let sent = await scrypta.send(temp.walletstore, '-', address, amount)
                                                        if (sent !== false && sent !== null && sent.length === 64) {
                                                            await db.insert('actions', { id: data.statuses[index]['id_str'] })
                                                            await post('@' + twitter_user.screen_name + ' just withdrew ' + amount + ' $LYRA! Check the transaction here: https://bb.scryptachain.org/tx/' + sent)
                                                        } else {
                                                            console.log("SEND WAS UNSUCCESSFUL, WILL RETRY LATER")
                                                        }
                                                    } catch (e) {
                                                        console.log(e)
                                                        console.log("SENDING ERROR, WILL RETRY LATER")
                                                    }
                                                }
                                            } else {
                                                console.log('AMOUNT IS NOT VALID ' + amount)
                                            }
                                        } else {
                                                    console.log('STORING IN DB, TESTMODE IS ON')
                                            await db.insert('actions', { id: data.statuses[index]['id_str'] })
                                        }
                                    } else {
                                        console.log('USER IS NOT REGISTERED TO SERVICE.')
                                    }
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
                    if (user_mention !== process.env.TWITTER_BOT) {
                        if (user_mention_followers >= process.env.MIN_FOLLOWERS) {
                            var mention_id = mentions[index]['id_str']
                            var tipped = await db.find('mentions', { mention_id: mention_id, user_id: user_id })
                            if (tipped === null && user_mention !== process.env.TWITTER_USERNAME && user_mention !== process.env.TWITTER_BOT) {
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
        var last_tip = await db.find('tips', { user_id: twitter_user.id, source: 'BOT' }, { timestamp: -1 })
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

            if (user.reward_address === undefined) {
                if (address !== undefined) {
                    //SEND TO ADDRESS
                    pubAddr = address
                } else {
                    //CREATE ADDRESS FOR USER
                    var ck = CoinKey.createRandom(coinInfo)
                    pubAddr = ck.publicAddress
                    await db.update('followers', { id: twitter_user.id }, { $set: { address: pubAddr, prv: ck.privateWif } })
                    address = pubAddr
                }
            } else {
                pubAddr = user.reward_address
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
                                        await db.insert('tips', { user_id: twitter_user.id, id: action_id, timestamp: new Date().getTime(), amount: amount, coin: coin, channel: 'TWITTER', address: address, txid: txid['result'], source: 'BOT' })
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
                            db.insert('tips', { user_id: twitter_user.id, id: action_id, timestamp: new Date().getTime(), amount: amount, coin: coin, channel: 'TWITTER', address: address, txid: 'TXIDHASH', source: 'BOT' })
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

export async function endorse(tag, twitter_user, coin, amount) {
    return new Promise(async response => {
        const db = new Database.Mongo
        console.log('LOOKING FOR TAG: ' + tag)
        Twitter.get('search/tweets', { q: tag }, async function (err, data) {
            if (!err) {
                var found = data.statuses
                var mentions = []
                for (var index in found) {
                    if (found[index].user !== twitter_user.screen_name) {
                        mentions.push(found[index])
                    }
                }
                var newmentions = 0
                for (var index in mentions) {
                    // console.log('\x1b[42m%s\x1b[0m', mentions[index].text,  mentions[index].user.screen_name)
                    var user_mention = mentions[index].user.screen_name
                    var user_id = mentions[index].user.id
                    var user_mention_followers = mentions[index].user.followers_count
                    if (user_mention !== process.env.TWITTER_BOT) {
                        if (user_mention_followers >= process.env.MIN_FOLLOWERS) {
                            var mention_id = mentions[index]['id_str']
                            var tipped = await db.find('mentions', { mention_id: mention_id, user_id: user_id })
                            if (tipped === null && user_mention !== process.env.TWITTER_USERNAME && user_mention !== process.env.TWITTER_BOT && user_mention !== twitter_user.screen_name) {
                                var user_registration = new Date(mentions[index].user.created_at)
                                var now = new Date();
                                var diff = now.getTime() - user_registration.getTime();
                                var elapsed = diff / (1000 * 60 * 60 * 24)
                                if (elapsed > parseInt(process.env.MIN_DAYS)) {

                                    const scrypta = new ScryptaCore
                                    scrypta.staticnodes = true
                                    console.log('CHECKING USER BALANCE')
                                    let balance = await scrypta.get('/balance/' + twitter_user.address)
                                    if (balance.balance >= amount) {
                                        let totip_user = await db.find('followers', { screen_name: user_mention })
                                        if (totip_user === null) {
                                            console.log('CREATING NEW TIPPED USER @' + user_mention + '!')
                                            let twitter_user = await Twitter.get('users/show', { screen_name: user_mention })
                                            var ck = CoinKey.createRandom(coinInfo)
                                            twitter_user.data.address = ck.publicAddress
                                            twitter_user.data.prv = ck.privateWif
                                            await db.insert('followers', twitter_user.data)
                                            totip_user = await db.find('followers', { screen_name: user_mention })
                                        }
                                        if (totip_user !== null) {
                                            if (testmode === false) {
                                                try {
                                                    scrypta.debug = true
                                                    let temp = await scrypta.importPrivateKey(twitter_user.prv, '-', false)
                                                    let sent = await scrypta.send(temp.walletstore, '-', totip_user.address, amount)
                                                    if (sent !== false && sent !== null && sent.length === 64) {
                                                        await db.insert('tips', { user_id: twitter_user.id, id: data.statuses[index]['id_str'], timestamp: new Date().getTime(), amount: amount, coin: 'LYRA', channel: 'TWITTER', address: totip_user.address, txid: sent, source: twitter_user.screen_name })
                                                        await post('@' + twitter_user.screen_name + ' just sent ' + amount + ' $LYRA to @' + totip_user.screen_name + ' because endorsed ' + tag + ' Check the transaction here: https://bb.scryptachain.org/tx/' + sent)
                                                        await db.insert('mentions', { mention_id: mention_id, user_id: user_id, timestamp: new Date().getTime() })
                                                        newmentions++
                                                        console.log("ENDORSEMENT TIP SENT!")
                                                    } else {
                                                        console.log("SEND WAS UNSUCCESSFUL, WILL RETRY LATER")
                                                    }
                                                } catch (e) {
                                                    console.log(e)
                                                    console.log("SENDING ERROR, WILL RETRY LATER")
                                                }
                                            } else {
                                                console.log("ENDORSEMENT TIP SENT!")
                                                await db.insert('mentions', { mention_id: mention_id, user_id: user_id, timestamp: new Date().getTime() })
                                                newmentions++
                                            }
                                        }
                                    }
                                } else {
                                    console.log('USER ' + user_mention + ' IS TOO YOUNG.')
                                }
                            }
                        } else {
                            console.log('USER ' + user_mention + ' DON\'T HAVE THE REQUIRED FOLLOWERS (' + user_mention_followers + ')')
                        }
                    }
                }
                console.log('FOUND ' + newmentions + ' NEW ENDORSEMENT MENTIONS')
                response(true)
            } else {
                console.log('ERROR WHILE GETTING USER MENTIONS!', err.message)
                response(false)
            }
        })
    })
};

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
        console.log('POSTING MESSAGE TO TWITTER', message)
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