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

    var wallet = new Crypto.Wallet;

    if (process.env.TWITTER_USERNAME !== undefined) {
      wallet.request('getinfo').then(info => {
        if (info !== undefined) {
          console.log('WALLET STATUS', info)
          Twitter.followers(process.env.TWITTER_USERNAME)
          Twitter.mentions(process.env.TWITTER_USERNAME)
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

      setInterval(function () {
        wallet.request('getinfo').then(info => {
          if (info !== undefined) {
            console.log('WALLET STATUS', info)
            Twitter.followers(process.env.TWITTER_USERNAME)
            Twitter.mentions(process.env.TWITTER_USERNAME)
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
      }, 180000)
    }
  }
}

export default new App().express
