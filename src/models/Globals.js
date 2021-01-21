const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const schemaGlobals = new Schema([
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
schemaGlobals.index({ key: 1 }, { unique: true });

module.exports = mongoose.model("Globals", schemaGlobals);