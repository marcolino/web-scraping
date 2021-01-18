const mongoose = require("mongoose");
const logger = require("../logger");
const Schema = mongoose.Schema;
const name = "Items.persons";
const Globals = require("../models/Globals");

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
  // imagesCount: {
  //   type: Number,
  // },
  adClass: {
    type: String,
  },
  price: {
    type: Number,
  },
  additionalInfo: {
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
      vote: {
        type: Number, // [ 0 - 1 ]
      },
    }
  ],
  // commentsCount: {
  //   type: Number,
  // },
  adUrlReferences: [
    {
      type: String,
    },
  ],
  suspicious: {
    type: Boolean,
  },
  wasNew: {
    type: Boolean,
  },
  wasModified: {
    type: Boolean,
  },
  // isPresent: {
  //   type: Boolean,
  // }
}, { timestamps: {createdAt: 'dateCreated', updatedAt: 'dateUpdated'} }); // timestamps option: automatically add 'createdAt' and 'updatedAt' timestamps

// indexes
schemaPersons.index({ id: 1, provider: 1, region: 1 }, { unique: true });

// schemaPersons.pre('save', function(next) {
//   this.wasNew = this.isNew;
//   if (this.wasNew) {
//     logger.info(`NEW ITEM DETECTED IN PRE SAVE !`);
//   }
//   const props = [
//     'title',
//     'subtitle',
//     'url',
//     'address',
//     'phone',
//     'contactInstructions',
//     'ethnicity',
//     'nationality',
//     'age',
//     'eyesColor',
//     'hairColor',
//     'pubicHair',
//     'tatoo',
//     'piercings',
//     'height',
//     'weight',
//     'breastSize',
//     'breastType',
//     'shoeSize',
//     'smoker',
//     'spokenLanguages',
//     'sexualOrientation',
//     //'images',
//     //'imagesCount',
//     'adClass',
//     'price',
//     'additionalInfo',
//     'onHoliday',
//     'services',
//     //'comments',
//     //'commentsCount',
//     'adUrlReferences',
//     'suspicious',
//   ];
//   const wasModified = [];
//   for (let i = 0; i < props.length; i++) {
//     const prop = props[i];
//     if (this.isModified(prop)) {
//       wasModified.push(prop);
//     }
//   }
//   if (wasModified.length) {
//     logger.debug(`Changed props: ${wasModified} DETECTED IN PRE SAVE`);
//     wasModified.forEach(prop => logger.debug(` - ${prop}: ${this[prop]}`));
//     this.wasModified = wasModified;
//   } else {
//     //logger.debug(`No changed props DETECTED IN PRE SAVE`);
//   }

//   next();
// });

// schemaPersons.post('save', next => {
//   if (this.isFresh) {
//     // ...
//   }
//   next();
// });

// TODO: this doesn't looks like it's working
// schemaPersons.pre('validate', (next) => {
//   this.imagesCount = this.images.length;
//   this.commentsCount = this.comments.length;
//   logger.warn(`*********************** PRE VALIDATE:, ${this.images.length}, ${this.imagesCount}, ${this.commentsCount}`);
//   next();
// });

// // static class (model) methods
// schemaPersons.statics.isPresent = async(item) => {
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
schemaPersons.methods.isPresent = async() => {
  try {
    const lastScrapeTimestamp = await mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp-${this.provider}` }).exec();
    //logger.debug(`lastScrapeTimestamp: ${lastScrapeTimestamp.value} <= this.dateUpdated: ${this.dateUpdated}`);
    return this.dateUpdated >= lastScrapeTimestamp.value;
  } catch (err) {
    throw(new Error(`error in schemaPersons.methods.isPresent: ${err}`));
  }
};

schemaPersons.methods.isFreshy = async() => { // TODO: possibly unused, if isFresh workls as expected...
  try {
    const lastScrapeTimestamp = await mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp-${this.provider}` }).exec();
logger.debug(`this.dateInserted: ${this.dateInserted} >=? lastScrapeTimestamp: ${lastScrapeTimestamp.value}`);
    return this.dateInserted >= lastScrapeTimestamp.value;
  } catch (err) {
    throw (new Error(`error in schemaPersons.methods.isFreshy: ${err}`));
  }
};

schemaPersons.virtual('imagesCount').get(function() {
  if (this.images) {
    return this.images.length;
  } else {
    return 0;
  }
});

schemaPersons.virtual('commentsCount').get(function() {
  if (this.comments) {
    return this.comments.length;
  } else {
    return 0;
  }
});

module.exports = mongoose.model(name, schemaPersons);