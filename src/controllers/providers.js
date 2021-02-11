const cron = require('node-cron');
//const fetch = require('node-fetch');
const got = require('got');
const fs = require('fs');
const mime = require('mime-types');
const crypto = require('crypto');
const uuid = require('uuid');
const Items = require('../models/Items');
const UserStatuses = require('../models/UserStatuses');
const Globals = require('../models/Globals');
//const { dbConnect, dbClose } = require('../utils/db');
const { phoneNormalize } = require('../utils/providers');
const { browserLaunch, browserPageNew, browserPageClose, browserClose } = require('../utils/browser');
const { mimeImage, dumperr } = require('../utils/misc');
const { calculatePerceptualHash, comparePerceptualHashes, perceptuallyEqual } = require('../utils/image');
//const { register, login } = require('./user');
const globals = require('../models/Globals');
const logger = require('../logger');
const config = require('../config');

const scrapeProviders = async(req) => {
  logger.info(`providers.scrapeProviders.starting.${req.requestId}`);
  try {
    if (config.scrape.debug.duplicateItemsPersonsCollection) { // duplicate items persons collection before starting
      var exec = require('child_process').exec;
      const o = 'items';
      const n = 'items.pre';
      exec(`scripts/mongoDuplicateCollection web-scraping ${o} ${n}`, function callback(error, stdout, stderr) {
        if (stderr) {
          logger.error(`Error duplicating collection: ${stderr}`);
        }
      });
    }

    const lastScrapeTimestamp = new Date();
    globalsSet(`lastScrapeStatus`, `started`);
    globalsSet(`lastScrapeTimestampStart`, lastScrapeTimestamp.toISOString());
    const regionDescriptor = req.body.regionDescriptor || '*';
//logger.debug('regionDescriptor:', regionDescriptor);
    const providers = getProvidersByRegion(regionDescriptor);
//logger.debug('providers keys:', Object.keys(providers));
    const data = (await Promise.all(
      Object.keys(providers)
      .filter(index => providers[index].info.type === config.type)
      .filter(index => !(config.scrape.onlyProviders.length && !config.scrape.onlyProviders.includes(providers[index].info.key)))
      .map(async index => {
        const provider = providers[index];
        const regions = getProviderRegions(provider, regionDescriptor);
//logger.debug('regions:', regions);
        let results = [];
        for (let r = 0; r < regions.length; r++) { // loop on all regions
          const region = regions[r];
//logger.debug('scrapeProviders - region:', region);
          if (config.scrape.onlyRegions.length && !config.scrape.onlyRegions.includes(region)) {
            //logger.debug(`${provider.info.key} provider scrape break due to scrape.onlyRegions: ${region} not in ${config.scrape.onlyRegions}`);
            continue;
          }
          const result = await scrapeProvider(provider, region);
          results = results.concat(result);
        }
        return results;
      })
    )).flat(); // we flat-out due to Promise.All
    // save last scrape timestamp in globals
    globalsSet(`lastScrapeTimestamp`, lastScrapeTimestamp);
    const lastScrapeTimestampEnd = new Date();
    const duration = (lastScrapeTimestampEnd - lastScrapeTimestamp).toHHMMSS();
    logger.info(`providers.scrapeProviders.finishing.${req.requestId}.success ${data.length} items scraped in ${duration}`);
  } catch (err) {
    logger.error(`providers.scrapeProviders.finishing.${req.requestId}.error ${dumperr(err)}`);
  } finally {
    globalsSet(`lastScrapeStatus`, `finished`);
  }
}

const scrapeProvidersImages = async (req) => {
  logger.info(`providers.scrapeProvidersImages.starting.${req.requestId}`);
  try {
    if (config.scrape.debug.duplicateImagesCache) { // duplicate images cahce before starting
      const fse = require('fs-extra');
      const srcDir = `${config.imagesBaseFolder}`;
      const dstDir = `${config.imagesBaseFolder.replace(/\/$/, '')}.pre`;
      try {
        fs.rmdirSync(dstDir, { recursive: true });
        //logger.debug(`cleared images cache duplicate successfully`);
      } catch(err) {
        logger.warn(`error clearing images cache duplicate: ${dumperr(err)}`);
      }
      try {
        fse.copySync(srcDir, dstDir);
        //logger.debug(`copyed images cache duplicate successfully`);
      } catch (err) {
        logger.warn(`error duplicating images cache: ${err.message}`);
      }
    }

    const lastImagesScrapeTimestamp = new Date();
    const regionDescriptor = req.body.regionDescriptor || '*';
    const providers = getProvidersByRegion(regionDescriptor);
    const count = (await Promise.all(
      Object.keys(providers)
      .filter(index => !(config.scrape.onlyProviders.length && !config.scrape.onlyProviders.includes(providers[index].info.key)))
      .map(async index => {
        const provider = providers[index];
        const regions = getProviderRegions(provider, regionDescriptor);
        let results = 0;
        for (let r = 0; r < regions.length; r++) {
          const region = regions[r];
          if (config.scrape.onlyRegions.length && !config.scrape.onlyRegions.includes(region)) {
            //logger.debug(`${provider.info.key} provider images scrape break due to scrape.onlyRegions: ${region} not in ${config.scrape.onlyRegions}`);
            continue;
          }
          const result = await scrapeProviderImages(provider, region);
          results += result;
        }
        return results;
      })
    )).flat(); // we flat-out due to Promise.All
    const sum = count.reduce((a, b) => parseInt(a) + parseInt(b), 0);
    const lastImagesScrapeTimestampEnd = new Date();
    const duration = (lastImagesScrapeTimestampEnd - lastImagesScrapeTimestamp).toHHMMSS()
    logger.info(`providers.scrapeProvidersImages.finishing.${req.requestId}.success: ${sum ? sum : 0} images scraped in ${duration}`);
    return sum;
  } catch(err) {
    logger.error(`providers.scrapeProvidersImages.finishing.${req.requestId}.error: ${dumperr(err)}`);
  }
}

