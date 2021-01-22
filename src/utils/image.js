const Jimp = require("jimp");
const ImagePHash = require("./modules/phash");

/**
 * Calculates the perceptual hash of an image
 * @param {string} imagePath an image path to calculate the perceptual hash
 * @returns {string} the perceptual hash of the image
 */
exports.getPHash = async (imagePath) => {
  const img = await Jimp.read(imagePath);
  const phash = new ImagePHash();
  return phash.getHash(img);
}

/**
 * Checks if two pre-computed perceptual hashes of images are "equal"
 * @param {string} phash1 a phash to compare
 * @param {string} phash2 a phash to compare
 * @param {number} threshold the threshold under which the phashes are considered "equal" { default: 0.25 }
 * @returns {boolean} a boolean value, true means they are considered equal
 */
exports.phashesAreEqual = (phash1, phash2, threshold = 0.25) => {
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
    return new Error('threshold must be a number between 0 and 1');
  }
  const phash = new ImagePHash();
  const distance = phash.distance(phash1, phash2);
  console.log(`perceptual distance: ${distance}`);
  if (distance < threshold) { // phashes match
    return true;
  }
  // phashes do not match
  return false;
}



(async() => {
  const phash1 = await exports.getPHash("./img1.jpg");
  const phash2 = await exports.getPHash("./img1-bordered.jpg");
  const result = exports.phashesAreEqual(phash1, phash2);
  console.log(`images 1 and 2 are considered ${result ? 'equal' : 'different'}`);
})();