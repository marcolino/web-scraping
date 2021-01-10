const { ObjectID } = require('mongodb');
const logger = require('../logger');
const items = require('../models/Items.' + 'persons'); // TODO: make persons a variable...

async function getItems(req, res, next) {
  try {
    const filter = req.body.filter;
    const itemsList = await items.
      find(
        { ...filter, missing: false, }, // TODO: forcing missing: false, should force only if not specified in request ...
        {missing: 1, _id: 0, provider:1, id:1, dateUpdated:1, url:1, title:1, imagesCount:1, commentsCount:1}
      ).
      select({
        images: { $elemMatch: {category: 'main'}}
      }).
      sort({dateUpdated: 'descending'})
    ;
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

async function test(req, res, next) {
  try {
    const item = req.body.item;
    const Items = require("../models/Items" + "." + 'persons');
    const persons = await Items.find({
      provider: item.provider,
      //id: '396863',
    });
    //logger.debug(persons);
    const arePresent = [];
    let presentsCount = 0;
    let absentsCount = 0;
    for (var i = 0; i < persons.length; i++) {
      const person = persons[i];
      let isPresent = await person.isPresent();
      arePresent.push({id: person.id, provider: person.provider, url: person.url, isPresent: isPresent, dateUpdated: person.dateUpdated});
      if (isPresent) presentsCount++; else absentsCount++;
    }
    res.status(200).json({ message: `persons are present: ${presentsCount}, are absent: ${absentsCount}`, presents: arePresent});
  } catch (err) {
    res.status(500).json({ message: `test error: ${err}` });
  }
}

module.exports = {
  getItems,
  insertItem,
  deleteItem,
  deleteItemById,
  updateItem,
  updateItemById,
  test,
};