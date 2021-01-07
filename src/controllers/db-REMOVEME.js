var mongoose = require('mongoose');
//const { MongoMemoryServer } = require('mongodb-memory-server');
//const { MongoClient } = require('mongodb');
const config = require('../config');

let database = null;

exports.startDatabase = async() => {
  // set up default mongoose connection
  await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    autoIndex: true,
  });

  // get the default connection
  database = mongoose.connection;

  // bind connection to error event (to get notification of connection errors)
  database.on('error', console.error.bind(console, 'MongoDB connection error:')); // TODO!
};

exports.dbClose = async() => {
  await mongoose.connection.close();
}