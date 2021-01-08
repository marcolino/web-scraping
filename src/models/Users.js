require("dotenv").config();
const config = require("../config");
const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const languages = require('language-list')().getLanguageCodes(); // ISO 639-1 languages list
const saltRounds = 10;

const Schema = mongoose.Schema;

const schema = new Schema({
  email: {
    type: String,
  },
  password: {
    type: String,
  },
  name: {
    type: String,
  },
  phone: {
    type: String,
  },
  role: {
    type: String,
    enum: config.roles,
  },
  language: {
    type: String,
    enum: languages,
  }
}, { timestamps: {createdAt: 'dateCreated', updatedAt: 'dateUpdated'} }); // timestamps option: automatically add "createdAt" and "updatedAt" timestamps

schema.index({ email: 1 }, { unique: true });

// hash user password before saving into database
schema.pre('save', function(next){
  this.password = bcrypt.hashSync(this.password, saltRounds);
  next();
});

module.exports = mongoose.model("Users", schema);