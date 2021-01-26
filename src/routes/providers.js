const express = require('express');
const router = express.Router();
const fs = require('fs');
const glob = require("glob");
const path = require("path");
const { public, private } = require('../auth');
const { scrapeProviders, scrapeProvidersImages, groupProvidersItems, someCommonImages, itemsMerge, showCommonImages } = require('../controllers/providers');
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

  try {
    let filter = req.body.filter ? req.body.filter : {};
    const project = {};

    logger.debug('filter:', filter);
    logger.debug('project:', project);
    const items = await Items.find(filter, project);
    logger.debug('items length:', items.length);

    // loop through all items
    let result = true;
    items.forEach(async (item) => {
      //logger.info(`verifyConsistency for item`, item.provider, item.id);
      if (!item.id) {
        logger.warn(`no id for item with _id`, item._id);
        result = false;
      }
      if (!item.provider) {
        logger.warn(`no provider for item with _id`, item._id);
        result = false;
      }

      // TODO: verify there are no duplicate images in this item
      item.images.forEach(async (image) => {
      });

      // TODO: verify there are no duplicate comments in this item

    });

    res.status(200).json({ message: "Finished verifying consistency", result });
  } catch (err) {
    res.status(500).json({ message: "Error verifying consistency", err });
  }
});

router.post('/verifyOrpanedImages', private, async (req, res, next) => {
  const type = "persons";
  const Items = require("../models/Items" + "." + type);

  const result = {};

  try {
    let filter = req.body.filter ? req.body.filter : {};
    const project = {};

    logger.debug('filter:', filter);
    logger.debug('project:', project);
    const items = await Items.find(filter, project);
    logger.debug('items length:', items.length);

    // get images paths in db
    const images = new Set();
    items.forEach(async (item) => {
      item.images.forEach(async (image) => {
        if (image.localPath) {
          images.add(`${image.localPath}`);
          //console.log(` db ${image.localPath}`);
        }
      });
    });
    logger.debug('images on db count:', images.size)

    // read images files on fs
    const files = new Set();
    fs.readdirSync(config.imagesBaseFolder).forEach(dir => {
      //console.log(`dir: ${dir}`);
      fs.readdirSync(`${config.imagesBaseFolder}${dir}`).forEach(file => {
        files.add(`${config.imagesBaseFolder}${dir}/${file}`);
        //console.log(` fs ${config.imagesBaseFolder}${dir}/${file}`);
      });
    });
    logger.debug('image files on fs count:', files.size)

    result.count = {
      equal: (images.size === files.size),
      images: images.size,
      files: files.size,
    };
    if (images.size !== files.size) {
      logger.warn(`images on db (${images.size}) differ by image files on fs (${files.size})`);
    }

    result.orphaned = {};

    let orphanedImages = new Set(
      [...images].filter(i => !files.has(i))
    );
    result.orphaned.images = Array.from(orphanedImages);
    console.log('orphanedImages:', orphanedImages);

    result.orphaned.imagesSize = orphanedImages.size;
    if (orphanedImages.size > 0) {
      logger.warn(`db images that have no files in fs: ${orphanedImages.size}`);
    }

    let orphanedFiles = new Set(
      [...files].filter(f => !images.has(f))
    );
    result.orphaned.files = Array.from(orphanedFiles);
    result.orphaned.filesSize = orphanedFiles.size;
    if (orphanedFiles.size > 0) {
      logger.warn(`fs files that have no images in db: ${orphanedFiles.size}`);
    }

    res.status(200).json({ message: "Finished verifying consistency", result });
  } catch (err) {
    logger.error(err.toString());
    res.status(500).json({ message: "Error verifying consistency", err: err.toString() });
  }
});

