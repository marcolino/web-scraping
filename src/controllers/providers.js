//const { ObjectID } = require('mongodb');
//const items = require('../models/Items.' + 'persons'); // TODO: make persons a variable...

const cron = require('node-cron');
const fetch = require('node-fetch');
const fs = require('fs');
const mime = require('mime-types');
const crypto = require('crypto');
const uuid = require('uuid');
const { phoneNormalize } = require('../utils/providers');
//const { dbConnect, dbClose } = require('../utils/db');
const { browserLaunch, browserPageNew, browserPageClose, browserClose } = require('../utils/browser');
const { mimeImage } = require('../utils/misc');
//const { register, login } = require('./user');
const globals = require('../models/Globals');
const logger = require('../logger');
const config = require('../config');

// TODO: const Items = require("../models/Items");

exports.scrapeProviders = async(req) => {
  logger.info(`providers.scrapeProviders.starting.${req.requestId}`);
  try {
    const regionDescriptor = req.body.regionDescriptor || '*';
//logger.debug('regionDescriptor:', regionDescriptor);
    const providers = getProvidersByRegion(regionDescriptor);
//logger.debug('providers keys:', Object.keys(providers));
    const data = (await Promise.all(
      Object.keys(providers)
      .filter(index => providers[index].info.type === config.type)
      .filter(index => !providers[index].info.disableScraping)
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
        // save last scrape timestamp for this provider in globals
        await globalsSet(`lastScrapeTimestamp-${provider.info.key}`, new Date().toISOString());
        return results;
      })
    )).flat(); // we flat-out due to Promise.All
    // save last scrape timestamp in globals
    await globalsSet(`lastScrapeTimestamp`, new Date().toISOString());
    //logger.debug(`Request ${req.requestId} successful: ${data.length} providers scraped`); // TODO
    logger.info(`providers.scrapeProviders.finishing.${req.requestId}.success: ${data.length}`);
  } catch (err) {
    //logger.debug(`Request ${req.requestId} unsuccessful: ${err}`); // TODO
    logger.error(`providers.scrapeProviders.finishing.${req.requestId}.error: ${err}`);
  }
}

/////////////////////////////////////////////////////////////////////////////////////////////////

