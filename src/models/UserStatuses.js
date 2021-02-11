const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const model = "UserStatus";

const schema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Items',
    required: true
  },
  vote: {
    type: Number,
    min: 0,
    max: 1
  },
  note: {
    type: String
  },
  hide: {
    type: Boolean,
  }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt'} }); // timestamps option: automatically add "createdAt" and "updatedAt" timestamps

schema.index({ user: 1, item: 1 }, { unique: true });

module.exports = mongoose.model(model, schema);