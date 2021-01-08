const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const name = "Items.persons";
const Globals = require("../models/Globals");

const schemaImage = new Schema({
  url: {
    type: String
  },
  category: {
    type: String,
  },
  date: {
    type: Date
  },
  etag: {
    type: String
  },
  localPath: {
    type: String
  },
},
{
  _id : false }
);

const schemaPersons = new Schema({
  id: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    enum: process.env.PROVIDERS, // TODO!
    required: true,
  },
  region: {
    type: String,
    required: true,
  },
  immutable: {
    type: Boolean,
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
  images: [{ 
    url: {
      type: String
    },
    category: {
      type: String,
    },
    date: {
      type: Date
    },
    etag: {
      type: String
    },
    localPath: {
      type: String
    },
  }],
  adClass: {
    type: String,
  },
  price: {
    type: Number,
  },
  additionalInfo: {
    type: String,
  },
  missing: {
    type: Boolean,
    default: false,
  },
  holiday: {
    type: Boolean,
    default: false,
  },
  services: {
    type: Schema.Types.Mixed,
    default: {},
  },
  // images: [
  //   {
  //     data: Buffer,
  //     contentType: String,
  //   }
  // ],
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
  adUrlReferences: [
    {
      type: String,
    },
  ],
  suspicious: {
    type: Boolean,
  },
}, { timestamps: {createdAt: 'dateCreated', updatedAt: 'dateUpdated'} }); // timestamps option: automatically add 'createdAt' and 'updatedAt' timestamps

// indexes
schemaPersons.index({ id: 1, provider: 1, region: 1 }, { unique: true });

// // static class (model) methods
// schemaPersons.statics.isPresent = async function(item) {
//     try {
//       const result = mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp-${item.provider}`).exec();
//       cons item = this.model('items.persons').findOne({provider: item.provider, id: item.id}).exec();
//       return result.value <= item.dateUpdated;
//     });
//   });
//   } catch (err) {
//     throw(new Error(`error in schemaPersons.statics.isPresent: ${err}`));
//   }
// };

// object (instance) methods
schemaPersons.methods.isPresent = async function() {
  try {
    const result = await mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp-${this.provider}` }).exec();
    return result.value <= this.dateUpdated;
  } catch (err) {
    throw(new Error(`error in schemaPersons.methods.isPresent: ${err}`));
  }
};

// virtual properties
schemaPersons.virtual('image').get(function() {
  return (
    this.imageUrl ? this.imageUrl :
    this.imageUrls && this.imageUrls.length ? this.imageUrls[0] :
    this.imageFullSizeUrls && this.imageFullSizeUrls.length ? this.imageFullSizeUrls[0] :
    ''
  );
});

module.exports = mongoose.model(name, schemaPersons);