exports.scrapeProvidersImages = async (req) => {
  try {
    const regionDescriptor = req.body.regionDescriptor || '*';
    const providers = getProvidersByRegion(regionDescriptor);
    const count = (await Promise.all(
      Object.keys(providers).filter(providerKey => !providers[providerKey].info.disableScraping).map(async providerKey => {
        const provider = providers[providerKey];
        const regions = getProviderRegions(provider, regionDescriptor);
        let results = 0;
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
    throw(`error scraping providers persons images: ${err}`);
  }
}

groupItems = async (req) => {
  const type = "persons";
  const Items = require("../models/Items" + "." + type);

  try {
    const lastScrapeTimestamp = await mongoose.model('Globals').findOne({ key: `lastScrapeTimestamp` }).exec();

    const itemsAll = await Items.find({});
    const itemsNew = await Items.find({
      dateInserted: { $ge: lastScrapeTimestamp }, // is new
    });
    itemsAll.foreach(async(itemAll) => {
      itemsNew.foreach(async(itemNew) => {
        if (sameGroup(itemAll, itemNew)) { // check if the two items should be grouped
          if (itemNew.group) logger.warn(`new item ${itemNew.provider} ${itemNew.id} ${itemNew.region}' has already a group!`);
          if (!itemAll.group) {
            itemAll.group = uuid.v4();
            await Items.updateOne(
              { id: itemAll.id, provider: itemAll.provider, regionAll: itemAll.region },
              { ...itemAll }
            );
          }
          itemNew.group = itemAll.group;
          await Items.updateOne(
            { id: itemNew.id, provider: itemNew.provider, region: itemNew.region },
            { ...itemNew }
          );
        }
      });
    });
    const sameGroup = (a, b) => {
      return (a.phone === b.phone);
    }
  } catch (err) {
    throw (`error grouping item: ${err}`);
  }
}

scrapeProvider = async (provider, region, user) => {
  try {
    const browser = await browserLaunch();
    const page = await browserPageNew(browser);

    if (config.debug) page.on('console', msg => {
      logger.debug(msg.text())
    }); // do use logger.debug() inside page.evaluate

    const items = await scrapeProviderMultiListAndItems(provider, region, page)

    try { await browserPageClose(page) } catch(err) { console.error('page close error:', err) }
    try { await browserClose(browser) } catch(err) { console.error('browser close error:', err) }

    return items ? (await Promise.all(items)).flat() : []; // we flat-out due to Promise.All
  } catch(err) {
    throw(`error scraping provider ${provider.info.key}: ${err}`);
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
break;
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
//break;
      }
    }
    return itemsFull;
  } catch (err) {
    console.warn(`error scraping items: ${err}`);
  }
}

scrapeProviderImages = async (provider, region) => {
  try {
    const type = "persons";
    const Items = require("../models/Items" + "." + type);

    const items = await Items.find({
      provider: provider.info.key,
      region: region
    });
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      let item = items[i];
      item.provider = provider.info.key;
      item.type = provider.info.type;
      item.region = region;

      for (let j = 0; j < item.images.length; j++) {
        let image = item.images[j];
        if (!image.localPath) { // only download missing images
//logger.debug(`--- downloading images of person ${item.provider} ${item.id} - n° ${1+i} / ${items.length} ---`);
          const imageDownloaded = await downloadImage(provider, region, item, image);
          if (imageDownloaded && imageDownloaded.success) {
//logger.debug(`--- saving image ${j} of ${item.images.length} -------------`);
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
      logger.debug(`image ${imageUrl} file exists already: ignoring`);
    } catch (err) {
      if (err.code !== 'ENOENT') { // some error accessing file
        console.warn(`file ${outputFileName} has some problem accessing: ${err.code}`);
        // fall down
      } else { // image does not exist, save it to filesystem
        try {
          fs.writeFileSync(outputFileName, buffer);
          logger.debug(`image ${imageUrl} file downloaded`);
        } catch (err) {
          console.warn(`cannot save image file ${outputFileName}: ${err}`);
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
    const Items = require("../models/Items" + "." + item.type);
    const retval = await Items.exists({
      id: item.id,
      provider: item.provider,
      region: item.region
    });
    return retval; 
  } catch (err) {
    throw (`error finding item: ${err}`);
  }
}

const saveItem = async(item) => {
  const Items = require("../models/Items" + "." + item.type);
  Items.findOne(
    { id: item.id, provider: item.provider, region: item.region },
    (err, itemOld) => {
      if (err) {
        throw (`error finding item to save: ${err}`);
      }
      if (!itemOld) { // a new item
        itemOld = new Items(item);
        itemOld.save((err, itemNew) => {
          if (err) {
            throw (`error saving new item: ${err}`);
          }
          compareItemsHistoryes(null, itemNew);
          //logger.debug(`item ${itemNew.title} inserted`);
        });
      } else { // an existing item
        const itemOldFlat = JSON.parse(JSON.stringify(itemOld));
        itemOld.set({...item});
        itemOld.save((err, itemNew) => {
          if (err) {
            throw (`error updating item: ${err}`);
          }
          const itemNewFlat = JSON.parse(JSON.stringify(itemNew._doc));
          compareItemsHistoryes(itemOldFlat, itemNewFlat);
          //logger.debug(`item ${itemNew.title} updated`);
        });
      }
    }
  );
}

const compareItemsHistoryes = (itemOld, itemNew) => {
  const key = `${itemNew.provider} ${itemNew.id} ${itemNew.region}`;
  if (!itemOld && !itemNew) { // should not happen
    logger.warn(`${key} neither new nor old item is set!`);
    return;
  }
  if (!itemOld) { // a new item
    logger.info(`new ${key}`);
    return;
  }
  // a changed item
  let changed = false;
  Object.keys(itemOld).map(prop => {
    if (!['__v', '_id', 'provider', 'region', 'id', 'dateCreated', 'dateUpdated', /*'wasNew', 'wasModified'*//*'services', 'adUrlReferences', 'spokenLanguages', 'images', 'comments'*/].includes(prop)) {
      //logger.debug(`--- ${prop} ---`);
      const type = Array.isArray(itemOld[prop]) ? 'array' : typeof itemOld[prop];
//logger.debug(`typeof itemOld[${prop}]: ${type}`);
      switch (type) {
        case 'boolean':
          //logger.warn(itemNew[prop]);
          if (itemOld[prop] != itemNew[prop]) {
            logger.info(`${key} changed ${prop}: ${itemNew[prop] ? 'false => true' : 'true => false'}`);
            changed = true;
          }
          break;
        case 'string':
        case 'number':
          if (itemOld[prop] !== itemNew[prop]) {
            require('colors');
            const diff = require('diff');
            const differences = diff.diffChars(itemOld[prop], itemNew[prop]);
            let difference = '';
            differences.forEach((part) => {
              // green for additions, red for deletionn, grey for common parts
              const color = part.added ? 'bgGreen' :
                part.removed ? 'bgRed' :
                'grey'
              ;
              difference += part.value[color];
            });
            logger.info(`${key} changed ${prop}: ${difference}`);

            // logger.info(`${key} changed ${prop}: ${itemOld[prop]} => ${itemNew[prop]}`);

            changed = true;
          }
          break;
        case 'array': // we assume one level only arrays (shallow compare)
//if(prop !== 'comments') break;
//console.log('PROP:', prop);
          const o = itemOld[prop];
          const n = itemNew[prop];

          // check for removed elements in array
          const removed = [];
//console.log('COMMENTS old length:', o.length);
          for (var oi = 0; oi < o.length; oi++) {
            const oObj = o[oi];
            let found = false;
            for (var ni = 0; ni < n.length; ni++) {
              const nObj = n[ni];
//console.log('COMPARING:', nObj, oObj);
              if (areEquivalent(nObj, oObj, ['_id'])) {
                found = true;
                break;
              }
            }
            if (!found) { // this old item was not found or was different in new items
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
              if (areEquivalent(oObj, nObj, ['_id'])) {
                found = true;
                break;
              }
            }
            if (!found) { // this new item was not found or was different in old items
              added.push(nObj);
            }
          }
          if (added.length) {
            logger.info(`${key} added ${added.length} ${prop}: ${JSON.stringify(added)}`);
            changed = true;
          }

          break;
        case 'object': // we assume one level only objects (shallow compare)
          // if (prop == 'comments') {
          //   logger.warn(`itemOld[${prop}]: ` + JSON.stringify(itemOld[prop]));
          //   logger.warn(`itemNew[${prop}]: ` + JSON.stringify(itemNew[prop]));
          // }          
          break;
          // if (!itemOld[prop] || !itemNew[prop] || itemOld[prop].length != itemNew[prop].length) {
          //   changed = true;
          //   logger.debug(`${key} ${itemNew.title} changed prop ${prop} length`)
          // }
          // break;
        default:
          logger.warn(`${prop}: type ${type} diff is not yet implemented`);
          break;
      }
    }
  });
  if (!changed) {
    logger.info(`${key} unchanged`)
  }
}

const areEquivalent = (a, b, ignoredProps) => {
  // create arrays of property names
  var aProps = Object.getOwnPropertyNames(a);
  var bProps = Object.getOwnPropertyNames(b);

  // if number of properties is different, objects are not equivalent
  if (aProps.length != bProps.length) {
    return false;
  }

  for (var i = 0; i < aProps.length; i++) {
    var propName = aProps[i];

    // if values of same property are not equal, objects are not equivalent
    if (!ignoredProps.includes(propName) && (a[propName] !== b[propName])) {
      return false;
    }
  }

  // if we made it this far, objects are considered equivalent
  return true;
}

const updateItem_UNUSED_SINCE_PRE_UPDATE_HAS_NO_ACCESS_TO_OLD_DOC = async(item) => {
  try {
    const Items = require("../models/Items" + "." + item.type);
//logger.info(`saveItem ${item.id}, ${item.provider}, ${item.region}, ${item.title}`);
logger.info(`saveItem ${item}`);
    const retval = await Items.updateOne(
      { id: item.id, provider: item.provider, region: item.region },
      { ...item, __v: 0 },
      { upsert: true, /*new: true,*/ },
    ).exec();
    logger.info(`saveItem retval: ` + JSON.stringify(retval));
    logger.info(`saveItem updateOne nModified: ${retval.nModified}`);
    return retval; 
  } catch (err) {
    throw (`error saving item: ${err}`);
  }
}

const saveItemImage = async(item, imageDownloaded) => {
  delete imageDownloaded.success;
  //logger.debug('saveItemImage - imageDownloaded:', imageDownloaded);
  try {
    const Items = require("../models/Items" + "." + item.type);
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
    throw (`error saving item image: ${err}`);
  }
}

updateUserStatus = async (user) => { // TODO: DEBUG ME !
  try {
    const UserStatuses = require("./models/UserStatuses");
    const Items = require("../models/Items");
logger.debug('updateUserStatus started for user:', user.name, user.role);
    const items = await Items.find({}).exec();

    const userStatus = new UserStatuses({user: user._id});
logger.debug('userStatus:', userStatus);
    items.map(item => {
      userStatus.update();
    });
return userStatus;
  } catch(err) {
    throw(`error updating user status: ${err}`);
  }
}

updateUserProps = async (user, item, props) => { // TODO: DEBUG ME !
  logger.debug('updateUserProps started for user:', user);
  logger.debug('updateUserProps started for user:', item);
  logger.debug('updateUserProps started for user:', props);
  process.exit();
  try {
    const UserStatuses = require("./models/UserStatuses");
    const Items = require("../models/Items");

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
    throw(`error updating user props: ${err.message}`);
  }
}

scrapeSchedule = async(providers, region, user) => {
  try {
    cron.schedule(config.schedule, () => {
      logger.debug('running on', new Date().toUTCString());
      const result = scrapeProviders(providers, region, user);
    });
  } catch(err) {
    throw(`error scheduling scraping ${err}`);
  }
}

// const _register = async (email, password, name, phone, role) => {
//   try {
//     console.info('register:', await register(email, password, name, phone, role));
//   } catch(err) {
//     throw(`error registering user: ${err}`);
//   }
// }

// const _login = async (email, password) => {
//   try {
//     console.info('login:', await login(email, password));
//   } catch(err) {
//     throw(`error logging user: ${err}`);
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
    throw(`error updating user status: ${err}`);
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