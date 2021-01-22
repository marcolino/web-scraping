// This is too simplistic, don't use...
const imghash = require('imghash');
const leven = require('leven');

let hrstart = hrend = null;

hrstart = process.hrtime();
const hash1 = imghash.hash('./img1.jpg');
hrend = process.hrtime(hrstart); console.log(`imghash.hash() execution time (hr): ${hrend[1] / 1000000} ms`);
const hash2 = imghash.hash('./img1-with-text.jpg');

Promise
  .all([hash1, hash2])
  .then((results) => {
    console.log(`leven 1 is: ${results[0].length}`);
    console.log(`leven 2 is: ${results[1].length}`);
    const dist = leven(results[0], results[1]);
    console.log(`Distance between images is: ${dist}`);
    if (dist <= 12) {
      console.log('Images are similar');
    } else {
      console.log('Images are NOT similar');
    }
  })
;