const groupProvidersItems = async() => {
  try {
    const lastScrapeTimestamp = await Globals.findOne({ key: `lastScrapeTimestamp` }).exec();
    const itemsAll = await Items.find({}).exec(); // all items
    const itemsNew = await Items.find({
      dateCreated: { $gte: lastScrapeTimestamp.value }, // new items
    }).exec();
    for (var i = 0, lenI = itemsAll.length; i < lenI; i++) {
      const itemAll = itemsAll[i];
logger.warn(`------ i: ${i}`);
      for (var j = 0, lenJ = itemsNew.length; j < lenJ; j++) {
        const itemNew = itemsNew[j];
logger.warn(`--- j: ${j}`);
        if (itemNew.id === itemAll.id && itemNew.provider === itemAll.provider) { // skip same item
          continue;
        }
        if (sameGroup(itemAll, itemNew)) { // check if the two items should be grouped
          if (!itemAll.group) { // all item has no group
            itemAll.group = uuid.v4();
logger.warn(`item all:${itemAll.provider} ${itemAll.id} ${itemAll.title}, ${itemAll.phone} group: ${itemAll.group}`);
            await Items.updateOne(
              { id: itemAll.id, provider: itemAll.provider },
              { group: itemAll.group }
            );
          } else { // all item has already a group
logger.warn(`item all ${itemAll.provider} ${itemAll.id} ${itemAll.title}, ${itemAll.phone} has a group: ${itemAll.group}`);
          }
          if (!itemNew.group) {
            itemNew.group = itemAll.group;
logger.warn(`item new ${itemNew.provider} ${itemNew.id} ${itemNew.title}, ${itemNew.phone} group: ${itemNew.group}`);
            await Items.updateOne(
              { id: itemNew.id, provider: itemNew.provider },
              { group: itemNew.group }
            );
          } else { // item new has a group already
logger.warn(`item new ${itemNew.provider} ${itemNew.id} ${itemNew.title}, ${itemNew.phone} has a group: ${itemNew.group}`);
          }
        }
      }
    }
  } catch (err) {
    throw (new Error(`error grouping providers items: ${err}`));
  }
}

/**
 * Decide if two items should belong to the same group (they are "aliases")
 */
const sameGroup = (a, b) => {
  return (a.phone && b.phone && a.phone === b.phone);
}

/**
 * Decide if two items should belong to the same group (they are "aliases") (version 2.0)
 */
const sameGroup_2_0 = (a, b) => {
  return (
    (a.phone === b.phone)
    &&
    (someCommonImages(a, b))
  );
}

/**
 * Check if two items share common (considered similar) images
 */
const someCommonImages = (a, b, threshold = 0.10 /*0.1094*/) => {
  for (var i = 0, lenA = a.images.length; i < lenA; i++) {
    const ai = a.images[i];
    if (ai.phash) {
      for (var j = 0, lenB = b.images.length; j < lenB; j++) {
        const bj = b.images[j];
        //console.log(ai.url, ai.category, '\n' + bj.url, bj.category);
        if (ai.url !== bj.url) { // the images are not from the same url, otherwise do not even compare them
          if (ai.category === bj.category) { // compare only images of the same category
            if (bj.phash) {
              if (comparePerceptualHashes(ai.phash, bj.phash, threshold)) {
                // found a common image
                //return true;
                return [ ai.localPath, bj.localPath ]; // TODO: DEBUG only
              }
            }
          }
        }
      }
    }
  }
  return false;
}

scrapeProvider = async (provider, region, user) => {
  try {
    const browser = await browserLaunch();
    const page = await browserPageNew(browser);

    if (config.scrape.debug.puppeteer) page.on('console', msg => {
      logger.debug(`provider ${provider.info.key} scrape message: ${msg.text()}, script row: ${msg._stackTraceLocations[0].lineNumber}, col: ${msg._stackTraceLocations[0].columnNumber}`);
    }); // do use console.log() inside page.evaluate

    const items = await scrapeProviderMultiListAndItems(provider, region, page)

    try { await browserPageClose(page) } catch(err) { console.error('page close error:', err) }
    try { await browserClose(browser) } catch(err) { console.error('browser close error:', err) }

    return items ? (await Promise.all(items)).flat() : []; // we flat-out due to Promise.All
  } catch(err) {
    throw (new Error(`error scraping provider ${provider.info.key}: ${dumperr(err)}`));
  }
};

