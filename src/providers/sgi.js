const info = {
  key: "sgi",
  type: "persons",
  url: "https://sexyguidaitalia.com/",
  regions: {
    "italy.torino": {
      listUrl: "https://sexyguidaitalia.com/escort/torino/",
      itemUrl: "https://sexyguidaitalia.com/escort/",
      imagesUrl: "https://sexyguidaitalia.com/",
    },
    "italy.milano": {
      listUrl: "https://sexyguidaitalia.com/escort/milano/",
      itemUrl: "https://sexyguidaitalia.com/escort/",
      imagesUrl: "https://sexyguidaitalia.com/",
    },
  },
  currency: "€", // TODO: put inside country...
  mediumPricePerHalfHour: 70,
  mediumPricePerHour: 120,
  immutable: false,
  //disableScraping: true,
};

const logger = require('../logger');

async function listPageEvaluate(region, page) {
  return new Promise(async (resolve, reject) => {
    const url = info.regions[region].listUrl;
    const imagesUrl = info.regions[region].imagesUrl;
    if (!url) {
      throw(`region ${region} for provider ${info.key} has no list url`);
    }
    logger.info(`listPageEvaluate.provider.${info.key} ${url}`);

    try {
      await page.goto(url);
    } catch (err) {
      return reject(err.message);
    }
    try {
      const items = await page.evaluate(async (info, url, imagesUrl, region) => {
        const list = [];
        document.querySelectorAll("div#content_tableTop a, div#content_tableFoto a, div#content_tableOff a").forEach(item => {
          const data = {};
          data.provider = info.key;
          data.region = region;
          data.type = info.type;
          //data.missing = false;
          data.immutable = info.immutable;
          data.images = [];

          try { // url
            data.url = item.getAttribute("href");
          } catch (err) {
            throw(new Error(`reading url ${url} looking for url: ${err.message}`));
          }

          try { // id
            data.id = data.url.replace(/annuncio\//s, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for id: ${err.message}`));
          }

          try { // title
            const titleElement = item.querySelector("span#content_nome, span.testo_generale_bold");
            if (titleElement) {
              data.title = titleElement.innerText.replace(/_+/g, ' ').replace(/^\s+|\s+$/g, '');
              data.title = decodeURIComponent(data.title);
              data.title = data.title.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // uppercase words
            } else {
              logger.warn(`no title for provider {$data.provider}, id: {$data.id}, url: ${$data.url}`);
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for title: ${err.message}`));
          }

          try { // main image
            const imgElement = item.querySelector("img.rollover");
            if (imgElement) {
              let imageUrl = imgElement.getAttribute("src").replace(/^\//, '').replace(/\?.*/, '');
              const image = { url: imageUrl, category: "main" };
              data.images.push(image);
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for main image: ${err.message}`));
          }

          try { // on holiday
            data.onHoliday = !!item.querySelector("span.vacanza");
            if (data.onHoliday) {
              delete data.phone; // avoid returning a phone of a missing person (to avoid overwriting old value, possibly a better one)
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for title: ${err.message}`));
          }

          list.push(data);
        });
        return list;
      }, info, url, imagesUrl, region);
      return resolve(items);
    } catch (err) {
      return reject(err);
    }
  })
}

const itemPageEvaluate = async (region, page, item) => {
  return new Promise(async (resolve, reject) => {
    const baseUrl = info.regions[region].itemUrl;
    const itemUrl = item.url;
    if (!baseUrl || !itemUrl) {
      throw(`url not defined for provider ${info.key} at region region ${region}`);
    }
    const url = baseUrl + itemUrl;
    logger.info(`itemPageEvaluate.provider.${info.key} ${url}`);
    try {
      await page.goto(url);
    } catch (err) {
      return reject(err);
    }
    try {
      const itemFull = await page.evaluate(async (info, url, item) => {
        const data = item;

        try { // subtitle
          data.subtitle = document.querySelector("span#content_nome").innerText.replace(/^\s+|\s+$/g, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for title: ${err.message}`));
        }

        try { // subtitle
          data.phone = document.querySelector("span#content_tel").innerText.replace(/^\s+|\s+$/g, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for phone: ${err.message}`));
        }

        try { // subtitle
          const descriptionElement = document.querySelector("span#content_annuncio");
          if (descriptionElement) {
            data.description = descriptionElement.innerText.replace(/^\s+|\s+$/g, '');
          }
        } catch (err) {
          throw(new Error(`reading url ${url} looking for description: ${err.message}`));
        }

        // try { // imageUrls
        //   data.imageUrls = [];
        //   document.querySelector("ul#content_immagini").querySelectorAll("a").forEach(image => {
        //     data.imageUrls.push(info.url + image.getAttribute("href").replace(/^\//, '').replace(/\?.*/, ''));
        //   });
        // } catch (err) {
        //   throw(new Error(`reading url ${url} looking for imageUrl: ${err.message}`));
        // }
//logger.info('trying small images for', JSON.stringify(item));
        imagesElement = document.querySelector("ul#content_immagini");

//         try { // small images
//           imagesElement.querySelectorAll("li > a > img").forEach(imgElement => {
//             if (imgElement) {
//               let imageUrl = imgElement.getAttribute("src").replace(/\?.*/, '').replace(/^\//, '');
//               const image = { url: imageUrl, category: "small" };
// //logger.info('pushing small image for', JSON.stringify(image));
//               data.images.push(image);
//             }
// //else logger.info('no small image for', JSON.stringify(item));
//           });
//         } catch (err) {
//           throw (new Error(`reading url ${url} looking for small images: ${err.message}`));
//         }

        try { // full images
          imagesElement.querySelectorAll("li > a").forEach(imgElement => {
            if (imgElement) {
              let imageUrl = imgElement.getAttribute("href").replace(/\?.*/, '').replace(/^\//, '');
              const image = { url: imageUrl, category: "full"};
//logger.info('pushing small image for', JSON.stringify(image));
              data.images.push(image);
            }
//else logger.info('no full image for', JSON.stringify(item));
          });
        } catch (err) {
          throw (new Error(`reading url ${url} looking for full images: ${err.message}`));
        }

        try { // address
          data.address = document.querySelector("span#content_quartiere").innerText.replace(/^\s+|\s+$/g, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for address: ${err.message}`));
        }

        try { // sexualOrientation
          data.sexualOrientation = document.querySelector("span#content_sesso").innerText.replace(/^\s+|\s+$/g, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for sexualOrientation: ${err.message}`));
        }

        try { // comments
          const authors = [];
          const texts = [];
          const dates = [];
          document.querySelector("div#content_tabs1").querySelectorAll("li.cellaScheda").forEach((item, i) => {
            if (item.className.split(/\s+/).includes("commentiUtente")) {
              authors.push(item.innerText.replace(/^\s+|\s+$/g, ''));
            } else {
              dates.push(dateSlashed2Date(item.innerText.replace(/^\s+|\s+$/g, '')));
            }
          });
          document.querySelector("div#content_tabs1").querySelectorAll('li[style*="clear: both;"]').forEach((text, i) => {
            texts.push(text.innerText.replace(/^\s+|\s+$/g, ''));
          });
          const commentsList = [];
          for (let i = 0; i < authors.length; i++) {
            commentsList.push({
              author: authors[i] ? authors[i] : null,
              text: texts[i] ? texts[i] : null,
              date: dates[i] ? dates[i] : null,
            });
          }
          data.comments = commentsList;
        } catch (err) {
          throw(new Error(`reading url ${url} looking for comments: ${err.message}`));
        }
  
        return data;
  
        function dateSlashed2Date(str) {
          if (!str || str === 'n.d.') {
            return null;
          }
          const [ day, month, year ] = str.split('/');
          return `${year}-${month}-${day}`;
        }
          
      }, info, url, item);
      return resolve(itemFull);
    } catch (err) {
      return reject(err);
    }
  })
}

module.exports = {
  info,
  listPageEvaluate,
  itemPageEvaluate,
};