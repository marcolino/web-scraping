 
const mongoose = require("mongoose");
const logger = require("../logger");
const config = require("../config");

dbConnect = async () => {
  try {
    await mongoose
      .connect(config.MONGO_URI, { // TODO: use process.env.MONGO_URI in production
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        autoIndex: true,
      })
    ;
    logger.info(`connected to database at ${config.MONGO_URI}`);
  } catch (err) {
    logger.error(`error connecting to database: ${err}`);
  }
}

dbClose = async() => {
  try {
    await mongoose.connection.close();
  } catch (err) {
    logger.error(`error disconnecting from database: ${err}`);
  }
}

module.exports = {
  dbConnect,
  dbClose,
};