const scrapeProviderMultiListAndItems = async (provider, region, page) => {
  let nextListPage = null;
  let itemsMultiPage = [];
  let pages = 0;
  do {
    const list = await scrapeList(provider, region, page, nextListPage);
    nextListPage = list && list.length ? list[list.length-1].nextListPage : null;

    let items = await scrapeItems(provider, region, page, list);
    if (items && items.length && items[items.length-1].itemFoundBreakMultiPage) { // one item was found existing in immutable provider: break multi page loop
      items.pop();
      nextListPage = null; // break loop
    }
    itemsMultiPage = itemsMultiPage.concat(items);
    pages++;
    if (config.scrape.onlyFirstPages > 0 && pages >= config.scrape.onlyFirstPages) {
      //logger.debug(`${provider.info.key} provider scrape multi list and items break due to scrape.onlyFirstPages: ${pages} >= ${config.scrape.onlyFirstPages}`);
      nextListPage = null; // break loop
    }
    if (config.scrape.onlyFirstItems > 0 && itemsMultiPage.length >= config.scrape.onlyFirstItems) {
      //logger.debug(`${provider.info.key} break due to scrape.onlyFirstItems ${itemsFull.length} >= ${config.scrape.onlyFirstItems}`);
      nextListPage = null; // break loop
    }
} while (nextListPage);
  return itemsMultiPage;
}

const scrapeList = async(provider, region, page, nextListPage) => {
  try {
    logger.info(`providers.scrapeList.listPageEvaluate ${provider.info.key}`);
    const list = await provider.listPageEvaluate(region, page, nextListPage);
    // show provider's list warnings, if any
    for (let warning in list.warnings) logger.warn(`provider ${provider.info.key} list scraping warning: ${warning}`);
    return list;
  } catch (err) {
    console.warn(`error scraping list for provider ${provider.info.key}: ${err}`);
  }
}

const scrapeItems = async (provider, region, page, list) => {
  try {
    const itemsFull = [];
    if (list) {
      const len = list.length;
      for (var i = 0; i < len; i++) {
        const item = list[i];
        if (item.id) { // this is not a dummy item for multi-page handling
          if (provider.info.immutable && !config.scrape.alsoImmutables) { // this provider pages are immutable: avoid reparsing already present items
            if (await itemExists(item)) { // item found existing in immutable provider list: break and signal multi-page handle to break
              itemsFull.push({itemFoundBreakMultiPage: true});
              break;
            }
          }
          logger.info(`providers.scrapeItems.itemPageEvaluate ${provider.info.key}\t${item.id}\t[${1+i}/${len}]`);
          const itemFull = await provider.itemPageEvaluate(region, page, item);
          // show provider's item warnings, if any
          for (let warning in itemFull.warnings) logger.warn(`provider ${provider.info.key} item scraping warning: ${warning}`);

          if (itemFull) {
            if (itemFull.loginRequested) { // try to login
              const login = provider.info.login;
              await page.goto(login.url);
              await page.click(login.usernameSelector);
              await page.keyboard.type(login.username);
              await page.click(login.passwordSelector);
              await page.keyboard.type(login.password);
              await page.evaluate((selector) => document.querySelector(selector).click(), login.submitSelector); 
              await page.waitForNavigation();
              i = i - 1; // reprocess previous item page, which failed requesting login
            } else {
              itemFull.phone = phoneNormalize(itemFull.phone).number; // can't do it in provider.itemPageEvaluate() because can't pass functions into puppeteer evaluation...
              await saveItem(itemFull); // TODO: we could run saveItem asynchronously...
              itemsFull.push(itemFull);
            }
          } else {
            console.warn(`null item from page`);
          }
        }
        if (config.scrape.onlyFirstItems > 0 && itemsFull.length >= config.scrape.onlyFirstItems) {
          //logger.debug(`${provider.info.key} provider items scrape break due to scrape.onlyFirstItems ${itemsFull.length} >= ${config.scrape.onlyFirstItems}`);
          break;
        }
      }
    }
    return itemsFull;
  } catch (err) {
    console.warn(`error scraping items: ${err}`);
  }
}

