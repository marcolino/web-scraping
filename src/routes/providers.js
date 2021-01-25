const express = require('express');
const router = express.Router();
//const sum = require('hash-sum');
const { public, private } = require('../auth');
const { scrapeProviders, scrapeProvidersImages, groupProvidersItems, someCommonImages, itemsMerge } = require('../controllers/providers');
const logger = require('../logger');
const config = require('../config');

// endpoint to scrape items
router.post('/scrape', private, async (req, res, next) => {
  // set status to 202: the request has been accepted for processing, but the processing has not been completed. See https://tools.ietf.org/html/rfc7231#section-6.3.3.
  res.status(202).json({ message: "Started scraping process", data: {id: req.requestId}});
  await scrapeProviders(req);
  logger.info('finished scraping providers');
  await scrapeProvidersImages(req);
  logger.info('finished scraping providers images');
  //await groupProvidersItems(req);
  //logger.info('finished grouping items');
});

router.post('/group', private, async (req, res, next) => {
  try {
    // set status to 202: the request has been accepted for processing, but the processing has not been completed. See https://tools.ietf.org/html/rfc7231#section-6.3.3.
    res.status(202).json({ message: "Started grouping process", data: {id: req.requestId}});
    await groupProvidersItems(req);
    logger.info('finished grouping providers items');
  } catch (err) {
    logger.error(`error grouping providers items: ${err}`);
  }
});



// system only routes (debug and housekeeping)
router.post('/verifyConsistency', private, async (req, res, next) => {
  const type = "persons";
  const Items = require("../models/Items" + "." + type);
  const glob = require("glob");
  const path = require("path");

  try {
    let filter = req.body.filter ? req.body.filter : {};
    const project = {};

    logger.debug('filter:', filter);
    logger.debug('project:', project);
    const items = await Items.find(filter, project);
    logger.debug('items length:', items.length);

    // read providers data
    const providers = {};
    glob.sync('src/providers/*.js').forEach(file => {
      p = require(path.resolve(file));
      if (p.info) {
        providers[p.info.key] = p.info;
      }
    });

    // loop through all items
    let result = false;
    items.forEach(async (item) => {
      //logger.info(`verifyConsistency for item`, item.provider, item.id);
      if (!item.id) {
        logger.warn(`no id for item with _id`, item._id);
      }
      if (!item.provider) {
        logger.warn(`no provider for item with _id`, item._id);
      }
      result = true;
    });

    res.status(200).json({ message: "Finished verifying consistency", result });
  } catch (err) {
    res.status(500).json({ message: "Error verifying consistency", err });
  }
});

