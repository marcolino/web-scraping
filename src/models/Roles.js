const mongoose = require("mongoose");
const config = require("../config");
//require("dotenv").config();
const Schema = mongoose.Schema;

const model = "Role";

const schema = new Schema([
  {
    id: {
      enum: config.roles,
    },
    name: {
      type: String,
    },
  }
]);

module.exports = mongoose.model(model, schema);