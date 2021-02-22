/**
 * clones an object (deep)
 */
 exports.clone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
}

// exports.delay = async(t) => {
//   return await new Promise(resolve => setTimeout(resolve, t));
// }

/**
 * detects te mime type of an image
 */
exports.mimeImage = (mime) => {
  mimeImages = [
    'image/bmp',
    'image/cis-cod',
    'image/gif',
    'image/ief',
    'image/jpeg',
    'image/jpeg',
    'image/pipeg',
    'image/png',
    'image/svg+xml',
    'image/tiff',
    'image/tiff',
    'image/x-cmu-raster',
    'image/x-cmx',
    'image/x-icon',
    'image/x-portable-anymap',
    'image/x-portable-bitmap',
    'image/x-portable-graymap',
    'image/x-portable-pixmap',
    'image/x-rgb',
    'image/x-xbitmap',
    'image/x-xpixmap',
    'image/x-xwindowdump',
  ];
  return mimeImages.includes(mime);
}

/**
 * dump an error according to environment
 */
exports.dumperr = (error) => {
  if (process.env.NODE_ENV === "production") {
    return error.message; // hide stack in production
  } else {
    return error.message + "\n" + error.stack;
  }
}

/**
 * Provides a natural language (fuzzy) representation of a time distance since now
 * Currently it works for past only and is localized for Italian only.
 */
exports.fuzzyTimeDistanceFromNow = (date) => {
  const delta = Math.round((+new Date - date) / 1000);

  const
    minute = 60,
    hour = minute * 60,
    day = hour * 24,
    //week = day * 7,
    month = day * 30,
    year = day * 365
  ;

  let fuzzy;
  if (delta < 30) {
    fuzzy = `proprio adesso`;
  } else if (delta < minute) {
    fuzzy = `${delta} secondi fa`;
  } else if (delta < 2 * minute) {
    fuzzy = `un minuto fa`;
  } else if (delta < hour) {
    fuzzy = `${Math.floor(delta / minute)} minuti fa`
  } else if (Math.floor(delta / hour) == 1) {
    fuzzy = `un'ora fa`;
  } else if (delta < day) {
    fuzzy = `${Math.floor(delta / hour)} ore fa`;
  } else if (delta < day * 2) {
    fuzzy = `ieri`;
  } else if (delta < month) {
    fuzzy = `${Math.floor(delta / day)} giorni fa`;
  } else if (delta < year) {
    fuzzy = `${Math.floor(delta / month)} mesi fa`;
  } else { // more than a year
    const years = Math.floor(delta / year);
    const months = Math.floor((delta - years) / month);
    fuzzy = `${years} anni e ${months} mesi fa`;
  }
  return fuzzy;
}

/**
 * Returns an array with all providers information
 */
exports.getProviders = () => {
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

/**
 * Sleep for a number of milliseconds
 */
exports.sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Check if two arrays of objects are equal
 */
exports.objectsEqual = (o1, o2) => {
  Object.keys(o1).length === Object.keys(o2).length 
    && Object.keys(o1).every(p => o1[p] === o2[p])
  ;
}
