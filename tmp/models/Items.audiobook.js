const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const name = "Items.audiobook";

const schema = new Schema({
  id: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    //enum: process.env.PROVIDERS, // TODO: what is this ???
    required: true
  },
  book: {
    url: String,
    title: String,
    author: {
      url: String,
      name: String,
    },
    coverUrl: String,
    chapters: [
      {
        url: String,
        title: String,
      }
    ],
    metadata: {
      title: String,
      orderingTitle: String,
      author: String,
      referenceWork: String,
      artist: String,
      cover: String,
      editedBy: String,
      license: String,
      publishDate: String,
      listWork: String,
      label: String,
      genre: String,
      BISAC_subject: String,
      ISBN: String,
      deweyDescriptor: String,
      reliability: String,
      recordingType: String,
      published: String,
      referenceWorkPublishingYear: String,
      revision: String,
    },
  },
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt'} }); // timestamps option: automatically add 'createdAt' and 'updatedAt' timestamps

schema.index({ id: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model(name, schema);