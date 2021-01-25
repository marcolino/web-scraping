const cron = require('node-cron');
const fetch = require('node-fetch');
const fs = require('fs');
const mime = require('mime-types');
const crypto = require('crypto');
const uuid = require('uuid');
const Items = require('../models/Items.' + 'persons'); // TODO: make persons a variable...
const UserStatuses = require("../models/UserStatuses");
const Globals = require("../models/Globals");
const { phoneNormalize } = require('../utils/providers');
//const { dbConnect, dbClose } = require('../utils/db');
const { browserLaunch, browserPageNew, browserPageClose, browserClose } = require('../utils/browser');
const { mimeImage } = require('../utils/misc');
const { calculatePHash, comparePHashes } = require('../utils/image');
//const { register, login } = require('./user');
const globals = require('../models/Globals');
const logger = require('../logger');
const config = require('../config');

exports.scrapeProviders = async(req) => {
  logger.info(`providers.scrapeProviders.starting.${req.requestId}`);
  try {
    const lastScrapeTimestamp = new Date().toISOString();
    globalsSet(`lastScrapeStatus`, `started`);
    globalsSet(`lastScrapeTimestampStart`, lastScrapeTimestamp);
    const regionDescriptor = req.body.regionDescriptor || '*';
//logger.debug('regionDescriptor:', regionDescriptor);
    const providers = getProvidersByRegion(regionDescriptor);
//logger.debug('providers keys:', Object.keys(providers));
    const data = (await Promise.all(
      Object.keys(providers)
      .filter(index => providers[index].info.type === config.type)
      .filter(index => !(config.scrape.onlyProvider.length && !config.scrape.onlyProvider.includes(providers[index].info.key)))
      .map(async index => {
        const provider = providers[index];
        const regions = getProviderRegions(provider, regionDescriptor);
//logger.debug('regions:', regions);
        let results = [];
        for (let r = 0; r < regions.length; r++) { // loop on all regions
//logger.debug('region:', r);
          const result = await scrapeProvider(provider, regions[r])
          results = results.concat(result);
        }
        return results;
      })
    )).flat(); // we flat-out due to Promise.All
    // save last scrape timestamp in globals
    globalsSet(`lastScrapeTimestamp`, lastScrapeTimestamp);
    //logger.debug(`Request ${req.requestId} successful: ${data.length} providers scraped`); // TODO
    logger.info(`providers.scrapeProviders.finishing.${req.requestId}.success: ${data.length}`);
  } catch (err) {
    //logger.debug(`Request ${req.requestId} unsuccessful: ${err}`); // TODO
    logger.error(`providers.scrapeProviders.finishing.${req.requestId}.error: ${err}`);
  } finally {
    globalsSet(`lastScrapeStatus`, `finished`);
  }
}

exports.scrapeProvidersImages = async (req) => {
  try {
    const regionDescriptor = req.body.regionDescriptor || '*';
    const providers = getProvidersByRegion(regionDescriptor);
    //Object.keys(providers).map((pk, index) => {console.log('filter in:', providers[pk], !(config.scrape.onlyProvider.length && !config.scrape.onlyProvider.includes(providers[index].info.key))); });
    const count = (await Promise.all(
      Object.keys(providers)
      .filter(index => !(config.scrape.onlyProvider.length && !config.scrape.onlyProvider.includes(providers[index].info.key)))
      .map(async index => {
        const provider = providers[index];
        const regions = getProviderRegions(provider, regionDescriptor);
        let results = 0;
//console.log('regions:', regions);
        for (let r = 0; r < regions.length; r++) {
          const result = await scrapeProviderImages(provider, regions[r]);
          results += result;
        }
        return results;
      })
    )).flat(); // we flat-out due to Promise.All
    const sum = count.reduce((a, b) => a + b, 0);
    logger.debug(`all providers persons images scraped, found ${sum} images`);
    return sum;
  } catch(err) {
    throw(new Error(`error scraping providers persons images: ${err}`));
  }
}

