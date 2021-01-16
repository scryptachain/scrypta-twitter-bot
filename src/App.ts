import * as express from 'express'
import * as Interface from "./routes/Interface"
import * as Twitter from "./routes/Twitter"
import * as Crypto from './libs/Crypto'

var bodyParser = require('body-parser')
var cors = require('cors')

class App {
  public express

  constructor() {
    const app = this
    app.express = express()
    app.express.use(express.static('public'))
    app.express.use(bodyParser.json())
    app.express.use(bodyParser.urlencoded({ extended: true }))
    app.express.use(cors())

    app.express.get('/', Interface.rendervue)

    app.express.get('/twitter/request-token', Twitter.getAuth)
    app.express.get('/twitter/callback', Twitter.getAccessToken)

    var wallet = new Crypto.Wallet;
    wallet.request('getinfo').then(info => {
      if (info !== undefined) {
        console.log('WALLET STATUS', info)
        if (process.env.TWITTER_USERNAME !== undefined) {
          Twitter.followers(process.env.TWITTER_USERNAME) 
          Twitter.mentions(process.env.TWITTER_USERNAME)

          setInterval(function () {
            wallet.request('getinfo').then(info => {
              if (info !== undefined) {
                console.log('WALLET STATUS', info)
                Twitter.followers(process.env.TWITTER_USERNAME)
                Twitter.mentions(process.env.TWITTER_USERNAME)
              } else {
                console.log('WALLET NOT WORKING, CAN\'T START PROCESS!')
              }
            })
          }, 180000)
        }
      } else {
        console.log('WALLET NOT WORKING, CAN\'T START PROCESS!')
      }
    })
  }
}

export default new App().express