scrapeProviderImages = async (provider, region) => {
  try {
    const items = await Items.find({ // TODO: filter only new images, with no localPath ... (NO, FIND ALL ITEMS)
      provider: provider.info.key,
      region: region,
      //images: { $elemMatch: { localPath: null } }
    });
//logger.debug('scrapeProviderImages items with some image without localPath:', items.length);
    let count = 0;
    for (let i = 0; i < items.length; i++) {
//logger.debug('*** scrapeProviderImages item:', items[i].id)
      if (config.scrape.onlyFirstItems > 0 && i > config.scrape.onlyFirstItems) {
        //logger.debug(`${provider.info.key} provider images scrape break due to scrape.onlyFirstItems ${i} > ${config.scrape.onlyFirstItems}`);
        break;
      }

      let item = items[i];
//logger.debug('scrapeProviderImages item images:', item.images);
      if (config.scrape.onlyItemId.length && !config.scrape.onlyItemId.includes(item.id)) {
        continue;
      }
      item.provider = provider.info.key;
      item.type = provider.info.type;
      item.region = region;

      for (let j = 0; j < item.images.length; j++) {
//logger.error('j', item.images.length);
        let image = item.images[j];
//logger.debug('scrapeProviderImages item image:', image)
          image.cached = fs.existsSync(image.localPath); // check if file is already cached on fs
          if (!image.localPath || !image.cached) { // only download images with no localPath, or missing file image
//logger.debug(`--- downloading image of person ${item.provider} ${item.id} - n° ${1+j} / ${item.images.length} image: ${image} ---`);

          logger.info(`scrapeProvidersImages.provider.${provider.info.key}\t${item.id}\t[item ${1+i}/${items.length}] [image ${1+j}/${item.images.length}]`);
          const response = await downloadImage(provider, region, item, image);
          if (!response || !response.success) {
            continue;
          }
          // if (!response.changed) {
          //   logger.warn(`no change downloading image ${image.url}, ignoring it...`);
          //   continue;
          // }
          const imageDownloaded = response.image;
            //logger.debug(`image phash: ${JSON.stringify(image.phash)}`);

          // calculate image perceptual hash
          imageDownloaded.phash = await calculatePerceptualHash(imageDownloaded.localPath);
          
//logger.warn(` +++ image before dow:`, image);

          // copy downloaded image props to items image
          delete imageDownloaded.success;
          for (var prop in imageDownloaded) image[prop] = imageDownloaded[prop];

//logger.warn(` +++ image downloaded:`, imageDownloaded);
//logger.debug(`image phash being calculated: ${imageDownloaded.phash}`);

//logger.debug(`--- saving image ${j} of ${item.images.length} -------------`);
//logger.debug(`--- saving image ${j} of ${item.images.length} -------------`);

          // compare downloaded image phash with other images phashes (of the same item) to detect duplicates
          let foundSimilarImage = -1;
          let image2 = null;
          for (let k = 0; k < item.images.length; k++) {
            image2 = item.images[k];
            if (k == j) continue; // do not compare the an image to itself
//logger.error('k', item.images.length);
            if (image2.duplicate) continue; // do not compare an image which is for sure a duplicate
            if (image2.phash) { // check images being compared has a phash already
//logger.debug(`comparing phashes: ${imageDownloaded.phash}, ${item.images[k].phash}`);
              if (perceptuallyEqual(image/*Downloaded*/.phash, image2.phash)) {
                foundSimilarImage = k;
                break;                 
              } else { // this is the standard case, two images do not match
                //logger.warn(`Item ${item.provider} ${item.id} ${item.title} image n. ${k} category ${item.images[k].category} image is different by image n. ${j}`);
              }
            } else { // image of new item has no phash, yet
              if (image2.localPath) { // no phsh should not happen on images already downloaded...
                logger.warn(`item ${item.provider} ${item.id} ${item.title} image n. ${k} category ${image2.category} has no phash, should not happen...`);
              }
            }
          }
          if (foundSimilarImage >= 0) {
            if (!image2.duplicate) {
              logger.debug(`two perceptually equal images for person ${item.provider} ${item.id} ${item.url}, images ${j} and ${foundSimilarImage}, marking it as duplicate`);
              //await deleteItemImage(item, image); // TODO: we could delete asynchrounously, without await, in production...
              image.duplicate = true;
            }
          }

          // save item image
          await saveItemImage(item, image/*Downloaded*/); // TODO: we could save asynchrounously, without await, in production...
          count++;
        }
//else logger.debug(`--- NOT downloading image ${j} of ${item.images.length}, it was already present ---`);
      }
    }
    return count; 
  } catch (err) {
    logger.error(`error scraping provider images: ${err}`);
  }
}

/**
 * Takes the providers array, an array of two items and an array of two images.
 * Returns an url to a local page to show images togheter
 */
const showCommonImages = (providers, items, commonImages) => {
  const url1 = encodeURIComponent(providers[items[0].provider].regions[items[0].region].imagesUrl + items[0].url);
  const url2 = encodeURIComponent(providers[items[1].provider].regions[items[1].region].imagesUrl + items[1].url);
  const url = `http://localhost:${config.defaultServerPort}/debug/sci/?img1=${commonImages[0]}&img2=${commonImages[1]}&url1=${url1}&url2=${url2}`;
  return url;

}

/**
 * Returns an array with all providers information
 */
const getProviders = () => {
  const glob = require('glob');
  const path = require('path');
  const providers = [];
  glob.sync('src/providers/*.js').forEach(file => {
    p = require(path.resolve(file));
    if (p.info) {
      providers[p.info.key] = p.info;
    }
  });
  return providers;
}

const downloadImage = async (provider, region, item, image) => {
  imageUrl = provider.info.regions[region].imagesUrl + image.url;
  try {
    const retval = {success: false, changed: true, already: false};
    //const response = await fetch(imageUrl, {
    const response = await got(imageUrl, {
      headers: image.cached ? // add cache headers if image is already cached
      {
        'If-Modified-Since': image.date ? image.date.toUTCString() : undefined,
        'If-None-Match': image.etag,
      } : {},
    });
    switch (response.statusCode) {
      case 404:
        logger.warn(`image ${imageUrl} not found: ignoring`);
        return retval;
      case 304:
        logger.debug(`image ${imageUrl} did not change`);
        //retval.success = true;
        retval.changed = false;
        //return retval;
        break;
      case 200:
        break;
      default:
        logger.warn(`image ${imageUrl} download status was ${statusCode}: ignoring`);
        return retval;
    }

    const mimeType = response.headers['content-type'];
    const date = response.headers['last-modified'];
    const etag = response.headers['etag'];

    if (etag === image.etag) {
      logger.debug(`etag not changed for ${imageUrl}`);
      retval.changed = false;
      //return retval;
    }
    if (!mimeType) {
      logger.warn(`image ${imageUrl} content type was not defined: ignoring`);
      return retval;
    }
    if (!mimeImage(mimeType)) {
      logger.warn(`image ${imageUrl} content type was not image (${mimeType}): ignoring`);
      return retval;
    }
    
    const extension = mime.extension(mimeType).replace(/^jpeg$/, 'jpg');
    const id = item.id.replace(/\s/g, '_');
    const category = image.category;
    const title = item.title.toLowerCase().replace(/[^a-z]/g, '');
    const md5 = crypto.createHash('md5').update(imageUrl).digest('hex');
    const outputFileName = `${config.imagesBaseFolder}${provider.info.key}/${id}_${title}_${category}_${md5}.${extension}`;
    //logger.debug('downloadImage - outputFileName:', outputFileName);
    fs.mkdirSync(`${config.imagesBaseFolder}${provider.info.key}`, { recursive: true }); // be sure folder exists
    const buffer = await response.rawBody;
    try { // check if image exists already
      fs.accessSync(outputFileName, fs.constants.R_OK); 
      logger.info(`downloaded image ${imageUrl} file skipped because already present`);
      retval.already = true;
    } catch (err) {
      if (err.code !== 'ENOENT') { // some error accessing file
        logger.warn(`file ${outputFileName} has some problem accessing: ${err.code}`);
        return retval;
      } else { // image does not exist, save it to filesystem
        try {
          fs.writeFileSync(outputFileName, buffer);
          logger.info(`downloaded image ${imageUrl} file saved`);
        } catch (err) {
          logger.warn(`cannot save downloaded image file ${outputFileName}: ${err}`);
          return retval;
        }
      }
    }
    retval.success = true;
    retval.image = {};
    retval.image.url = image.url;
    retval.image.category = image.category;
    retval.image.date = date;
    retval.image.etag = etag;
    retval.image.localPath = outputFileName;
    return retval;
  } catch (err) {
    logger.warn(`error downloading image at ${imageUrl}: ${dumperr(err)}`);
  }
}