exports.groupProvidersItems = async() => {
  const sameGroup = (a, b) => {
    return (a.phone && b.phone && a.phone === b.phone);
  }
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
const sameGroup_2_0 = (a, b) => {
  return (
    (a.phone === b.phone)
    &&
    (exports.someCommonImages(a, b))
  );

}

/**
 * Check if two items share common (considered equal) images
 */
exports.someCommonImages = (a, b, threshold = 0.20) => {
  for (var i = 0, lenA = a.images.length; i < lenA; i++) {
    const ai = a.images[i];
    if (ai.phash) {
      for (var j = 0, lenB = b.images.length; j < lenB; j++) {
        const bj = b.images[j];
        if (bj.phash) {
          if (comparePHashes(ai.phash, bj.phash, threshold /*0.1094*/)) {
            // found a common image
            //return true;
            return [ ai.localPath, bj.localPath ]; // TODO: DEBUG only
          }
        }
      }
    }
  }
  return false;
}

scrapeProvider = async (provider, region, user) => {
  if (config.scrape.onlyProvider.length && !config.scrape.onlyProvider.includes(provider.info.key)) {
    logger.debug('BREAK DUE TO scrape.onlyProvider');
    return;
  }
  try {
    const browser = await browserLaunch();
    const page = await browserPageNew(browser);

    if (config.scrape.debug) page.on('console', msg => {
      logger.debug(msg.text())
    }); // do use logger.debug() inside page.evaluate

    const items = await scrapeProviderMultiListAndItems(provider, region, page)

    try { await browserPageClose(page) } catch(err) { console.error('page close error:', err) }
    try { await browserClose(browser) } catch(err) { console.error('browser close error:', err) }

    return items ? (await Promise.all(items)).flat() : []; // we flat-out due to Promise.All
  } catch(err) {
    throw (new Error(`error scraping provider ${provider.info.key}: ${err}`));
  }
};

const scrapeProviderMultiListAndItems = async (provider, region, page) => {
  let nextListPage = null;
  let itemsMultiPage = [];
  do {
    const list = await scrapeList(provider, region, page, nextListPage);
    nextListPage = list && list.length ? list[list.length-1].nextListPage : null;
    let items = await scrapeItems(provider, region, page, list);
    if (items && items.length && items[items.length-1].itemFoundBreakMultiPage) { // one item was found existing in immutable provider: break multi page loop
      items.pop();
      nextListPage = null; // break loop
    }
    itemsMultiPage = itemsMultiPage.concat(items);
    if (config.scrape.onlyFirstPage) {
      logger.debug('BREAK DUE TO scrape.onlyFirstPage');
      break;
    }
  } while (nextListPage);
  return itemsMultiPage;
}

const scrapeList = async(provider, region, page, nextListPage) => {
  try {
    return await provider.listPageEvaluate(region, page, nextListPage);
  } catch (err) {
    console.warn(`error scraping list for provider ${provider.info.key}: ${err}`);
  }
}

const scrapeItems = async (provider, region, page, list) => {
  try {
    const itemsFull = [];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.id) { // this is not a dummy item for multi-page handling
          if (provider.info.immutable) { // this provider pages are immutable: avoid reparsing already present items
            const exists = await itemExists(item); // check if already present, to avoid reparsing already present items...
            if (exists) { // item found existing in immutable provider list: break and signal multi-page handle to break
              itemsFull.push({itemFoundBreakMultiPage: true});
              break;
            }
          }
          const itemFull = await provider.itemPageEvaluate(region, page, item);
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
              saveItem(itemFull);
              itemsFull.push(itemFull);
            }
          } else {
            console.warn(`null item from page`);
          }
        }
        if (config.scrape.onlyFirstItem) {
          logger.debug('BREAK DUE TO scrape.onlyFirstItem');
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
    const items = await Items.find({
      provider: provider.info.key,
      region: region,
    });
//logger.debug('scrapeProviderImages items:', items.length)
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      let item = items[i];
      if (config.scrape.onlyItemId.length && !config.scrape.onlyItemId.includes(item.id)) {
        continue;
      }
      item.provider = provider.info.key;
      item.type = provider.info.type;
      item.region = region;

      for (let j = 0; j < item.images.length; j++) {
        let image = item.images[j];
//logger.debug('scrapeProviderImages item image:', image)
        if (!image.localPath) { // only download missing images
//logger.debug(`--- downloading images of person ${item.provider} ${item.id} - n° ${1+i} / ${items.length} ---`);
          const imageDownloaded = await downloadImage(provider, region, item, image);
          if (imageDownloaded && imageDownloaded.success) {
//logger.debug(`image phash: ${JSON.stringify(image.phash)}`);
            if (!image.phash) {  // calculate image perceptual hash, if not present yet
//logger.debug(`image phash being calculated`);
              imageDownloaded.phash = await calculatePHash(imageDownloaded.localPath);
//logger.debug(`--- saving image ${j} of ${item.images.length} -------------`);
            }
            await saveItemImage(item, imageDownloaded);
            count++;
          }
        }
//else logger.debug(`--- NOT downloading image ${j} of ${item.images.length} ---`);
      }
    }
    return count; 
  } catch (err) {
    logger.error(`error scraping provider images: ${err}`);
  }
}

