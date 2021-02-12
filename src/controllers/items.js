//const { getCountryCallingCode } = require('libphonenumber-js');
const { ObjectID } = require('mongodb');
const logger = require('../logger');
const { getProviders } = require('../utils/misc');
const globals = require('../models/Globals');
const items = require('../models/Items');

async function getItems(req, res, next) {
  try {
    const filter = req.body.filter;
    const flags = req.body.flags;

    // let hrstart = hrend = null;
    // hrstart = process.hrtime();
    // call();
    // hrend = process.hrtime(hrstart); logger.info(`call() execution time (hr): ${hrend[1] / 1000000} ms`);

    const filterOnlyNew = flags && flags.onlyNew ? { createdAt: { $gte: lastScrapeTimestamp.value } } : {}; // select only new items, if requested
    const filterOnlyNewAndChanged = flags && flags.onlyNewAndChanged ? { $or: [ { createdAt: { $gte: lastScrapeTimestamp.value } }, { changedAt: { $gte: lastScrapeTimestamp.value } } ] } : {}; // select only new items, if requested
    //const filterMissingToo = flags && flags.missingToo ? {} : { onHoliday: { $ne: true }, $or: [ { presentAt: { $gte: lastScrapeTimestamp.value } }, { immutable: true } ] }; // select missing items, too, if requested
    const filterSuspiciousToo = flags && flags.suspiciousToo ? {} : { suspicious: { $ne: true } }; // select suspicious items, too, if requested

    let itemsList = await items.
      find(
        {
          ...filter,
          ...filterOnlyNew,
          ...filterOnlyNewAndChanged,
          //...filterMissingToo,
          ...filterSuspiciousToo,
        },
        {
          _id: 0,
          //missing: 1,
          provider: 1,
          immutable: 1,
          id: 1,
          url: 1,
          title: 1,
          phone: 1,
          suspicious: 1,
          images: 1,
          comments: 1,
          onHoliday: 1,
          createdAt: 1,
          presentAt: 1,
          updatedAt: 1,
          changedAt: 1,
          //group: 1,
        }
      )
      // .select({ // TODO: what happens if an item has no main image? we want it too...
      //   images: 1,
      //   comments: 1,
      // })
      .sort({createdAt: 'descending', changedAt: 'descending', updatedAt: 'descending'})
      .lean()
    ;

    // populate missing prop
    const providers = getProviders();
    const timestamp = await globals.findOne({ key: 'lastScrapeTimestamp' }).exec();
let hrstart = hrend = null;
hrstart = process.hrtime();
      itemsList = itemsList.map(item => {
        const provider = Object.keys(providers).find(p => p === item.provider);
        const immutable = providers[provider].immutable;
        item.missing = item.onHoliday || (item.presentAt < timestamp && !item.immutable);
console.log(item.id, item.missing);
        delete item.onHoliday;
        delete item.presentAt;
        delete item.immutable;
        return item;
    });
hrend = process.hrtime(hrstart); logger.info(` * call(itemsList.map) execution time (hr): ${hrend[1] / 1000000} ms`);

    // return only main images if requested
    if (flags && flags.onlyMainImages) {
      itemsList = itemsList.map(item => {
        item.images = item.images.filter(image => image.category === 'main');
        return item;
      });
    }

    // return only commentsCount if requested
    if (flags && flags.onlyCommentsCount) {
      itemsList = itemsList.map(item => {
        item.commentsCount = item.comments ? item.comments.length : 0;
        //item.commentsVoteAverage = item.comments.filter(c => { console.log(c.vote); return typeof c.vote !== 'undefined' }).reduce((total, next) => { console.log('next.vote, total:', next.vote, total); return total + next.vote }, 0); // / item.comments.length;
        // start from -1
        item.commentsVoteAverage = item.comments.filter(c => typeof c.vote !== 'undefined').reduce((total, next) => parseInt(total) + parseInt(next.vote), -1);
        // if -1 is the result, no botes found, so return undefined; otherwise, add 1 to the result
        item.commentsVoteAverage = item.commentsVoteAverage === -1 ? undefined : item.commentsVoteAverage + 1;
        delete item.comments;
        return item;
      });
    }

    // TODO: check how long does this take for big queries...
    // calculate average vote for each item in list
    //for (let i = 0; i < itemsList.length; i++) {
// logger.debug(`itemsList for start: ${new Date()}`);
//     for (const item of itemsList) {
// //logger.debug(`item: ${item.comments.vote}`);
//       item.averageVote = item.comments.reduce((sum, value) => {
//         return sum + value.vote;
//       }, 0);
//       delete item.comments;
//     }
// //logger.debug(`itemsList: ${itemsList}`);
// logger.debug(`itemsList for end  : ${new Date()}`);

    //itemsList = groupBy(itemsList, item => item.group); // group items list (return only first item in each group)

    res.status(200).json({ message: `${itemsList.length} items found`, data: itemsList });
  } catch (err) {
    res.status(500).json({ message: `can't get items: ${err}`, stack: err.stack });
  }
}

/**
 * Function to group a list of objects by a key property value.
 * Only one (the first one) object with each key property value is kept, others are ignored.
 */
function groupBy(list, keyGetter) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyGetter(item);
    let collection = map.get(key);
    if (!collection) {
      //map.set(key, [item]);
      map.set(key, item);
    } else {
      //collection.push(item);
      collection = item;
    }
  });
  return map;
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
    const Items = require("../models/Items");
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