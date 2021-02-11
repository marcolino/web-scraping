const Jimp = require("jimp");
const logger = require("../logger");
const ImagePHash = require("./modules/phash");

/**
 * Calculates the perceptual hash of an image
 * 
 * @param {string} imagePath an image path to calculate the perceptual hash
 * @returns {string} the perceptual hash of the image
 */
calculatePerceptualHash = async (imagePath) => {
  const img = await Jimp.read(imagePath);
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

module.exports = {
  calculatePerceptualHash,
  comparePerceptualHashes,
  perceptuallyEqual,
  perceptuallySimilar,
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