const itemExists = async(item) => {
  try {
    const retval = await Items.exists({
      id: item.id,
      provider: item.provider,
    });
    return retval; 
  } catch (err) {
    throw (new Error(`error finding item: ${err}`));
  }
}

const saveItem = async(item) => {
  Items.findOne(
    { id: item.id, provider: item.provider/*, region: item.region*/ },
    (err, itemOld) => {
      if (err) {
        throw (new Error(`error finding item to save: ${err}`));
      }
      if (!itemOld) { // a new item
        itemOld = new Items(item);
        itemOld.save((err, itemNew) => {
          if (err) {
            throw (new Error(`error saving new item: ${err}`));
          }
          compareItemsHistoryes(null, itemNew, itemNew); // we run compareItemsHistoryes asynchronously, it will debug log out of sync...
          //logger.debug(`item ${itemNew.title} inserted`);
        });
      } else { // an existing item
        const itemOldLean = JSON.parse(JSON.stringify(itemOld));
        const itemMerged = itemsMerge(itemOldLean, item);
        if (!itemMerged) {
          return;
        }
        itemOld.set({...itemMerged});
        itemOld.save((err, itemNew) => {
          if (err) {
            throw (new Error(`error updating item: ${err}`));
          }
          const itemNewLean = JSON.parse(JSON.stringify(itemNew._doc));
          compareItemsHistoryes(itemOldLean, itemNewLean, itemNew); // we run compareItemsHistoryes asynchronously, it will debug log out of sync...
          //logger.debug(`item ${itemNew.title} updated`);
        });
      }
    }
  );
}

const itemsMerge = (o, n) => {
  const Items = require("../models/Items");
  //logger.debug('itemsMerge - Items schema.paths:', Object.keys(Items.schema.paths));
  const merged = {};
  const props = Object.keys(Items.schema.paths);
  props.map(prop => {
    //console.log('*', prop);
    switch (prop) {
      case '_id':
      case '__v':
      case 'createdAt':
      case 'changedAt':
      case 'updatedAt':
        break; // ignore special props
      case 'group':
        break; // ignore calculated props
      case 'id':
      case 'provider':
      case 'region':
        // mandatory props
        if (typeof n[prop] === 'undefined') {
          logger.warn(`itemsMerge - new document does not contain a defined ${prop} prop, ignoring it`);
          return null;
        }
        merged[prop] = n[prop]; // always return new prop
        break;
      case 'title':
      case 'subtitle':
      case 'url':
      case 'address':
      case 'phone':
      case 'contactInstructions':
      case 'ethnicity':
      case 'nationality':
      case 'age':
      case 'eyesColor':
      case 'hairColor':
      case 'pubicHair':
      case 'tatoo':
      case 'piercings':
      case 'height':
      case 'weight':
      case 'breastSize':
      case 'breastType':
      case 'shoeSize':
      case 'dressSize':
      case 'smoker':
      case 'sexualOrientation':
      case 'selfDescription':
      case 'adClass':
      case 'price':
      case 'additionalInfo':
      case 'onHoliday':
      case 'suspicious':
      case 'spokenLanguages': // array of strings
      case 'adUrlReferences': // array of strings
        merged[prop] = typeof n[prop] !== 'undefined' ? n[prop] : o[prop]; // return new prop if present, otherwise keep old prop
        break;
      case 'images': // array of objects (url, category, date, etag, phash, localPath)
        o[prop] = o[prop].map(p => { p.active = false; return p; }); // set active to false on all items of old prop array
        n[prop] = n[prop].map(p => { p.active = true; return p; }); // set active to true on all items of old prop array
//console.log('before images arrays merge - o[prop]:', o[prop]);
//console.log('before images arrays merge - n[prop]:', n[prop]);
        merged[prop] = arraysMerge(o[prop], n[prop], [ 'url' ]); // merge old and new arrays, excluding objects with a common set of props
//console.log('after  images arrays merge - merged[prop]:', merged[prop]);
        break;
      case 'comments': // array of objects (author, authorCommentsCount, text, date, vote)
//console.log('before comments arrays merge - o[prop]:', o[prop]);
//console.log('before comments arrays merge - n[prop]:', n[prop]);
        o[prop] = o[prop].map(p => { p.active = false; return p; }); // set active to false on all items of old prop array
        n[prop] = n[prop].map(p => { p.active = true; return p; }); // set active to true on all items of old prop array
        merged[prop] = arraysMerge(o[prop], n[prop], [ 'author', 'text', 'date' ]); // merge old and new arrays, excluding objects with a common set of props
        break;
      default:
        logger.warn('itemsMerge unforeseen prop', prop, n[prop], typeof n[prop]);
    }
  });
  return merged;
}

