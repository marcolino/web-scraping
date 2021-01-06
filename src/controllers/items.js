const { getDatabase } = require('./db');
const { ObjectID } = require('mongodb');

//const collectionName = 'items';
const collectionName = 'items.people';

async function insertItem(item) {
  const database = await getDatabase();
  database = null; // TO DEBUG ERRORS
  const { insertedId } = await database.collection(collectionName).insertOne(item);
  return insertedId;
}

async function getItems(filter = {}) {
  const database = await getDatabase();
  return await database.collection(collectionName).find(filter).toArray();
}

async function deleteItem(id) {
  const database = await getDatabase();
  await database.collection(collectionName).deleteOne({
    _id: new ObjectID(id),
  });
}

async function updateItem(id, item) {
  const database = await getDatabase();
  delete item._id;
  await database.collection(collectionName).update(
    { _id: new ObjectID(id), },
    {
      $set: {
        ...item,
      },
    },
  );
}

module.exports = {
  insertItem,
  getItems,
  deleteItem,
  updateItem,
};