const { ObjectID } = require('mongodb');
const logger = require('../logger');
const globals = require('../models/Globals');
const items = require('../models/Items.' + 'persons'); // TODO: make persons a variable...

async function getItems(req, res, next) {
  try {
    const filter = req.body.filter;
    const flags = req.body.flags;

const lastScrapeTimestamp = await globals.find({ key: 'lastScrapeTimestamp' }).exec();
console.log(`lastScrapeTimestamp:`, lastScrapeTimestamp.value, typeof lastScrapeTimestamp.value);
    const itemsListDEBUG = await items.find();
    return res.status(200).json({ message: `${itemsListDEBUG.length} items found`, data: itemsListDEBUG });

    //const oldest = 1;
    //const lastScrapeTimestamp = // TODO: use the second solution after lastScrapeTimestamp exists in globals
      //await globals.findOne({ key: { $regex: /^lastScrapeTimestamp-/ } }, {}, { sort: { 'value': oldest } }).exec()
    const lastScrapeTimestamp = await globals.find({ key: 'lastScrapeTimestamp' }).exec();
console.log(`lastScrapeTimestamp:`, lastScrapeTimestamp.value, typeof lastScrapeTimestamp.value);

    const filterFresh = flags && flags.onlyFresh ? { isFresh: true } : {}; // select only fresh items, if requested
  //const filterFresh = flags && flags.onlyFresh ? { dateInserted: { $ge: lastScrapeTimestamp.value } } : {}, // select only fresh items, if requested
    const filterMissing = flags && flags.missingToo ? {} : { onHoliday: false, $or: [ { dateUpdated: { $gte: lastScrapeTimestamp.value } }, { immutable: true } ] }; // select missing items, too, if requested

    const itemsList = await items.
      find(
        {
          ...filter,
          ...filterFresh,
          ...filterMissing,
        },
        {
          _id: 0,
          missing: 1,
          dateUpdated: 1,
          provider: 1,
          id: 1,
          url: 1,
          title: 1,
          phone: 1,
          suspicious: 1,
          isFresh: 1,
          images: { $size: "$images" },
          comments: { $size: "$comments" },
        }
      ).
      select({ // TODO: what happens if an item has no main image? we want it too...
        images: 1, //{ $elemMatch: { category: 'main' }},
        comments: 1,
      }).
      sort({dateInserted: 'descending', dateUpdated: 'descending'})
    ;

    // TODO: check how long does this take for big queries...
    // calculate average vote for each item in list
    //for (let i = 0; i < itemsList.length; i++) {
    for (const item of itemsList) {
logger.debug(`item:`, item);
      //const item = itemsList[i];
      item.averageVote = item.comments.reduce((sum, value) => {
        return sum + value.vote;
      }, 0);
      delete item.comments;
    }
logger.debug(`itemsList:`, itemsList);

    res.status(200).json({ message: `${itemsList.length} items found`, data: itemsList });
  } catch (err) {
    res.status(500).json({ message: `can't get items: ${err}`, stack: err.stack });
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