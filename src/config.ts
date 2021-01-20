require('dotenv').config()

module.exports = {
  consumer_key: process.env.TWITTER_PUBLISHERKEY,  
  consumer_secret: process.env.TWITTER_PUBLISHERSECRET,
  access_token: process.env.TWITTER_ACCESSTOKEN,  
  access_token_secret: process.env.TWITTER_TOKENSECRET
}