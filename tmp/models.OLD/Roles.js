require("dotenv").config();
const config = require("../config");
const mongoose = require("mongoose");

const Schema = mongoose.Schema;

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

module.exports = mongoose.model("Roles", schema);