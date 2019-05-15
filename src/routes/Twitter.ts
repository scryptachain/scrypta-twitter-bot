import express = require("express")
var twit = require('twit')
var redis = require("redis")
var db = redis.createClient()
const {promisify} = require('util')
const getmembers = promisify(db.smembers).bind(db)
const get = promisify(db.get).bind(db)
var CoinKey = require('coinkey')
import * as Crypto from '../libs/Crypto'
var crypto = require('crypto');
var axios = require('axios');
var twitterlogin = require("node-twitter-api")
var os = require('os')
var config = require('../config.js');
var testmode = process.env.TESTMODE.toLowerCase() == 'true' ? true : false;

if(testmode === true){
    console.log('\x1b[33m%s\x1b[0m', 'RUNNING IN TEST MODE')
}

if(config.access_token !== undefined && config.access_token_secret !== undefined){
    var Twitter = new twit(config);
}

const coinInfo = {
    private: 0xae,
    public: 0x30,
    scripthash: 0x0d
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var _requestSecret
if(process.env.TWITTER_CONSUMERKEY !== undefined && process.env.TWITTER_CONSUMERSECRET !== undefined){
    var twtlogin = new twitterlogin({
        consumerKey: process.env.TWITTER_CONSUMERKEY,
        consumerSecret:  process.env.TWITTER_CONSUMERSECRET,
        callback: process.env.URL + '/twitter/callback'
    });
}else{
    console.log('\x1b[41m%s\x1b[0m', 'SETUP TWITTER FIRST!')
}

export function getAuth(req: express.Request, res: express.res) {
    if(process.env.TWITTER_ACCESSTOKEN === undefined && process.env.TWITTER_TOKENSECRET === undefined){
        twtlogin.getRequestToken(function(err, requestToken, requestSecret) {
            if (err)
                res.status(500).send(err);
            else {
                _requestSecret = requestSecret;
                res.redirect("https://api.twitter.com/oauth/authenticate?oauth_token=" + requestToken);
            }
        });
    }else{
        res.send({error: "This bot is configured, to configure it again please remove TWITTER_ACCESSTOKEN and TWITTER_TOKENSECRET from your dotenv file."})
    }
}

export function getAccessToken(req: express.Request, res: express.res) {
    var requestToken = req.query.oauth_token,
    verifier = req.query.oauth_verifier;

    twtlogin.getAccessToken(requestToken, _requestSecret, verifier, function(err, accessToken, accessSecret) {
          if (err){
              res.status(500).send(err);
          }else{
            twtlogin.verifyCredentials(accessToken, accessSecret, function(err, user) {
                  if (err){
                      res.status(500).send(err);
                  }else{
                    res.send({
                        user
                    });
                    const fs = require('fs');
                    fs.appendFile('.env', "\r\n" + 'TWITTER_ACCESSTOKEN=' + accessToken , function(err){
                        console.log('ACCESS TOKEN WRITTEN')
                    })
                    fs.appendFile('.env', "\r\n" + 'TWITTER_TOKENSECRET=' + accessSecret, function(err){
                        console.log('TOKEN SECRET WRITTEN')
                    })
                    fs.appendFile('.env', "\r\n" + 'TWITTER_USERNAME=' + user.screen_name, function(err){
                        console.log('USERNAME WRITTEN')
                    })
                }
              });
          }
    });

}

export async function followers(twitter_user) {
    console.log('LOOKING FOR @'+twitter_user+' FOLLOWER')
    var tipped = await getmembers('FOLLOW_' + twitter_user)
    Twitter.get('followers/list', { screen_name: twitter_user, count: 30 },function(err, data){
        if (!err) {
            var followers = data.users
            var newfollowers = 0
            for(var index in followers){
                var user_follow = followers[index].screen_name
                if(tipped.indexOf(user_follow) === -1){
                    var user_registration = new Date(followers[index].created_at)
                    var now = new Date(); 
                    var diff = now.getTime() - user_registration.getTime();
                    var elapsed = diff / (1000*60*60*24)
                    if(elapsed >= parseInt(process.env.MIN_DAYS)){
                        newfollowers ++
                        console.log('NEW FOLLOWER: ' + user_follow + '!')
                        db.set('USER_' + user_follow,  followers[index].id_str)
                        db.sadd('FOLLOW_' + twitter_user, user_follow)
                        tipuser(user_follow,'FOLLOW',twitter_user,process.env.TIP_FOLLOW,process.env.COIN)
                    }else{
                        console.log('USER '+user_follow+' IS TOO YOUNG.')
                    }
                }
            }
            console.log('FOUND ' + newfollowers + ' NEW FOLLOWERS!')
        }else{
            console.log('ERROR WHILE GETTING FOLLOWERS LIST!', err.message)
        }
    })
};

export async function mentions(twitter_user) {
    console.log('LOOKING FOR @'+twitter_user+' MENTIONS')

    var tipped = await getmembers('MENTIONS_' + twitter_user)
    Twitter.get('search/tweets', {q: '@' + twitter_user}, function(err, data) {
        if(!err){
            var found = data.statuses
            var mentions = []
            for(var index in found){
                if(found[index].user !== twitter_user){
                    mentions.push(found[index])
                }
            }
            var newmentions = 0
            for(var index in mentions){
                var user_mention = mentions[index].user.screen_name
                var mention_id = mentions[index]['id_str']
                if(tipped.indexOf(mention_id) === -1 && user_mention !== process.env.TWITTER_USERNAME){
                    var user_registration = new Date(mentions[index].user.created_at)
                    var now = new Date(); 
                    var diff = now.getTime() - user_registration.getTime();
                    var elapsed = diff / (1000*60*60*24)
                    if(elapsed > parseInt(process.env.MIN_DAYS)){
                        newmentions++
                        db.set('USER_' + user_mention, mentions[index].user.id_str)
                        db.sadd('MENTIONS_' + twitter_user, mention_id)
                        tipuser(user_mention,'MENTION', mention_id, process.env.TIP_MENTION, process.env.COIN)
                    }else{
                        console.log('USER '+user_mention+' IS TOO YOUNG.')
                    }
                }
            }
            console.log('FOUND ' + newmentions + ' NEW MENTIONS')
        }else{
            console.log('ERROR WHILE GETTING USER MENTIONS!', err.message)
        }
    })
};

export async function tipuser(twitter_user, action, id = '', amount, coin) {
    return new Promise(async response => {
        console.log('\x1b[32m%s\x1b[0m','TIPPING USER ' + twitter_user + ' WITH ' + amount + ' ' + coin + ' FOR ' + action + '!')
        var last_tip = await get('LAST_TIP_' + twitter_user)
        var eligible = false
        if(last_tip === null){
            eligible = true
        }else{
            var now = new Date().getTime()
            var elapsed = (now - last_tip) / (1000*60)
            if(elapsed >= parseInt(process.env.MIN_TIMEFRAME)){
                eligible = true
            }
        }

        if(eligible === true){
            var address = await get('ADDRESS_' + twitter_user)
            var pubAddr = ''
            
            if(address !== null){
                //SEND TO ADDRESS
                pubAddr = address
            }else{
                //CREATE ADDRESS FOR USER
                var ck = CoinKey.createRandom(coinInfo)
                var lyrapub = ck.publicAddress;
                var lyraprv = ck.privateWif;
                var lyrakey = ck.publicKey.toString('hex');
                var buf = crypto.randomBytes(16);
                var api_secret = buf.toString('hex');
                var buf = crypto.randomBytes(16);
                var password = buf.toString('hex');

                var newwallet = {
                    prv: lyraprv,
                    api_secret: api_secret,
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
                var message_text = "Your ScryptaID Account with LYRA Address are created! Now you can download your .sid file from here: https://faucet.scryptachain.org/ids/" + ck.publicAddress + ".sid\r\n"
                message_text +="Using this file you can access in Scrypta dApps and manage your funds. Please keep .sid file safe! if you lost it, you can’t log in  your Scrypta Account, so at your funds!\r\n\r\n"
                message_text +="You can import .sid on\r\n";
                message_text +="- Scrypta Manent [Withdraw and send fuction]:\r\n";
                message_text +="https://manent.scryptachain.org/\r\n\r\n";
                message_text +="or import in\r\n";
                message_text +="- ScryptaID [browser extension for manage your ID and access in all Scrypta dApps]:\r\n";
                message_text +="https://id.scryptachain.org/\r\n\r\n";
                message_text +="Use this password: " + password + "\r\n\r\n";
                message_text +="ATTENTION: We don't store that password so please SAFELY STORE where you prefer and DESTROY THIS MESSAGE! Keeps your funds SAFE!\r\n\r\n";
                
                message_text +="ADDITIONAL INFO:\r\n";
                message_text +="- To receive LYRA bounty you must be have an active Twitter account since 1 MONTH\r\n";
                message_text +="- You can react with our post and receive LYRA every 15 minutes";

                var result = await message(
                    twitter_user,
                    message_text
                )
                
                if(result === true){
                    await axios.post('https://idanode01.scryptachain.org/init', { address: ck.publicAddress })
                    pubAddr = ck.publicAddress
                    db.set('ADDRESS_' + twitter_user,pubAddr)
                }else{
                    if(testmode === false){
                        Twitter.post('statuses/update', {status: "@"+twitter_user + " I wish send to you " + amount + ' $' + coin + ', but i can\'t send your private key. Please follow me!' })
                    }
                }
            }

            if(pubAddr !== ''){
                var wallet = new Crypto.Wallet;
                var timestamp = new Date().getTime()
                db.set('LAST_TIP_' + twitter_user, timestamp)
                wallet.request('getinfo').then(function(info){
                    var balance = info['result']['balance']
                    if(balance > amount){
                        console.log('SENDING TO ADDRESS ' + pubAddr + ' ' + amount + ' ' + coin)
                        if(testmode === false){
                            wallet.request('sendtoaddress',[pubAddr,parseInt(amount)]).then(function(txid){
                                //Twitter.post('statuses/update', {status: "@"+twitter_user + " I've sent " + amount + " $" + coin + " to you! Check your TXID: " + txid['result'] + "!"})
                                console.log('TXID IS ' + txid['result'])
                                response(txid['result'])
                            })
                        }else{
                            response('TXIDHASH')
                        }
                    }else{
                        console.log('OPS, NOT ENOUGH FUNDS!')
                    }
                })
            }
        }else{
            var result = await message(
                twitter_user,
                'Not so fast! You must wait at least 15 minutes between retweet or mention us to be rewarded!'
            )
            console.log('USER WAS TIPPED IN THE PAST ' + process.env.MIN_TIMEFRAME + ' MINUTES, BAD LUCK!')
        }
    })
}

export async function message(twitter_user, message) {
    return new Promise(async response => {
        console.log('SENDING MESSAGE TO ' + twitter_user)
        var twitter_id = await get("USER_" + twitter_user)
        if(twitter_id !== null){
            if(testmode === false){
                var msg = {"event": {"type": "message_create", "message_create": {"target": {"recipient_id": twitter_id}, "message_data": {"text": message}}}}
                Twitter.post('direct_messages/events/new', msg, function(err, data){
                    if(data.event !== undefined){
                        response(true)
                    }else{
                        response(false)
                    }
                })
            }else{
                response(true)
            }
        }else{
            response(false)
            console.log("CAN'T FIND USER ID")
        }
    })
}