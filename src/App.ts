import * as express from 'express'
import * as Interface from "./routes/Interface"
import * as Twitter from "./routes/Twitter"
import * as Crypto from './libs/Crypto'
const exec = require('child_process')
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

    if (process.env.TWITTER_USERNAME !== undefined) {
      try {
        app.run()
      } catch (e) {
        console.log(e)
        console.log('ERROR WHILE RUNNING MAIN PROCESS')
      }
      setInterval(function () {
        try {
          app.run()
        } catch (e) {
          console.log(e)
          console.log('ERROR WHILE RUNNING MAIN PROCESS')
        }
      }, 180000)
    }
  }

  run() {
    var wallet = new Crypto.Wallet;
    wallet.request('getinfo').then(async info => {
      if (info !== undefined) {
        console.log('WALLET STATUS', info)
        await Twitter.ambassadors()
        await Twitter.followers(process.env.TWITTER_USERNAME)
        await Twitter.mentions(process.env.TWITTER_USERNAME)
        await Twitter.tag('$' + process.env.COIN, process.env.TWITTER_USERNAME)
        await Twitter.tag('#scrypta', process.env.TWITTER_USERNAME)
        await Twitter.tag('#scryptachain', process.env.TWITTER_USERNAME)
        console.log('ALL CHECKS FINISHED!')
      } else {
        console.log('WALLET NOT WORKING, CAN\'T START PROCESS!')
        try {
          console.log('Running wallet.')
          exec.exec('lyrad', {
            stdio: 'ignore',
            detached: true
          }).unref()
        } catch (e) {
          console.log("Can\'t run wallet, please run it manually!")
        }
      }
    })
  }
}

export default new App().express