downloadImage = async (provider, region, item, image) => {
  imageUrl = provider.info.regions[region].imagesUrl + image.url;
  try {
//logger.debug('downloadImage - downloading image url', imageUrl);
    const retval = {success: false};
    const response = await fetch(imageUrl, {
      headers: {
        'If-Modified-Since': image.date ? image.date.toUTCString() : null,
        'If-None-Match': image.etag,
      },
    });
    const status = response.status;
// logger.debug('downloadImage - fetch status:', status);
    if (status === 404) {
      console.warn(`image ${imageUrl} not found: ignoring`);
      return retval;
    }
    if (status === 304) {
      console.warn(`image ${imageUrl} did not change: ignoring`);
      return retval;
    }
    if (status !== 200) {
      console.warn(`image ${imageUrl} download status was ${status}: ignoring`);
      return retval;
    }
    const mimeType = response.headers.get('content-type').replace(/;.*/, '');
    const date = response.headers.get('last-Modified');
    const etag = response.headers.get('etag');
    //etag = etag ? etag.replace(/['"]/g, '') : null;
// logger.debug('downloadImage - mimeType:', mimeType);
// logger.debug('downloadImage - date:', date);
// logger.debug('downloadImage - etag:', etag);

    if (etag === image.etag) {
      logger.debug(`etag not changed for ${imageUrl}: ignoring`);
      return retval;
    }
    if (!mimeType) {
      console.warn(`image ${imageUrl} content type was not defined: ignoring`);
      return retval;
    }
    if (!mimeImage(mimeType)) {
      console.warn(`image ${imageUrl} content type was not image (${mimeType}): ignoring`);
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
    const buffer = await response.buffer();
    try { // check if image exists already
      fs.accessSync(outputFileName, fs.constants.R_OK); 
      //logger.debug(`image ${imageUrl} file exists already: ignoring`);
    } catch (err) {
      if (err.code !== 'ENOENT') { // some error accessing file
        console.warn(`file ${outputFileName} has some problem accessing: ${err.code}`);
        // fall down
      } else { // image does not exist, save it to filesystem
        try {
          fs.writeFileSync(outputFileName, buffer);
          logger.debug(`downloaded image ${imageUrl} file saved`);
        } catch (err) {
          console.warn(`cannot save downloaded image file ${outputFileName}: ${err}`);
          return retval;
        }
      }
    }
    retval.success = true;
    retval.url = image.url;
    retval.category = image.category;
    retval.date = date;
    retval.etag = etag;
    retval.localPath = outputFileName;
// logger.debug('downloadImage - returning:', retval);
    return retval;
  } catch (err) {
    console.warn(`error downloading image at ${imageUrl}: ${err}`);
  }
}

const itemExists = async(item) => {
  try {
    //const Items = require("../models/Items" + "." + item.type);
    const retval = await Items.exists({
      id: item.id,
      provider: item.provider,
      //region: item.region
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
          compareItemsHistoryes(null, itemNew, itemNew);
          //logger.debug(`item ${itemNew.title} inserted`);
        });
      } else { // an existing item
        const itemOldLean = JSON.parse(JSON.stringify(itemOld));
        const itemMerged = itemsMerge(itemOldLean, item);
        itemOld.set({...itemMerged});
        itemOld.save((err, itemNew) => {
          if (err) {
            throw (new Error(`error updating item: ${err}`));
          }
          const itemNewLean = JSON.parse(JSON.stringify(itemNew._doc));
          compareItemsHistoryes(itemOldLean, itemNewLean, itemNew);
          //logger.debug(`item ${itemNew.title} updated`);
        });
      }
    }
  );
}

const itemsMerge = (o, n) => {
  const merged = {};
  for (const prop in n) {
    //const value = n[prop];
    switch (prop) {
      case 'id':
      case 'provider':
      case 'region':
      case 'group':
      case 'changedAt':
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
      case 'images': // array of objects
        o[prop] = o[prop].map(p => { p.active = false; return p; }); // set active to false on all items of old prop array
        n[prop] = n[prop].map(p => { p.active = true; return p; }); // set active to true on all items of old prop array
console.log('o[prop]:', o[prop]);
console.log('n[prop]:', n[prop]);
        merged[prop] = arraysMerge(o[prop], n[prop], [ 'url' ]); // merge old and new arrays, excluding objects with a common set of props
        break;
      case 'comments': // array of objects (author, authorCommentsCount, text, date, vote)
        merged[prop] = arraysMerge(o[prop], n[prop], ['author', 'text', 'date']); // merge old and new arrays, excluding objects with a common set of props
        break;
      default:
        logger.warn('itemsMerge unforeseen prop', prop, n[prop], typeof n[prop]);
    }
  }
  return merged;
}

