const { ObjectID } = require('mongodb');
const items = require('../models/Items.' + 'persons'); // TODO: make persons a variable...

async function getItems(req, res, next) {
  try {
    const filter = req.body.filter;
    const itemsList = await items.find(filter);
    res.status(200).json({ message: `${itemsList.length} items found`, data: itemsList });
  } catch (err) {
    res.status(500).json({ message: `can't get items: ${err}` });
  }
}

async function insertItem(req, res, next) {
  try {
    const item = req.body.item;
    const { insertedId } = await items.insertOne(item);
    res.status(200).json({ message: `item inserted`, data: { id: insertedId } });
  } catch (err) {
    res.status(500).json({ message: `can't insert item: ${err}` });
  }
}

async function deleteItem(req, res, next) {
  try {
    const item = req.body.item;
    await item.deleteOne({
      provider: item.provider, id: item.id
    });
    res.status(200).json({ message: `item deleted` });
  } catch (err) {
    res.status(500).json({ message: `can't delete item: ${err}` });
  }
}

async function deleteItemById(req, res, next) {
  try {
    const id = req.body.id;
    await item.deleteOne({
      _id: new ObjectID(id),
    });
    res.status(200).json({ message: `item deleted by id` });
  } catch (err) {
    res.status(500).json({ message: `can't delete item by id: ${err}` });
  }
}

async function updateItem(req, res, next) {
  try {
    const item = req.body.item;
    await items.updateOne(
      { provider: item.provider, id: item.id },
      {
        $set: {
          ...item,
        },
      },
    );
    res.status(200).json({ message: `item updated` });
  } catch (err) {
    res.status(500).json({ message: `can't update item: ${err}` });
  }
}

async function updateItemById(id) {
  try {
    const id = req.body.id;
    const item = req.body.item;
    await item.updateOne(
      { _id: new ObjectID(id), },
      {
        $set: {
          ...item,
        },
      },
    );
    res.status(200).json({ message: `item updated by id` });
  } catch (err) {
    res.status(500).json({ message: `can't update item by id: ${err}` });
  }
}

module.exports = {
  getItems,
  insertItem,
  deleteItem,
  deleteItemById,
  updateItem,
  updateItemById,
};