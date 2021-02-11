const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const model = "Global";

const schema = new Schema([
  {
    key: {
      type: String,
    },
    value: {
      type: Schema.Types.Mixed,
    },
  }
]);

// indexes
schema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model(model, schema);