/**
 * Merge two arrays of objects, excluding objects with a common set of props, ad adding n' active boolean prop (set to true in new array) if requested
 * @param {array} o
 * @param {array} n
 * @param {array} commonPropsSet
 */
const arraysMerge = (o, n, commonPropsSet) => {
  const keysOldSets = [];
  const keysNewSets = [];
  for (var i = 0; i < commonPropsSet.length; i++) { // build an array of sets for all commonPropsSet
    keysOldSets[i] = new Set(o.map(d => d[commonPropsSet[i]])); // build a set of univoke keys in old array
  }
  for (var i = 0; i < commonPropsSet.length; i++) { // build an array of sets for all commonPropsSet
    keysNewSets[i] = new Set(n.map(d => d[commonPropsSet[i]])); // build a set of univoke keys in new array
  }
  const merged = [...(n), ...(o).filter(m => { // merge new and old document for this prop, filtering it out if *all* commonPropsSet are the same
    for (var i = 0; i < commonPropsSet.length; i++) { // loop through all commonPropsSet, to skip array elements with all key props equal
      if (!(keysOldSets[i].has(m[commonPropsSet[i]]) && keysNewSets[i].has(m[commonPropsSet[i]]))) {
        return true; // this common prop is not in this to-be-merged object (merge it)
      }
    }
    return false; // all common props are in this to-be-merged object (skip it)
  })];
  return merged;
}

const compareItemsHistoryes = (itemOldLean, itemNewLean, itemNew) => {
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
              // require('colors');
              // const diff = require('diff');
              // const differences = diff.diffChars(itemOldLean[prop], itemNewLean[prop]);
              // let difference = '';
              // differences.forEach((part) => {
              //   // green for additions, red for deletionn, grey for common parts
              //   const color = part.added ? 'bgGreen' :
              //     part.removed ? 'bgRed' :
              //     'grey'
              //   ;
              //   difference += part.value[color];
              // });
              // logger.info(`${key} changed ${prop}: ${difference}`);

              logger.info(`${key} changed ${prop}: ${itemOldLean[prop]} => ${itemNewLean[prop]}`);
              changed = true;
            }
            break;
          case 'array': // we assume one level only arrays (shallow compare)
//if(prop !== 'images') break;
//  console.log('PROP:', prop);
            const o = itemOldLean[prop];
            const n = itemNewLean[prop];

            // check for removed elements in array
            const removed = [];
            for (var oi = 0; oi < o.length; oi++) {
              const oObj = o[oi];
              let found = false;
              for (var ni = 0; ni < n.length; ni++) {
                const nObj = n[ni];
                if (areEquivalent(nObj, oObj, ['_id', 'authorCommentsCount', 'date', 'etag', /*'type'*/, 'phash', 'localPath'])) {
                  found = true;
                  break;
                }
//else logger.warn('nObj', nObj);
              }
              if (!found) { // this old item was not found or was different in new items
//logger.warn('oObj not found!!!!', oObj); return;
                removed.push(oObj);
              }
            }
            if (removed.length) {
              logger.info(`${key} removed ${removed.length} ${prop}: ${JSON.stringify(removed)}`);
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
  //console.log('COMPARING:', oObj, mObj);
                //if (areEquivalent(oObj, nObj, ['_id'])) {
                if (areEquivalent(nObj, oObj, ['_id', 'authorCommentsCount', 'date', 'etag', /*'type'*/, 'phash', 'localPath'])) {
                  found = true;
                  break;
                }
              }
              if (!found) { // this new item was not found or was different in old items
                added.push(nObj);
              }
            }
            if (added.length) {
              logger.info(`${key} added ${added.length} ${prop}` /*: ${added}`*/);
              changed = true;
            }

            break;
          default:
            logger.warn(`${prop}: type ${type} diff is not yet implemented`);
            break;
        }
      }
    });
  }
  if (added || changed) { // save changetAt now timestamp
    itemNew.update({ changedAt: new Date() });
  } else {
    logger.info(`${key} unchanged`)
  }
}

/**
 * 
 * @param {Object} a             first object
 * @param {Object} b             second object
 * @param {Array} ignoredProps   props to be ignored while comparing objects
 * @returns {boolean}            true if the two objects are equivalent
 *                               (they share all properties values, except for `ignoredProps`)
 */