router.post('/debugSomeCommonImages', private, async (req, res, next) => {
  const type = "persons";
  const Items = require("../models/Items" + "." + type);
  const glob = require("glob");
  const path = require("path");

  try {
    let filterA = req.body.filterA ? req.body.filterA : {};
    let filterB = req.body.filterB ? req.body.filterB : {};
    const threshold = typeof req.body.threshold !== 'undefined' ? req.body.threshold : 0.20;
    const project = { provider: 1, id: 1, region: 1, title: 1, url: 1, images: 1 };

    if (filterA === 'new') filterA = { createdAt: { $gte: await globalsGet(`lastScrapeTimestamp`) } };
    if (filterB === 'new') filterB = { createdAt: { $gte: await globalsGet(`lastScrapeTimestamp`) } };

//filterA = { "title": { $regex: /[A-Z].*/ } };
//filterB = { "title": { $regex: /[A-Z].*/ } };

    logger.debug('filter A:', filterA);
    logger.debug('filter B:', filterB);
    logger.debug('threshold:', threshold);
    logger.debug('project:', project);
    const itemsA = await Items.find(filterA, project);
    const itemsB = await Items.find(filterB, project);
    logger.debug('items A length:', itemsA.length);
    logger.debug('items B length:', itemsB.length);

    // read providers data
    const providers = {};
    glob.sync('src/providers/*.js').forEach(file => {
      p = require(path.resolve(file));
      if (p.info) {
        providers[p.info.key] = p.info;
      }
    });

    // compare all items in A to all items in B
    const debugUrls = [];

    itemsA.forEach(async (itemA) => {
      const hashA = ((typeof itemA.id !== 'undefined' ? itemA.id : '') + (typeof itemA.id !== 'undefined' ? itemA.provider : '')).hashCode();
      itemsB.forEach(async (itemB) => {
        const hashB = ((typeof itemB.id !== 'undefined' ? itemB.id : '') + (typeof itemB.id !== 'undefined' ? itemB.provider : '')).hashCode();

        if (hashA >= hashB) { // avoid repeating a comparison of the same objects
          return;
        }

        //if (itemA.provider !== itemB.provider || itemA.id !== itemB.id) { // do not compare a key with itself
          if (commonImages = someCommonImages(itemA, itemB, threshold)) {
            //console.log('itemAll:', itemAll);
            //console.log('itemAll.provider:', itemAll.provider);
            //console.log('itemAll.region:', itemAll.region);
            const url1 = encodeURIComponent(providers[itemA.provider].regions[itemA.region].imagesUrl + itemA.url);
            const url2 = encodeURIComponent(providers[itemB.provider].regions[itemB.region].imagesUrl + itemB.url);
            const debugUrl = `http://localhost:${config.defaultServerPort}/debug/sci/?img1=${commonImages[0]}&img2=${commonImages[1]}&url1=${url1}&url2=${url2}`;
            debugUrls.push(debugUrl);
//             logger.debug(`
// item ${itemA.provider} ${itemA.id} ${itemA.title}
//  and ${itemB.provider} ${itemB.id} ${itemB.title}
// share some common images; see at ${debugUrl}
//             `);
          } else {
            //logger.debug(`item ${itemAll.title} and ${itemNew.title} DO NOT share some common images`);
          }
        //}
      });
    });

    res.status(200).json({ message: "Finished debugging someCommonImages", count: debugUrls.length, debugUrls });
  } catch (err) {
    res.status(500).json({ message: "Error debugging someCommonImages", err });
  }
});

router.post('/debugItemsMerge', private, async (req, res, next) => {
  const oldItem = req.body.oldItem ? req.body.oldItem :
  {
    images: [
      {
        url: 'abc',
        etag: 123,
      }, {
        url: 'def',
        etag: 456,
      }, {
        url: 'ghi',
        etag: 789,
      }
    ],
  };
//   {
//     comments: [
//       {
//         author: 'alice',
//         date: '2021-01-01',
//         text: 'bello',
//       }, {
//         author: 'bob',
//         date: '2021-01-02',
//         text: 'brutto',
//       }, {
//         author: 'charlie',
//         date: '2021-01-03',
//         text: 'così così',
//       }
//     ],
//   };
  const newItem = req.body.newItem ? req.body.newItem :
  {
    images: [
      {
        url: 'abc',
        etag: 1234,
      }, {
        url: 'def',
        etag: 4567,
      }
    ]
  };
//   {
//     comments: [
//       {
//         author: 'alice',
//         date: '2021-01-01',
//         text: 'bello',
//       }, {
//         author: 'bob',
//         date: '2021-01-02',
//         text: 'brutto',
//       }, {
//         author: 'charlie',
//         date: '2021-01-03',
//         text: 'così così',
//       }
//     ],
//   };
// }
  const mergedItems = itemsMerge(oldItem, newItem);
  res.status(200).json({ message: "Merged images:", data: mergedItems });
});

Object.defineProperty(String.prototype, 'hashCode', {
  value: function () {
    var hash = 0, i, chr;
    for (i = 0; i < this.length; i++) {
      chr = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // convert to 32bit integer
    }
    return hash;
  }
});

module.exports = router;