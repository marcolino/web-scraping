const Jimp = require('jimp');
var fs = require('fs');
var path = require('path');
const ImagePHash = require('./modules/phash');
const { dumperr } = require('../utils/misc');
const config = require ('../config');

/**
 * Calculates the perceptual hash of an image
 * 
 * @param {string} imagePath an image path to calculate the perceptual hash
 * @returns {string} the perceptual hash of the image
 */
calculatePerceptualHash = async (imagePath, imageFile) => {
  const img = await Jimp.read(`${imagePath}/${imageFile}`);
  if (typeof calculatePerceptualHash.phash === 'undefined') { // first time
    calculatePerceptualHash.phash = new ImagePHash(); // initialize static class variable
  }
  return calculatePerceptualHash.phash.getHash(img);
}

/**
 * Checks if two pre-computed perceptual hashes of images are considered equal
 * 
 * @param {string} phash1      a phash to compare
 * @param {string} phash2      a phash to compare
 * @param {number} threshold   the threshold under which the phashes are considered "equal" { default: 0.25 }
 * @returns {boolean}          true means they are considered equal
 */
comparePerceptualHashes = (phash1, phash2, threshold = 0.20) => {
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
    return new Error('threshold must be a number between 0 and 1');
  }
  if (typeof comparePerceptualHashes.phash === 'undefined') { // first time
    comparePerceptualHashes.phash = new ImagePHash(); // initialize static class variable
  }
  const distance = comparePerceptualHashes.phash.distance(phash1, phash2);
  //console.log(`perceptual distance: ${distance}`);
  if (distance < threshold) { // phashes match
    return true;
  }
  // phashes do not match
  return false;
}

/**
 * Checks if two pre-computed perceptual hashes of images are considered equal (threshold: 0.02)
 * 
 * @param {string} phash1      a phash to compare
 * @param {string} phash2      a phash to compare
 * @returns {boolean}          true means they are considered equal
 */
perceptuallyEqual = (phash1, phash2) => {
  return comparePerceptualHashes(phash1, phash2, 0.02);
}

/**
 * Checks if two pre-computed perceptual hashes of images are considered similar (threshold: 0.20)
 * 
 * @param {string} phash1      a phash to compare
 * @param {string} phash2      a phash to compare
 * @returns {boolean}          true means they are considered similar
 */
perceptuallySimilar = (phash1, phash2) => {
  return comparePerceptualHashes(phash1, phash2, 0.20);
}

/**
 * Resizes an image by the requested size and with the requested quality,
 * and saves it with a name containing the requested size
 */
imageResize = (imagePath, imageFile, size = config.images.size, quality = config.images.quality) => {
  Jimp.read(`${imagePath}/${imageFile}`, (err, img) => {
    if (err) throw(new Error(`error reasding image to resize: ${dumperr(err)}`));
    const imgWidth = img.bitmap.width; // width of the image read
    const imgHeight = img.bitmap.height; // height of the image read
    const w = typeof size.width === 'number' ? size.width : Jimp.AUTO;
    const h = typeof size.height === 'number' ? size.height : Jimp.AUTO;
    const sizeFolderName =
      (typeof size.width === 'number' && typeof size.height === 'number' ? '' : typeof size.width === 'number' ? 'w' : '') +
      (typeof size.width === 'number' ? size.width : '') +
      (typeof size.width === 'number' && typeof size.height === 'number' ? 'x' : typeof size.height === 'number' ? 'h' : '') +
      (typeof size.height === 'number' ? size.height : '')
    ;
    const outputPath =
      imagePath +
      '/' +
      sizeFolderName
    ;
    try {
      if (
        (typeof size.width === 'number' && imgWidth <= size.width) ||
        (typeof size.height === 'number' && imgHeight <= size.height)
      ) { // do not resize images which are already smaller than the requested size
        //console.log(`images.imageResize: ${imagePath}/${imageFile} - avoid image resize because already smaller then requested size, just copy to destination`);
        fs.copyFile(`${imagePath}/${imageFile}`, `${outputPath}/${imageFile}`, err => { if (err) throw err});
      } else { // image is bigger than size, resize it
        fs.mkdirSync(outputPath, { recursive: true }); // be sure folder exists
        img
          .resize(w, h)
          .quality(quality)
          .write(`${outputPath}/${imageFile}`);
        ;
      }
    } catch (err) {
      throw(new Error(`error resizing image to ${outputPath}/${imageFile}: ${dumperr(err)}`));
    }
  });
}

module.exports = {
  calculatePerceptualHash,
  comparePerceptualHashes,
  perceptuallyEqual,
  perceptuallySimilar,
  imageResize,
};



///////////////////////////////////////////////////////////////////////////////////////
// main - debug only
//
// (async() => {
//   const phash1 = await exports.calculatePerceptualHash("./img1.jpg");
//   const phash2 = await exports.calculatePerceptualHash("./img1-bordered.jpg");
//   const result = exports.comparePerceptualHashes(phash1, phash2);
//   console.log(`images 1 and 2 are considered ${result ? 'equal' : 'different'}`);
// })();
///////////////////////////////////////////////////////////////////////////////////////