/**
 * Merge two arrays of objects, excluding objects with a common set of props
 * @param {array} o
 * @param {array} n
 * @param {array} keyPropsSet
 */
const arraysMerge = (o, n, keyPropsSet) => {
  const all = [...o, ...n]; // merge the two arrays
  
  // look for duplicate entries, and merge them
  const merged = [];
  all.forEach(a => { // scan trough items all
    // look for duplicates of this all element into merged array
    const index = merged.findIndex(m => {
      let dup = true;
      for (let i = 0; i < keyPropsSet.length; i++) {
        const keyProp = keyPropsSet[i];     
        if (m[keyProp] !== a[keyProp]) {
          dup = false;
          break;
        }
      }
      return dup;
    });
    if (index >= 0) { // a duplicate found in merged array: merge this all element with the duplicate
      merged[index] = {...(merged[index]), ...(a)}
    } else { // no duplicate found in merged array: push this all element
      merged.push(a);
    }
  });
  return merged;
}


const compareItemsHistoryes = async (itemOldLean, itemNewLean, itemNew) => {
  const key = `${itemNewLean.provider} ${itemNewLean.id}`;
  if (!itemOldLean && !itemNewLean) { // safety check, should not happen
    logger.warn(`${key} neither new nor old item is set!`);
    return;
  }
  let added = changed = false;
  if (!itemOldLean) { // a new item
    logger.info(`${key} new`);
    added = true;
  } else {
    // a changed item
    Object.keys(itemOldLean).map(prop => {
      if (!['__v', '_id', 'provider', 'id', 'region', 'createdAt', 'updatedAt'].includes(prop)) {
        //logger.debug(`--- ${prop} ---`);
        const type = Array.isArray(itemOldLean[prop]) ? 'array' : typeof itemOldLean[prop];
  //logger.debug(`typeof itemOldLean[${prop}]: ${type}`);
        switch (type) {
          case 'boolean':
            //logger.warn(itemNewLean[prop]);
            if (itemOldLean[prop] != itemNewLean[prop]) {
              logger.info(`${key} changed ${prop}: ${itemNewLean[prop] ? 'false => true' : 'true => false'}`);
              changed = true;
            }
            break;
          case 'string':
          case 'number':
          case 'object': // we assume one level only objects (shallow compare)
            //if (!itemOldLean[prop] || !itemNewLean[prop]) {
            if (itemOldLean[prop] !== itemNewLean[prop]) {
              require('colors');
              const diff = require('diff');
              const differences = diff.diffWords(itemOldLean[prop], itemNewLean[prop]);
              let difference = '';
              differences.forEach((part) => {
                // green for additions, red for deletion, grey for common parts
                const color = part.added ? 'blue' :
                  part.removed ? 'red' :
                  'green'
                ;
                difference += part.value[color];
              });
              logger.info(`${key} changed ${prop}:\n${difference}`);

              //logger.info(`${key} changed ${prop}: ${itemOldLean[prop]} => ${itemNewLean[prop]}`);

              changed = true;
            }
            break;
          case 'array': // we assume one level only arrays (shallow compare)
//if(prop !== 'images') break;
            const o = itemOldLean[prop];
            const n = itemNewLean[prop];

            // check for removed elements in array
            const removed = [];
            for (var oi = 0; oi < o.length; oi++) {
              const oObj = o[oi];
              let found = false;
              for (var ni = 0; ni < n.length; ni++) {
                const nObj = n[ni];
                if (areEquivalent(nObj, oObj, ['_id', 'authorCommentsCount', 'date', 'etag', /*'type'*/, 'phash', 'localPath', 'active', 'duplicate'])) {
                  found = true;
                  break;
                }
//else logger.warn('nObj is not equivalent:', nObj, oObj);
              }
              if (!found) { // this old item was not found or was different in new items
//logger.warn('oObj not found:', oObj);
                removed.push(oObj);
              }
//break;
            }
            if (removed.length) {
              logger.info(`${key} removed ${removed.length} ${prop}`/*: ${JSON.stringify(removed)}*/);
              changed = true;
            }

            // check for added elements in array
            const added = [];
  //console.log('COMMENTS new length:', o.length);
            for (var ni = 0; ni < n.length; ni++) {
              const nObj = n[ni];
              let found = false;
              for (var oi = 0; oi < o.length; oi++) {
                const oObj = o[oi];
//console.log('COMPARING:', oObj, nObj);
                //if (areEquivalent(oObj, nObj, ['_id'])) {
                if (areEquivalent(nObj, oObj, ['_id', 'authorCommentsCount', 'date', 'etag', /*'type'*/, 'phash', 'localPath', 'active', 'duplicate'])) {
                  found = true;
                  break;
                }
              }
              if (!found) { // this new item was not found or was different in old items
                added.push(nObj);
              }
            }
            if (added.length) {
              logger.info(`${key} added ${added.length} ${prop}`/*: ${added}`*/);
              changed = true;
            }

            break;
          default:
            logger.warn(`${prop}: type ${type} compare is not yet implemented`);
            break;
        }
      }
    });
  }
  if (added || changed) { // save changetAt now timestamp
    itemNew.update({ changedAt: new Date() }); // TODO: return changedAt date, do not update here
  } else {
    //logger.debug(`${key} unchanged`);
  }
}

