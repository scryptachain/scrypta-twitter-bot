#!/bin/bash

cd docker
if [[ "$@" =~ "-rebuild" ]]
then
    echo "Rebuilding Docker Image"
    docker build --no-cache -t bot:mongo .
else
    docker ps | grep 'bot_mongo' &> /dev/null
    if [ $? == 0 ]; then
        echo "Database docker exists yet, running istance."
        docker start bot_mongo
    else
        echo "Running MongoDB."
        docker build -t bot:mongo .
        docker run --restart=unless-stopped -d --name=bot_mongo -dit -p 27017:27017 bot:mongo
    fi
fi

docker exec bot_mongo mongod --bind_ip_all &