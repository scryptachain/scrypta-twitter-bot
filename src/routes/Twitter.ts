import express = require("express")
var twit = require('twit')
var config = require('../config.js');
var Twitter = new twit(config);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function followers(twitter_user) {
    console.log('LOOKING FOR @'+twitter_user+' FOLLOWER')
    Twitter.get('followers/list', { screen_name: twitter_user, count: 30 },function(err, data){
        if (!err) {
            var followers = data.users
            console.log('FOUND ' + followers.length + ' FOLLOWERS')
            for(var index in followers){
                var user_follow = followers[index].screen_name
                console.log('TIPPING USER ' + user_follow + ' FOR FOLLOW!')
            }
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
                retweets(tweet['id_str'], index)
            }
        }else{
            console.log('ERROR WHILE GETTING USER TIMELINE!', err.message)
        }
    })
};

export async function mentions(twitter_user) {
    console.log('LOOKING FOR @'+twitter_user+' MENTIONS')
    Twitter.get('search/tweets', {q: '@' + twitter_user}, function(err, data) {
        if(!err){
            var found = data.statuses
            var mentions = []
            for(var index in found){
                if(found[index].user !== twitter_user){
                    mentions.push(found[index])
                }
            }
            console.log('FOUND ' + mentions.length + ' MENTIONS')
            for(var index in mentions){
                var user_mention = mentions[index].user.screen_name
                console.log('TIPPING USER ' + user_mention + ' FOR A MENTION!')
            }
        }else{
            console.log('ERROR WHILE GETTING USER MENTIONS!', err.message)
        }
    })
};

export async function retweets(tweet_id, count) {
    await sleep(2000 * count)
    console.log('LOOKING FOR '+ tweet_id +' RETWEETS!')
    Twitter.get('statuses/retweets/:id', { id: tweet_id }, function(err, data){
        if(!err){
            var retweets = data
            console.log('FOUND ' + retweets.length + ' RETWEETS!')
            for(var index in retweets){
                var user_retweet = retweets[index].user.screen_name
                console.log('TIPPING USER ' + user_retweet + ' FOR A MENTION!')
            }
        }else{
            console.log('ERROR WHILE GETTING RETWEETS!', err.message)
        }
    })
}

export async function message(twitter_user, message) {
    console.log('SENDING MESSAGE TO ' + twitter_user)
}