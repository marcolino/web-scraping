const express = require('express');
const router = express.Router();
const fs = require('fs');
//const path = require("path");
const { private } = require('../auth');

const { someCommonImages, itemsMerge, showCommonImages } = require('../controllers/providers');

const logger = require('../logger');
const config = require('../config');

// verify db and fs consistency

async function verifyConsistency(filter) {
  const Items = require("../models/Items");

  try {
    const project = {};
    const items = await Items.find(filter, project);
    // logger.debug('filter:', filter);
    // logger.debug('project:', project);
    // logger.debug('items length:', items.length);
    
    // loop through all items
    let success = true;
    let size = items.length;
    let info = {};
    items.forEach(async (item) => {
      //logger.info(`verifyConsistency for item`, item.provider, item.id);
      info.no_id = [];
      if (!item.id) {
        logger.warn(`no id for item with _id`, item._id);
        info.no_id.push({id: item._id});
        success = false;
      }
      info.no_provider = [];
      if (!item.provider) {
        logger.warn(`no provider for item with _id`, item._id);
        info.no_provider.push({id: item._id});
        success = false;
      }

      // verify there are no duplicate images in this item
      info.duplicate_images = [];
      item.images.forEach(async (image, index) => {
        const idx = item.images.findIndex(i => i.url === image.url);
        if (idx >= 0 && idx !== index) { // skip the same image
          logger.warn(`image ${image.url} duplicated as ${item.images[idx].url} for item with _id`, item._id);
          info.duplicate_images.push({_id: item._id, url1: image.url, url2: item.images[idx].url});
          success = false;
        }
      });

      // verify there are no duplicate comments in this item
      info.duplicate_comments = [];
      item.comments.forEach(async (comment, index) => {
        const idx = item.comments.findIndex(c => (c.author === comment.author && c.text === comment.text && c.date === comment.date));
        if (idx >= 0 && idx !== index) { // skip the same comment
          logger.warn(`comment ${c.author} ${c.date} duplicated as ${item.comments[idx].author} ${item.comments[idx].date} for item with _id`, item._id);
          info.duplicate_comments.push({_id: item._id, comment1: {author: c.author, date: c.date}, comment2: {author: item.comments[idx].author, date: item.comments[idx].date}});
          success = false;
        }
      });

    });

    //res.status(200).json({ message: "Finished verifying consistency", success, size, info });
    return({status: 200, result: { message: "Finished verifying consistency", success, size, info }});
  } catch (err) {
    logger.error(err.toString());
    //res.status(500).json({ message: "Error verifying consistency", err: err.message });
    return({status: 500, result: { message: "Error verifying consistency", err: err.message }});
  }
}

async function verifyOrphanedImages(filter) {
  const Items = require("../models/Items");
  const result = {};

  try {
    const project = {};
    const items = await Items.find(filter, project);
    // logger.debug('filter:', filter);
    // logger.debug('project:', project);
    // logger.debug('items length:', items.length);

    let success = true;
    let size = items.length;
    let info = {};

    // get images paths in db
    const imagesSet = new Set();
    items.forEach(async (item) => {
      item.images.forEach(async (image) => {
        if (image.localPath) {
          imagesSet.add(`${image.localPath}`);
          //console.log(`db image localPath: ${image.localPath}`);
        }
      });
    });
    //logger.debug('images on db count:', imagesSet.size);

    // read images files on fs
    const filesSet = new Set();
    fs.readdirSync(config.imagesBaseFolder).forEach(dir => {
      //console.log(`dir: ${dir}`);
      fs.readdirSync(`${config.imagesBaseFolder}${dir}`).forEach(file => {
        filesSet.add(`${config.imagesBaseFolder}${dir}/${file}`);
      });
    });
    //logger.debug('image files on fs count:', filesSet.size);

    info.sameSize = (imagesSet.size === filesSet.size);
    info.imagesCount = imagesSet.size;
    info.filesCount = filesSet.size;

    if (imagesSet.size !== filesSet.size) {
      logger.warn(`images on db (${imagesSet.size}) differ by image files on fs (${filesSet.size})`);
      success = false;
    }

    info.orphaned = {};

    let orphanedImagesSet= new Set(
      [...imagesSet].filter(i => !filesSet.has(i))
    );

    info.orphaned.imagesSize = orphanedImagesSet.size;
    if (orphanedImagesSet.size > 0) {
      logger.warn(`db images that have no files in fs: ${orphanedImagesSet.size}`);
      info.orphaned.images = Array.from(orphanedImagesSet);
      success = false;
    }

    const orphanedFilesSet = new Set(
      [...filesSet].filter(f => !imagesSet.has(f))
    );
    info.orphaned.filesSize = orphanedFilesSet.size;
    if (orphanedFilesSet.size > 0) {
      logger.warn(`fs files that have no images in db: ${orphanedFilesSet.size}`);
      info.orphaned.files = Array.from(orphanedFilesSet);
      success = false;
    }

    //res.status(200).json({ message: "Finished verifying orphaned images", success, size, info });
    return({status: 200, result: { message: "Finished verifying orphaned images", success, size, info }})
  } catch (err) {
    logger.error(err.message, err.stack);
    //res.status(500).json({ message: "Error verifying orphaned images", err: err.message });
    return({status: 500, result: { message: "Error verifying orphaned images", err: err.message }});
  }
}

router.post('/verifyDuplicateImagesForPerson', private, async (req, res, next) => {
  const Items = require("../models/Items");

  try {
    const filter = req.body.filter;
    const threshold = typeof req.body.threshold !== 'undefined' ? req.body.threshold : 0.20;
    const project = { provider: 1, id: 1, region: 1, title: 1, url: 1, images: 1 };

    // logger.debug('filter:', filter);
    // logger.debug('threshold:', threshold);
    // logger.debug('project:', project);
    const items = await Items.find(filter, project);

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
    logger.error(err.toString());
    res.status(500).json({ message: "Error verifyDuplicateImagesForPerson", err: err.message });
  }
});

// system only routes (debug)
router.post('/debugSomeCommonImages', private, async (req, res, next) => {
  const Items = require("../models/Items");

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
    logger.error(err.toString());
    res.status(500).json({ message: "Error debugSomeCommonImages", err: err.message });
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

module.exports = {
  verifyConsistency,
  verifyOrphanedImages,
};