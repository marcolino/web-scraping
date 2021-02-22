const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const model = "Audits";

const schema = new Schema([
  {
    key: {
      type: String,
    },
    value: [
      {
        date: {
          type: Date,
        },
        created: {
          type: Number,
        },
        changed: {
          type: Number,
        },
        updated: {
          type: Number,
        },
      }
    ],
  }
]);

// indexes
schema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model(model, schema);