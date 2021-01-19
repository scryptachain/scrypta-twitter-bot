import * as express from 'express'
import * as Interface from "./routes/Interface"
import * as Twitter from "./routes/Twitter"
import * as Crypto from './libs/Crypto'
import * as Database from './libs/Database'
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
    app.express.get('/tips', Interface.returnLastTips)
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
        await Twitter.commands()
        await Twitter.followers(process.env.TWITTER_USERNAME)
        await Twitter.mentions(process.env.TWITTER_USERNAME)
        await Twitter.tag('$' + process.env.COIN, process.env.TWITTER_USERNAME)
        await Twitter.tag('#scrypta', process.env.TWITTER_USERNAME)
        await Twitter.tag('#scryptachain', process.env.TWITTER_USERNAME)

        const db = new Database.Mongo
        let endorsers = await db.find('followers', { endorse: { $exists: true } }, { address: 1 })
        
        console.log('FOUND ' + endorsers.length + ' ENDORSERS!')
        if (endorsers.length > 0) {
          for(let k in endorsers){
            let twitter_user = endorsers[k]
            console.log('CHECKING ' + twitter_user.screen_name)
            for(let k in twitter_user.endorse){
              let endorse = twitter_user.endorse[k]
              if(endorse.ignore === undefined || endorse.ignore === false){
                await Twitter.endorse(endorse.searcher, twitter_user, endorse.coin, endorse.tip)
              }
            }
          }
        }
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
