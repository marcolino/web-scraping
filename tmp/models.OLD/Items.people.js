const mongoose = require('mongoose');
const mongooseHistory = require('mongoose-history');
const Schema = mongoose.Schema;
const name = "items.people";

const schema = new Schema({
  id: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: process.env.PROVIDERS,
    required: true
  },
  title: {
    type: String,
  },
  subtitle: {
    type: String,
  },
  url: {
    type: String,
  },
  address: {
    type: String,
  },
  phone: {
    type: String,
  },
  contactInstructions: {
    type: String,
  },
  ethnicity: {
    type: String,
  },
  nationality: {
    type: String,
  },
  age: {
    type: String,
  },
  eyesColor: {
    type: String,
  },
  hairColor: {
    type: String,
  },
  pubicHair: {
    type: String,
  },
  tatoo: {
    type: String,
  },
  piercings: {
    type: String,
  },
  height: {
    type: String,
  },
  weight: {
    type: String,
  },
  breastSize: {
    type: String,
  },
  breastType: {
    type: String,
  },
  shoeSize: {
    type: String,
  },
  smoker: {
    type: Boolean,
  },
  spokenLanguages: [
    {
      type: String,
    },
  ],
  sexualOrientation: {
    type: String,
  },
  selfDescription: {
    type: String,
  },
  imageUrl: {
    type: String,
  },
  imageUrls: [
    {
      type: String,
    }
  ],
  imageFullSizeUrls: [
    {
      type: String,
    }
  ],
  adClass: {
    type: String,
  },
  price: {
    type: Number,
  },
  additionalInfo: {
    type: String,
  },
  selfDescription: {
    type: String,
  },
  // missing: {
  //   type: Boolean,
  //   default: false,
  // },
  onHoliday: {
    type: Boolean,
    default: false,
  },
  services: {
    type: Schema.Types.Mixed,
    default: {},
  },
  images: [
    {
      data: Buffer,
      contentType: String,
    }
  ],
  comments: [
    {
      author: {
        type: String,
      },
      authorCommentsCount: {
        type: Number,
      },
      text: {
        type: String,
      },
      date: {
        type: Date,
      },
    }
  ],
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt'} }); // timestamps option: automatically add 'createdAt' and 'updatedAt' timestamps

schema.index({ id: 1, provider: 1 }, { unique: true });

schema.plugin(mongooseHistory, {
  customCollectionName: name + "History",
  indexes: [{ 't': -1, 'd._id': 1 }],
  //historyConnection: mongoose.createConnection('mongodb://localhost/another_conn'),
}); // add support for history of changes

module.exports = mongoose.model(name, schema);