const { MongoClient } = require("mongodb");

module Database {

    export class Mongo {
        client: any

        public find(collection, query = {}, sort?): any {
            return new Promise(async response => {
                try {
                    let client = new MongoClient("mongodb://localhost:27017", { useUnifiedTopology: true });
                    await client.connect();
                    const db = await client.db("bot");
                    let result
                    if(sort !== undefined){
                        result = await db.collection(collection).find(query).sort(sort).toArray()
                    }else{
                        result = await db.collection(collection).findOne(query)
                    }
                    await client.close();
                    response(result)
                } catch (e) {
                    console.log(e)
                    console.log('DB ERROR WHILE FINDING.')
                }
            })
        }

        public insert(collection, document): any {
            return new Promise(async response => {
                try {
                    let client = new MongoClient("mongodb://localhost:27017", { useUnifiedTopology: true });
                    await client.connect();
                    const db = await client.db("bot");
                    let result = await db.collection(collection).insertOne(document)
                    await client.close();
                    response(result)
                } catch (e) {
                    console.log(e)
                    console.log('DB ERROR WHILE INSERTING.')
                    response(false)
                }
            })
        }

        public update(collection, query, document): any {
            return new Promise(async response => {
                try {
                    let client = new MongoClient("mongodb://localhost:27017", { useUnifiedTopology: true });
                    await client.connect();
                    const db = await client.db("bot");
                    await db.collection(collection).updateOne(query, document)
                    let result = await db.collection(collection).findOne(query, document)
                    response(result)
                } catch (e) {
                    console.log(e)
                    console.log('DB ERROR WHILE UPDATING.')
                    response(false)
                }
            })
        }
    }

}

export = Database;