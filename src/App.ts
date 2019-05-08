import * as express from 'express'
import * as Utilities from './libs/Utilities'
import * as Interface from "./routes/Interface"
import * as Twitter from "./routes/Twitter"

var bodyParser = require('body-parser')
var cors = require('cors')

class App {
  public express

  constructor () {
    const app = this
    app.express = express()
    app.express.use(express.static('public'))
    app.express.use(bodyParser.json())
    app.express.use(bodyParser.urlencoded({extended: true}))
    app.express.use(cors())
    
    app.express.get('/',Interface.rendervue)

    app.express.get('/twitter/request-token',Twitter.getAuth)
    app.express.get('/twitter/callback',Twitter.getAccessToken)

    if(process.env.TWITTER_USERNAME !== undefined){
      Twitter.followers(process.env.TWITTER_USERNAME)
      //Twitter.tweets(process.env.TWITTER_USERNAME)
      Twitter.mentions(process.env.TWITTER_USERNAME)
      
      setInterval(function(){
        Twitter.followers(process.env.TWITTER_USERNAME)
        //Twitter.tweets(process.env.TWITTER_USERNAME)
        Twitter.mentions(process.env.TWITTER_USERNAME)
      },180000)
    }
  }
}

export default new App().express
