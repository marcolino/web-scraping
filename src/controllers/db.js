var mongoose = require('mongoose');
//const { MongoMemoryServer } = require('mongodb-memory-server');
//const { MongoClient } = require('mongodb');
const config = require('../config');

let database = null;

async function startDatabase() {
  // set up default mongoose connection
  await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useCreateIndex: true,
    //useFindAndModify: false,
    //autoIndex: true,
  });

  // get the default connection
  database = mongoose.connection;

  // bind connection to error event (to get notification of connection errors)
  database.on('error', console.error.bind(console, 'MongoDB connection error:')); // TODO!
};

async function getDatabase() {
  if (!database) await startDatabase();
  return database;
}



// let database = null;

// async function startDatabase() {
//   const mongo = new MongoMemoryServer();
//   const mongoDBURL = await mongo.getConnectionString();
//   const connection = await MongoClient.connect(mongoDBURL, {
//     useUnifiedTopology: true,
//     useNewUrlParser: true,
//     //useCreateIndex: true,
//     //useFindAndModify: false,
//     //autoIndex: true,
//   });
//   database = connection.db();
// }

// async function getDatabase() {
//   if (!database) await startDatabase();
//   return database;
// }

module.exports = {
  getDatabase,
  startDatabase,
};