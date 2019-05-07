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
    
    if(process.env.TWITTER_WATCHACCOUNT !== undefined){
      Twitter.followers(process.env.TWITTER_WATCHACCOUNT)
      Twitter.tweets(process.env.TWITTER_WATCHACCOUNT)
      Twitter.mentions(process.env.TWITTER_WATCHACCOUNT)
      
      setInterval(function(){
        Twitter.followers(process.env.TWITTER_WATCHACCOUNT)
        Twitter.tweets(process.env.TWITTER_WATCHACCOUNT)
        Twitter.mentions(process.env.TWITTER_WATCHACCOUNT)
      },180000)
    }
  }
}

export default new App().express
