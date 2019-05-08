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
console.log('INIT TWITTER WITH ' + process.env.TWITTER_CONSUMERKEY+ ' ' + process.env.TWITTER_CONSUMERSECRET)
var twtlogin = new twitterlogin({
    consumerKey: process.env.TWITTER_CONSUMERKEY,
    consumerSecret:  process.env.TWITTER_CONSUMERSECRET,
    callback: process.env.URL + '/twitter/callback'
});

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
                console.log('NEW FOLLOWER: ' + user_follow + '!')
                db.set('USER_' + user_follow,  followers[index].id_str)
                if(tipped.indexOf(user_follow) === -1){
                    db.sadd('FOLLOW_' + twitter_user, user_follow)
                    newfollowers ++
                    tipuser(user_follow,'FOLLOW',twitter_user,process.env.TIP_FOLLOW,process.env.COIN)
                }
            }
            console.log('FOUND ' + newfollowers + ' NEW FOLLOWERS!')
        }else{
            console.log('ERROR WHILE GETTING FOLLOWERS LIST!', err.message)
        }
    })
};

export async function tweets(twitter_user) {
    console.log('LOOKING FOR @'+twitter_user+' TWEETS')
    Twitter.get('statuses/user_timeline', { screen_name: twitter_user, count: 30 },function(err, data){
        if (!err) {
            var tweets = data
            for(var index in tweets){
                var tweet = tweets[index]
                retweets(twitter_user, tweet['id_str'], index)
            }
        }else{
            console.log('ERROR WHILE GETTING USER TIMELINE!', err.message)
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
                db.set('USER_' + user_mention, mentions[index].user.id_str)
                if(tipped.indexOf(mention_id) === -1 && user_mention !== process.env.TWITTER_USERNAME){
                    db.sadd('MENTIONS_' + twitter_user, mention_id)
                    newmentions++
                    tipuser(user_mention,'MENTION', mention_id, process.env.TIP_MENTION, process.env.COIN)
                }
            }
            console.log('FOUND ' + newmentions + ' NEW MENTIONS')
        }else{
            console.log('ERROR WHILE GETTING USER MENTIONS!', err.message)
        }
    })
};

export async function retweets(twitter_user, tweet_id, count) {
    await sleep(2000 * count)
    console.log('LOOKING FOR '+ tweet_id +' RETWEETS!')
    var tipped = await getmembers('RETWEET_' + tweet_id)
    Twitter.get('statuses/retweets/:id', { id: tweet_id }, function(err, data){
        if(!err){
            var retweets = data
            var newretweets = 0
            for(var index in retweets){
                var user_retweet = retweets[index].user.screen_name
                db.set('USER_' + user_retweet, retweets[index].user.id_str)
                if(user_retweet !== twitter_user){
                    if(tipped.indexOf(user_retweet) === -1){
                        db.sadd('RETWEET_' + tweet_id, user_retweet)
                        newretweets++
                        tipuser(user_retweet,'RETWEET',tweet_id,process.env.TIP_RETWEET, process.env.COIN)
                    }
                }
            }

            console.log('FOUND ' + newretweets + ' NEW RETWEETS!')
        }else{
            console.log('ERROR WHILE GETTING RETWEETS!', err.message)
        }
    })
}

export async function tipuser(twitter_user, action, id = '', amount, coin) {
    return new Promise(async response => {
        console.log('\x1b[32m%s\x1b[0m','TIPPING USER ' + twitter_user + ' WITH ' + amount + ' ' + coin + ' FOR ' + action + '!')
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

            var result = await message(
                twitter_user,
                'We\'ve createad an unique .sid file for you! You can download it from here: https://faucet.scryptachain.org/ids/' + ck.publicAddress + '.sid. You can import it into https://manent.scryptachain.org or https://id.scryptachain.org with this password: ' + password + "\n\nWe don't store that password so please safely store where you prefer and destroy this message! Keeps your funds SAFE!"
            )
            
            if(result === true){
                await axios.post('https://idanode01.scryptachain.org/init', { address: ck.publicAddress })
                pubAddr = ck.publicAddress
                db.set('ADDRESS_' + twitter_user,pubAddr)
            }else{
                Twitter.post('statuses/update', {status: "@"+twitter_user + " I wish send to you " + amount + ' $' + coin + ', but i can\'t send your private key. Please follow me!' })
            }
        }

        if(pubAddr !== ''){
            var wallet = new Crypto.Wallet;
            wallet.request('getinfo').then(function(info){
                var balance = info['result']['balance']
                if(balance > amount){
                    console.log('SENDING TO ADDRESS ' + pubAddr + ' ' + amount + ' ' + coin)
                    wallet.request('sendtoaddress',[pubAddr,parseInt(amount)]).then(function(txid){
                        Twitter.post('statuses/update', {status: "@"+twitter_user + " I've sent " + amount + " $" + coin + " to you! Check your TXID: " + txid['result'] + "!"})
                        console.log('TXID IS ' + txid['result'])
                        response(txid['result'])
                    })
                }else{
                    console.log('OPS, NOT ENOUGH FUNDS!')
                }
            })
        }
    })
}

export async function message(twitter_user, message) {
    return new Promise(async response => {
        console.log('SENDING MESSAGE TO ' + twitter_user)
        var twitter_id = await get("USER_" + twitter_user)
        if(twitter_id !== null){
            var msg = {"event": {"type": "message_create", "message_create": {"target": {"recipient_id": twitter_id}, "message_data": {"text": message}}}}
            Twitter.post('direct_messages/events/new', msg, function(err, data){
                if(data.event !== undefined){
                    response(true)
                }else{
                    response(false)
                }
            })
        }else{
            response(false)
            console.log("CAN'T FIND USER ID")
        }
    })
}