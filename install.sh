#!/bin/bash
echo "STARTING DEPENDENCIES FOR FAUCET"
#INSTALL REDIS
sudo apt-get update -y
sudo apt-get install -y redis-server
sudo sed -i 's/appendonly no/appendonly yes/g' /etc/redis/redis.conf
sudo systemctl restart redis-server.service
sudo systemctl enable redis-server.service

#INSTALL NODEJS
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install pm2 -g

#DOWNLOAD SOURCES
git clone https://github.com/scryptachain/scrypta-faucet
touch scrypta-faucet/.env

echo "URL=http://localhost:3000
TWITTER_CONSUMERKEY=YOUR_CONSUMER_KEY
TWITTER_CONSUMERSECRET=YOUR_CONSUMER_SECRET
RPCUSER=YOUR_RPCUSER
RPCPASSWORD=YOUR_RPCPASSWORD
RPCPORT=YOUR_RPCPORT
RPCADDRESS=YOUR_RPCADDRESS
COININFO_PRIVATE=0xae
COININFO_PUBLIC=0x30
COININFO_SCRIPTHASH=0x0d
COIN=LYRA
TIP_FOLLOW=3
TIP_RETWEET=1
TIP_MENTION=2
TESTMODE=true" > scrypta-faucet/.env

cd scrypta-faucet
npm install
npm run tsc
cd dist
pm2 start index.js --watch --name scrypta-faucet
