 
const config = require("../config");
const mongoose = require("mongoose");

exports.dbConnect = async () => {
  try {
    await mongoose
      .connect(config.mongoURI, {
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