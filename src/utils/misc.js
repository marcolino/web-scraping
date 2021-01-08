exports.clone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
}

// exports.delay = async(t) => {
//   return await new Promise(resolve => setTimeout(resolve, t));
// }

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