/**
 * 
 * @param {Object} a             first object
 * @param {Object} b             second object
 * @param {Array} ignoredProps   props to be ignored while comparing objects
 * @returns {boolean}            true if the two objects are equivalent
 *                               (they share all properties values, except for the `ignoredProps`)
 */
const areEquivalent = (a, b, ignoredProps) => {
  // create arrays of property names, ignoring props to be ignored
  const aProps = Object.getOwnPropertyNames(a).filter(p => !ignoredProps.includes(p));
  const bProps = Object.getOwnPropertyNames(b).filter(p => !ignoredProps.includes(p));

  // if number of properties is different, objects are not equivalent
  if (aProps.length != bProps.length) {
    return false;
  }

  for (var i = 0; i < aProps.length; i++) {
    const propName = aProps[i];
    if (a[propName] !== b[propName]) { // if values of same property are not equal, objects are not equivalent
      return false;
    }
  }

  // if we made it this far, objects are considered equivalent
  return true;
}

const saveItemImage = async(item, imageDownloaded) => {
  try {
    const image = item._doc.images.find(image => image.url === imageDownloaded.url);
    if (typeof image !== 'undefined') {
      //logger.debug(`updating image ${image.url}`);
      const retval = await Items.updateOne(
        { id: item.id, provider: item.provider, 'images.url': imageDownloaded.url},
        { '$set': { 'images.$': imageDownloaded } }
      );
      return retval;
    } else {
      throw (`image downloaded url ${imageDownloaded.url} was not found in item`);
    }
  } catch (err) {
    throw (`error saving item image: ${err}`);
  }

}
  
// const deleteItemImage = async(item, image) => {
//   try {
//     await Items.updateOne(
//       { id: item.id, provider: item.provider },
//       { $pull: { images: { url: image.url } } },
//     );
//   } catch (err) {
//     throw (`error deleting item image: ${err}`);
//   }
//   try {
//     if (fs.existsSync(image.localPath)) { // remove also image file
//       fs.unlinkSync(image.localPath);
//     }
//   } catch (err) {
//     throw (`error deleting item image: ${err}`);
//   }
// }

updateUserStatus = async (user) => { // TODO: DEBUG ME !
  try {
    //const Items = require("../models/Items");
logger.debug('updateUserStatus started for user:', user.name, user.role);
    const items = await Items.find({}).exec();

    const userStatus = new UserStatuses({user: user._id});
logger.debug('userStatus:', userStatus);
    items.map(item => {
      userStatus.update();
    });
return userStatus;
  } catch(err) {
    throw (new Error(`error updating user status: ${dumperr(err)}`));
  }
}

updateUserProps = async (user, item, props) => { // TODO: DEBUG ME !
  logger.debug('updateUserProps started for user:', user);
  logger.debug('updateUserProps started for user:', item);
  logger.debug('updateUserProps started for user:', props);
  process.exit();
  try {
    const userDoc = await login(user.email, user.password);
    if (userDoc.role !== 'user' && userDoc.role != 'admin') {
      throw('user is not enabled for this action');
    }
    const itemDoc = await Items.findOne(item);

    const userStatus = {};
    let changed = false;
    Object.keys(props).forEach((key) => {
      //logger.debug('key, value:', key, props[key]);
      if (userStatus[key] !== props[key]) { // property changed
        userStatus[key] = props[key];
        changed = true; // TODO: this could be useful in future...
      }
    });
    logger.debug('updateUserProps userStatus:', userStatus);

    const query = {user: userDoc._id, item: itemDoc._id},
    update = userStatus,
    options = { upsert: true, new: true, setDefaultsOnInsert: true };

    // ((find and update) or (insert)) the document
    const result = await UserStatuses.findOneAndUpdate(query, update, options).exec(); //, function(error, result) {
    return result;
  } catch(err) {
    throw (new Error(`error updating user props: ${dumperr(err)}`));
  }
}

const scrapeSchedule = async(req) => {
  logger.info(`providers.scrapeSchedule.enable.${req.requestId}`);
  try {
    const schedule = req.body.schedule ? req.body.schedule : config.schedule;
    cron.schedule(schedule, async() => {
      // TODO: check no scrape is running already...
      logger.debug(`scheduling scrape now (${new Date().toUTCString()}) - schedule is ${schedule}`);
      await scrapeProviders(req);
      await scrapeProvidersImages(req);
    });
    logger.info(`providers.scrapeSchedule.enable.${req.requestId}.success`);
  } catch (err) {
    logger.error(`providers.scrapeSchedule.enable.${req.requestId}.error ${dumperr(err)}`);
    throw (new Error(`error scheduling scraping ${dumperr(err)}`));
  }
}

// const _register = async (email, password, name, phone, role) => {
//   try {
//     console.info('register:', await register(email, password, name, phone, role));
//   } catch(err) {
//     throw(new Error(`error registering user: ${dumperr(err)}`));
//   }
// }

// const _login = async (email, password) => {
//   try {
//     console.info('login:', await login(email, password));
//   } catch(err) {
//     throw(new Error(`error logging user: ${dumperr(err)}`));
//   }
// }

