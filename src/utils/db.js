 
const config = require("../config");
const mongoose = require("mongoose");

exports.dbConnect = async () => {
  try {
    console.log(`connecting to database at ${config.MONGO_URI}`);
    await mongoose
      .connect(config.MONGO_URI, { // TODO: use process.env.MONGO_URI in production
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        autoIndex: true,
      })
    ;
  } catch (err) {
    console.error(`error connecting to database: ${err}`);
  }
}

exports.dbClose = async() => {
  try {
    await mongoose.connection.close();
  } catch (err) {
    console.error(`error disconnecting from database: ${err}`);
  }
}