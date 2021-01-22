const Jimp = require("jimp");
const logger = require("../logger");
const ImagePHash = require("./modules/phash");

/**
 * Calculates the perceptual hash of an image
 * 
 * @param {string} imagePath an image path to calculate the perceptual hash
 * @returns {string} the perceptual hash of the image
 */
calculatePHash = async (imagePath) => {
  const img = await Jimp.read(imagePath);
  if (typeof calculatePHash.phash === 'undefined') { // first time
    calculatePHash.phash = new ImagePHash(); // initialize static class variable
  }
  return calculatePHash.phash.getHash(img);
}

/**
 * Checks if two pre-computed perceptual hashes of images are considered equal
 * 
 * @param {string} phash1      a phash to compare
 * @param {string} phash2      a phash to compare
 * @param {number} threshold   the threshold under which the phashes are considered "equal" { default: 0.25 }
 * @returns {boolean}          true means they are considered equal
 */
comparePHashes = (phash1, phash2, threshold = 0.20) => {
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
    return new Error('threshold must be a number between 0 and 1');
  }
  if (typeof comparePHashes.phash === 'undefined') { // first time
    comparePHashes.phash = new ImagePHash(); // initialize static class variable
  }
  const distance = comparePHashes.phash.distance(phash1, phash2);
  //console.log(`perceptual distance: ${distance}`);
  if (distance < threshold) { // phashes match
    return true;
  }
  // phashes do not match
  return false;
}

module.exports = {
  calculatePHash,
  comparePHashes,
};



///////////////////////////////////////////////////////////////////////////////////////
// main - debug only
//
// (async() => {
//   const phash1 = await exports.calculatePHash("./img1.jpg");
//   const phash2 = await exports.calculatePHash("./img1-bordered.jpg");
//   const result = exports.comparePHashes(phash1, phash2);
//   console.log(`images 1 and 2 are considered ${result ? 'equal' : 'different'}`);
// })();
///////////////////////////////////////////////////////////////////////////////////////