router.post('/debugSomeCommonImages', private, async (req, res, next) => {
  const type = "persons";
  const Items = require("../models/Items" + "." + type);

  try {
    let filterA = req.body.filterA ? req.body.filterA : {};
    let filterB = req.body.filterB ? req.body.filterB : {};
    const threshold = typeof req.body.threshold !== 'undefined' ? req.body.threshold : 0.02;
    const project = { provider: 1, id: 1, region: 1, title: 1, url: 1, images: 1 };

    if (filterA === 'new') filterA = { createdAt: { $gte: await globalsGet(`lastScrapeTimestamp`) } };
    if (filterB === 'new') filterB = { createdAt: { $gte: await globalsGet(`lastScrapeTimestamp`) } };

    //filterA = { "title": { $regex: /[A-Z].*/ } };
    //filterB = { "title": { $regex: /[A-Z].*/ } };

    const itemsA = await Items.find(filterA, project);
    const itemsB = await Items.find(filterB, project);

    logger.debug('filter A:', filterA);
    logger.debug('filter B:', filterB);
    logger.debug('threshold:', threshold);
    logger.debug('project:', project);
    logger.debug('items A length:', itemsA.length);
    logger.debug('items B length:', itemsB.length);

    // get all providers data
    const providers = getProviders();

    // compare all items in A to all items in B
    const showUrls = [];
    itemsA.forEach(async (itemA) => {
      const hashA = ((typeof itemA.id !== 'undefined' ? itemA.id : '') + (typeof itemA.id !== 'undefined' ? itemA.provider : '')).hashCode();
      itemsB.forEach(async (itemB) => {
        const hashB = ((typeof itemB.id !== 'undefined' ? itemB.id : '') + (typeof itemB.id !== 'undefined' ? itemB.provider : '')).hashCode();

        if (hashA >= hashB) { // avoid repeating a comparison of the same objects
          return;
        }

        if (commonImages = someCommonImages(itemA, itemB, threshold)) {
          // const url1 = encodeURIComponent(providers[itemA.provider].regions[itemA.region].imagesUrl + itemA.url);
          // const url2 = encodeURIComponent(providers[itemB.provider].regions[itemB.region].imagesUrl + itemB.url);
          // const debugUrl = `http://localhost:${config.defaultServerPort}/debug/sci/?img1=${commonImages[0]}&img2=${commonImages[1]}&url1=${url1}&url2=${url2}`;
          // showUrls.push(debugUrl);
          showUrls.push(showCommonImages(providers, [itemA, itemB], commonImages));
        } else {
          //logger.debug(`item ${itemAll.title} and ${itemNew.title} DO NOT share some common images`);
        }
      });
    });

    res.status(200).json({ message: "Finished debugSomeCommonImages", count: showUrls.length, showUrls });
  } catch (err) {
    res.status(500).json({ message: "Error debugSomeCommonImages", err });
  }
});

router.post('/verifyDuplicateImagesForPerson', private, async (req, res, next) => {
  const type = "persons";
  const Items = require("../models/Items" + "." + type);

  try {
    const filter = req.body.filter;
    const threshold = typeof req.body.threshold !== 'undefined' ? req.body.threshold : 0.20;
    const project = { provider: 1, id: 1, region: 1, title: 1, url: 1, images: 1 };

    logger.debug('filter:', filter);
    logger.debug('threshold:', threshold);
    logger.debug('project:', project);
    const items = await Items.find(filter, project);
    logger.debug('selected items count:', items.length);

    // get all providers data
    const providers = getProviders();

    // compare all items images
    const showUrls = [];
    items.forEach(async (item) => {
      if (commonImages = someCommonImages(item, item, threshold)) { // TODO: skip same image
        showUrls.push(showCommonImages(providers, [item, item], commonImages));
      } else {
        //logger.debug(`item ${item.provider} ${item.id} ${item.title} DO NOT have duplicate images`);
      }
    });

    res.status(200).json({ message: "Finished verifyDuplicateImagesForPerson", count: showUrls.length, showUrls });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error verifyDuplicateImagesForPerson", err });
  }
});

router.post('/debugItemsMerge', private, async (req, res, next) => {
  const oldItem = req.body.oldItem ? req.body.oldItem :
  {
    xyz: 3,
    title: 'old title',
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
    comments: [
      {
        author: 'alice',
        date: '2021-01-01',
        text: 'bello',
      }, {
        author: 'bob',
        date: '2021-01-02',
        text: 'brutto',
      }, {
        author: 'charlie',
        date: '2021-01-03',
        text: 'così così',
      }
    ],
  };
  const newItem = req.body.newItem ? req.body.newItem :
  {
    id: 1,
    __v: 0,
    createdAt: 'now',
    changedAt: 'now',
    updatedAt: 'now',
    id: 123,
    provider: 'toe',
    region: ' italy.torino',
    group: '',
    images: [
      {

        url: 'abc',
        etag: 1234,
      }, {
        url: 'def',
        etag: 4567,
      }
    ],
    comments: [
      {
        author: 'alice',
        date: '2021-01-01',
        text: 'bello',
      }, {
        author: 'bob',
        date: '2021-01-02',
        text: 'brutto',
      }, {
        author: 'charlie',
        date: '2021-01-03',
        text: 'così così',
      }
    ],
  };
  const mergedItems = itemsMerge(oldItem, newItem);
  res.status(200).json({ message: "Merged items:", data: mergedItems });
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