const _updateUserStatus = async () => {
  try {
    // const user = await login('marcosolari+1@gmail.com', 'password');
    // if (user.role !== 'user' && user.role != 'admin') {
    //   throw('user is not enabled for this action');
    // }
    const item = {vote: 0.7, note: 'nice'};
    console.info('updateUserStatus:', await updateUserStatus(user));
  } catch(err) {
    throw (new Error(`error updating user status: ${dumperr(err)}`));
  }
}

const _updateUserProps = async (item, props) => {
  const user = {email: 'marcosolari+1@gmail.com', password: 'password'};
  const _item = item ? item : {id: '9317', provider: 'toe'};
  const _props = props ? props : {vote: 0.7, note: 'nice'};
  console.info('updateUserProps:', await updateUserProps(user, _item, _props));
}

const getProvidersByRegion = (regionDescriptor) => {
  const glob = require('glob');
  const path = require('path');
  const providers = [];
  glob.sync('src/providers/*.js').forEach(file => {
    p = require(path.resolve(file));
    if (p.info) {
      Object.keys(p.info.regions).some(region => {
        if (Array.isArray(regionDescriptor)) { // a list of region descriptors
          return regionDescriptor.some(rd => {
            return go(rd, region, p);
          });
        } else {
          return go(regionDescriptor, region, p);
        }

        function go(regionDescriptor, region, provider) {
          if (typeof regionDescriptor === 'object') { // a region object: { country, city }
            Object.keys(provider.info.regions).forEach(r => {
              let pattern = '^';
              if (regionDescriptor.country) {
                pattern += regionDescriptor.country;
                if (regionDescriptor.city) {
                  pattern += '\\.';
                }
              }
              if (regionDescriptor.city) {
                pattern += regionDescriptor.city;
              } else {
                pattern += '.*';
              }
              pattern += '\$';
              if (r.match(new RegExp(pattern, 'i'))) {
                if (!providers.some(p => p.info.key === provider.info.key)) {
                  providers.push(provider);
                  return true;
                }
              }
            })
          } else
          if (typeof regionDescriptor === 'string') { // a region regex, or '*' for all regions 
            let pattern = regionDescriptor;
            if (
              (pattern === '*') ||
              region.match(new RegExp('^' + pattern + '$', 'i'))
            ) {
              if (!providers.some(p => p.info.key === provider.info.key)) {
                providers.push(provider);
                return true;
              }
            }
          } else {
            console.error('invalid regionDescriptor type:', typeof regionDescriptor);
          }
          return false;
        }
      })
    }
  });
  return providers;
}

const getProviderRegions = (provider, regionDescriptor) => {
  const regions = [];

  if (provider.info) {
    Object.keys(provider.info.regions).map(region => {
      if (Array.isArray(regionDescriptor)) { // a list of region descriptors
        return regionDescriptor.map(rd => {
          return go(rd, region);
        });
      } else {
        return go(regionDescriptor, region);
      }

      function go(regionDescriptor, region) {
        if (typeof regionDescriptor === 'object') { // a region object: { country, city }
          let pattern = '^';
          if (regionDescriptor.country) {
            pattern += regionDescriptor.country;
            if (regionDescriptor.city) {
              pattern += '\\.';
            }
          }
          if (regionDescriptor.city) {
            pattern += regionDescriptor.city;
          } else {
            pattern += '.*';
          }
          pattern += '\$';
          const matches = region.match(new RegExp(pattern));
          if (matches) {
            for (let i = 0; i < matches.length; i++) {
              if (!regions.some(r => r === matches[i])) {
                regions.push(matches[i]);
              }
            }
          }
          return regions;
        } else
        if (typeof regionDescriptor === 'string') { // a region regex, or '*' for all regions
          let pattern = regionDescriptor;
          if (pattern === '*') {
            match = new RegExp('.*', 'i');
          } else {
            match = new RegExp('^' + pattern + '$', 'i');
          }
          const matches = region.match(match);
          if (matches) {
            for (let i = 0; i < matches.length; i++) {
              if (!regions.some(r => r === matches[i])) {
                regions.push(matches[i]);
              }
            }
          }
          return regions;
        } else {
          console.error('invalid regionDescriptor type:', typeof regionDescriptor);
        }
        return regions;
      }
    })
  }
  return regions;
}

globalsGet = async (key) => {
  return (await globals.findOne({ key }).exec()).value;
}

globalsSet = async(key, value) => {
  await globals.updateOne({ key }, { value }, { upsert: true }).exec();
}

String.prototype.toHHMMSS = function() {
  var sec_num = parseInt(this, 10) / 1000;
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);
  if (hours < 10) { hours = "0" + hours; }
  if (minutes < 10) { minutes = "0" + minutes; }
  if (seconds < 10) { seconds = "0" + seconds; }
  return hours + ':' + minutes + ':' + seconds;
};

Number.prototype.toHHMMSS = function() {
  var sec_num = parseInt(this / 1000, 10);
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);
  if (hours < 10) { hours = "0" + hours; }
  if (minutes < 10) { minutes = "0" + minutes; }
  if (seconds < 10) { seconds = "0" + seconds; }
  return hours + ':' + minutes + ':' + seconds;
};

module.exports = {
  scrapeProviders,
  scrapeProvidersImages,
  groupProvidersItems,
  someCommonImages,
  itemsMerge,
  getProviders,
  showCommonImages,
  scrapeSchedule,
};