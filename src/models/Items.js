const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Globals = require("../models/Globals");
const logger = require("../logger");

const model = "Item";

const schema = new Schema({
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
  // immutable: {
  //   type: Boolean,
  // },
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
  dressSize: {
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
      type: String,
    },
    category: {
      type: String,
    },
    date: {
      type: Date,
    },
    etag: {
      type: String,
    },
    phash: {
      type: String,
    },
    localPath: {
      type: String,
    },
    active: {
      type: Boolean,
    },
    duplicate: {
      type: Boolean,
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
  // services: {
  //   type: Schema.Types.Mixed,
  //   default: {},
  // },
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
  // wasNew: {
  //   type: Boolean,
  // },
  // wasModified: {
  //   type: Boolean,
  // },
  // isPresent: {
  //   type: Boolean,
  // }
  group: {
    type: String,
  },
  presentAt: {
    type: Date,
  },
  changedAt: {
    type: Date,
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt'},
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
}); // timestamps option: automatically add 'createdAt' and 'updatedAt' timestamps

// indexes
schema.index({ id: 1, provider: 1/*, region: 1*/ }, { unique: true });

// // virtual methods
// schema.virtual('missing').get(function() { // TODO: check performance of this method !
  //   const timestamp = await Globals.findOne({ key: 'lastScrapeTimestamp' }).exec();
  //   return (
  //     this.onHoliday || (this.presentAt < timestamp && !this.immutable)
  //   );
// });

// schema.pre('save', function(next) {
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
//     'dressSize',
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

// schema.post('save', next => {
//   if (this.isFresh) {
//     // ...
//   }
//   next();
// });

// TODO: this doesn't looks like it's working
// schema.pre('validate', (next) => {
//   this.imagesCount = this.images.length;
//   this.commentsCount = this.comments.length;
//   logger.warn(`*********************** PRE VALIDATE:, ${this.images.length}, ${this.imagesCount}, ${this.commentsCount}`);
//   next();
// });

// // static class (model) methods
// schema.statics.isPresent = async(item) => {
//     try {
//       const result = mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp`/*-${item.provider}`*/).exec();
//       cons item = this.model('items.persons').findOne({provider: item.provider, id: item.id}).exec();
//       return result.value <= item.dateUpdated;
//     });
//   });
//   } catch (err) {
//     throw(new Error(`error in schema.statics.isPresent: ${err}`));
//   }
// };

// object (instance) methods
schema.methods.isPresent = async() => {
  try {
    const lastScrapeTimestamp = await mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp`/*-${this.provider}`*/ }).exec();
    //logger.debug(`lastScrapeTimestamp: ${lastScrapeTimestamp.value} <= this.dateUpdated: ${this.dateUpdated}`);
    return this.dateUpdated >= lastScrapeTimestamp.value;
  } catch (err) {
    throw(new Error(`error in schema.methods.isPresent: ${err}`));
  }
};

schema.methods.isFreshy = async() => { // TODO: possibly unused, if isFresh works as expected...
  try {
    const lastScrapeTimestamp = await mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp`/*-${this.provider}`*/ }).exec();
logger.debug(`this.dateInserted: ${this.dateInserted} >=? lastScrapeTimestamp: ${lastScrapeTimestamp.value}`);
    return this.dateInserted >= lastScrapeTimestamp.value;
  } catch (err) {
    throw(new Error(`error in schema.methods.isFreshy: ${err}`));
  }
};

schema.virtual('imagesCount').get(function() {
  if (this.images) {
    return this.images.length;
  } else {
    return 0;
  }
});

schema.virtual('commentsCount').get(function() {
  if (this.comments) {
    return this.comments.length;
  } else {
    return 0;
  }
});

module.exports = mongoose.model(model, schema);