const mongoose = require("mongoose");
const mongooseHistory = require('mongoose-history');
const Schema = mongoose.Schema;
const name = "Items.audiobook";

const schema = new Schema({
  id: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: process.env.PROVIDERS, // TODO: what is this ???
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
}, { timestamps: {createdAt: 'dateCreated', updatedAt: 'dateUpdated'} }); // timestamps option: automatically add 'createdAt' and 'updatedAt' timestamps

schema.index({ id: 1, provider: 1 }, { unique: true });

schema.plugin(mongooseHistory, {
  customCollectionName: name + "." + "history",
  indexes: [{ 't': -1, 'd._id': 1 }],
  //historyConnection: mongoose.createConnection('mongodb://localhost/another_conn'),
}); // add support for history of changes

module.exports = mongoose.model(name, schema);