const areEquivalent = (a, b, ignoredProps) => {
  // create arrays of property names, ignoring props to be ignored
  var aProps = Object.getOwnPropertyNames(a).filter(p => !ignoredProps.includes(p));
  var bProps = Object.getOwnPropertyNames(b).filter(p => !ignoredProps.includes(p));

  //console.log('aProps:', aProps);
  //console.log('bProps:', bProps);

  // if number of properties is different, objects are not equivalent
  if (aProps.length != bProps.length) {
    return false;
  }

  for (var i = 0; i < aProps.length; i++) {
    var propName = aProps[i];

    // if values of same property are not equal, objects are not equivalent
    if (a[propName] !== b[propName]) {
      return false;
    }
  }

  // if we made it this far, objects are considered equivalent
  return true;
}

const saveItemImage = async(item, imageDownloaded) => {
  delete imageDownloaded.success;
  //logger.debug('saveItemImage - imageDownloaded:', imageDownloaded);
  try {
    //const Items = require("../models/Items" + "." + item.type);
    const retval = await Items.updateOne(
      { id: item.id, provider: item.provider, "images": { "$elemMatch": { "url": imageDownloaded.url } }  },
      { $set: { "images.$": imageDownloaded } },
      function(err, result) {
        if (err) {
          console.warn('error updating item image:', imageDownloaded, err);
        } else {
          //logger.debug(`image ${imageDownloaded.url} updated ${result.ok === 1 ? 'successfully' : 'with some problem'}`, result);
        }
      }
    );
    return retval; 
  } catch (err) {
    throw (new Error(`error saving item image: ${err}`));
  }
}

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
    throw (new Error(`error updating user status: ${err}`));
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
    throw (new Error(`error updating user props: ${err.message}`));
  }
}

scrapeSchedule = async(providers, region, user) => {
  try {
    cron.schedule(config.schedule, () => {
      logger.debug('running on', new Date().toUTCString());
      const result = scrapeProviders(providers, region, user);
    });
  } catch(err) {
    throw (new Error(`error scheduling scraping ${err}`));
  }
}

// const _register = async (email, password, name, phone, role) => {
//   try {
//     console.info('register:', await register(email, password, name, phone, role));
//   } catch(err) {
//     throw(new Error(`error registering user: ${err}`));
//   }
// }

// const _login = async (email, password) => {
//   try {
//     console.info('login:', await login(email, password));
//   } catch(err) {
//     throw(new Error(`error logging user: ${err}`));
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
    throw (new Error(`error updating user status: ${err}`));
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



// (async() => {
//   try {
//     await dbConnect().then(async() => {
//       const args = process.argv.slice(2);
//       const command = args[0];
//       //let email, password, name, phone, role;
//       switch (command) {
//         case "scrapeProviders":
//           regionDescriptor = args[1] || '*';
//           providersByRegion = getProvidersByRegion(regionDescriptor);
//           await scrapeProviders(providersByRegion, regionDescriptor, {email: 'marco.solari@gmail.com', password: 'password'}, );
//           break;
//         case "scrapeProvidersImages":
//           regionDescriptor = args[1] || '*';
//           providersByRegion = getProvidersByRegion(regionDescriptor);
//           await scrapeProvidersImages(providersByRegion, regionDescriptor, {email: 'marco.solari@gmail.com', password: 'password'}, );
//           break;
//         case "scrapeSchedule":
//           regionDescriptor = args[1] || '*';
//           providersByRegion = getProvidersByRegion(regionDescriptor);
//           await scrapeSchedule(providersByRegion, regionDescriptor, {email: 'marco.solari@gmail.com', password: 'password'}, );
//           break;
//         // case "scrapeProvidersByRegion":
//         //   region = args[1];
//         //   providersByRegion = getProvidersByRegion(region);
//         //   await scrapeProviders({email: 'marco.solari@gmail.com', password: 'password'}, providersByRegion, region);
//         //   break;
//         case "updateUserStatus":
//           await _updateUserStatus();
//           break;
//         case "updateUserProps":
//           itemId = args[1];
//           itemProvider = args[2];
//           key1 = args[3];
//           val1 = args[4];
//           key2 = args[5];
//           val2 = args[6];
//           item = itemId && itemProvider ? {id: itemId, provider: itemProvider} : null;
//           props = key1 && val1 && key2 && val2 ? {[key1]: val1, [key2]: val2} : null;
//           await _updateUserProps({item, props});
//           break;
//         case "test":
//           const list = await test({type: 'persons', provider: 'pf'});
//           logger.debug(JSON.stringify(list));
//           break;
//         default:
//           console.error("unforeseen command", command);
//           break;
//       }
//     });
//   } catch(err) {
//     console.error(err);
//   } finally {
//     dbClose();
//   }
// })();