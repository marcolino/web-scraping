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
};

const config = require('../config');
//const logger = require('../logger');

async function listPageEvaluate(region, page) {
  return new Promise(async (resolve, reject) => {
    const url = info.regions[region].listUrl;
    const imagesUrl = info.regions[region].imagesUrl;
    if (!url) {
      throw (new Error(`region ${region} for provider ${info.key} has no list url`));
    }
    //logger.info(`listPageEvaluate.provider.${info.key} ${url}`);

    try {
      await page.goto(url);
    } catch (err) {
      return reject(err.message);
    }
    try {
      const items = await page.evaluate(async (config, info, url, imagesUrl, region) => {
        const list = [];
        //document.querySelectorAll("div#content_tableTop a, div#content_tableFoto a, div#content_tableOff a").forEach(item => {
        const listElement = document.querySelectorAll("article.portfolio-item");
        // TODO: warn in parent if 0 items returned (and warn if some data.warnings are set)
        // if (!listElement.length) {
        //   throw(new Error(`list element not matched!`));
        // }
        listElement.forEach(item => {
          const data = {};
          data.warnings = {};
          data.provider = info.key;
          data.region = region;
          //data.type = info.type;
          //data.missing = false;
          //data.immutable = info.immutable;
          data.images = [];

          try { // url
            //data.url = item.getAttribute("href");
            data.url = item.querySelector("h3.provenienza > a:first-child").getAttribute("href").replace(/^\/escort\//, '');
            if (!data.url) data.warnings.url = false;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for url: ${err.message}`));
          }
          try { // id
            data.id = data.url.replace(/annuncio\//s, '');
            if (!data.id) data.warnings.id = false;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for id: ${err.message}`));
          }
          if (config.scrape.onlyItemId.length && !config.scrape.onlyItemId.includes(data.id)) {
            //console.log('BREAK DUE TO scrape.onlyItemId');
            return;
          }

          try { // title
            const titleElement = item.querySelector("div.listing-title > a:first-child");
            if (titleElement) {
              data.title = titleElement.innerText.replace(/_+/g, ' ').replace(/^\s+|\s+$/g, '');
              data.title = decodeURIComponent(data.title);
              data.title = data.title.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // uppercase words
              if (!data.title) data.warnings.title = false;
            } else {
              console.log(`no title for provider ${data.provider}, id: ${data.id}, url: ${$data.url}`);
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for title: ${err.message}`));
          }

          try { // main image
            let imageUrl = null;
            // try second child (video present)
            let imgElementParent = item.querySelector("div.portfolio-image.slider-gallery > a:nth-child(2)"); // we get the first image of the rollover
            if (imgElementParent) {
              const imgElement = imgElementParent.querySelector("img"); // we get the first image of the rollover
              imageUrl = imgElement.getAttribute("data-src");
              if (!imageUrl) {
                imageUrl = imgElement.getAttribute("src");
              }
//console.log('main imageUrl (yv):', imageUrl);
              imageUrl = imageUrl.replace(/^\//, '').replace(/\?.*/, '');
              const image = { url: imageUrl, category: "main" };
              data.images.push(image);
//console.log('SGI data.image si video:', imageUrl);
            } else { // try first child (no video present)
              let imgElementParent = item.querySelector("div.portfolio-image.slider-gallery > a:nth-child(1)"); // we get the first image of the rollover
              if (imgElementParent) {
                const imgElement = imgElementParent.querySelector("img"); // we get the first image of the rollover
                imageUrl = imgElement.getAttribute("data-src");
                if (!imageUrl) {
                  imageUrl = imgElement.getAttribute("src");
                }
//console.log('main imageUrl (nv):', imageUrl);
                imageUrl = imageUrl.replace(/^\//, '').replace(/\?.*/, '');
                const image = { url: imageUrl, category: "main" };
                data.images.push(image);
//console.log('SGI data.image no video:', imageUrl);
              }
            }
            if (!imageUrl) data.warnings.imageMain = false;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for main image: ${err.message} ${err.stack} ${item.querySelector("div.portfolio-image").innerHtml}`));
          }

          try { // on holiday
            data.onHoliday = !!item.querySelector("h3.nome.nome-off");
            if (data.onHoliday) {
              delete data.phone; // avoid returning a phone of a missing person (to avoid overwriting old value, possibly a better one)
            }
            if (typeof data.onHoliday === 'undefined') data.warnings.onHoliday = false;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for title: ${err.message}`));
          }
//console.log('SGI HOLIDAY:', data.onHoliday);

          list.push(data);
        });
//console.log('SGI LIST LEN:', list.length);
        return list;
      }, config, info, url, imagesUrl, region);
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
      throw (new Error(`url not defined for provider ${info.key} at region region ${region}`));
    }
    const url = baseUrl + itemUrl;
    //logger.info(`itemPageEvaluate.provider.${info.key} ${url}`);
    try {
      const response = await page.goto(url);
    } catch (err) {
      return reject(err);
    }
    try {
      const itemFull = await page.evaluate(async (info, url, item) => {
        const data = item;

        // try { // subtitle
        //   data.subtitle = document.querySelector("div#content").innerText.replace(/^\s+|\s+$/g, '');
        // } catch (err) {
        //   throw(new Error(`reading url ${url} looking for subtitle: ${err.message}`));
        // }

        // try { // subtitle
        //   data.phone = document.querySelector("span#content_tel").innerText.replace(/^\s+|\s+$/g, '');
        // } catch (err) {
        //   throw(new Error(`reading url ${url} looking for phone: ${err.message}`));
        // }

        try { // description
          const descriptionElement = document.querySelector("span#content_annuncioMobile");
          if (descriptionElement) {
            data.selfDescription = descriptionElement.innerText.replace(/^\s+|\s+$/g, '').replace(/\n+/g, '\n');
          }
          if (!data.selfDescription) data.warnings.selfDescription = false;
        } catch (err) {
          throw(new Error(`reading url ${url} looking for description: ${err.message}`));
        }

        imagesElement = document.querySelector("div#gallery-dettaglio");
        if (!imagesElement) {
          data.warnings.imagesFull = false;
        } else {
          try { // full images
            imagesElement.querySelectorAll("a[data-fancybox='gallery-item']").forEach(imgElement => {
              if (imgElement) {
                let imageUrl = imgElement.getAttribute("href").replace(/\?.*/, '').replace(/^\//, '');
                const image = { url: imageUrl, category: "full"};
                if (!data.images.find(img => img.url === image.url)) { // avoid saving duplicate image urls
                  data.images.push(image);
                }
              }
            });
            if (!data.images.length) data.warnings.imagesFull = false;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for full images: ${err.message}`));
          }
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
          const commentsElement = document.querySelector("ol.commentlist");
          if (!commentsElement) {
            data.warnings.comments = false;
          } else {
            data.comments = [];
            commentsElement.querySelectorAll("li.comment").forEach((comment) => {
              const author = comment.querySelector("div.comment-author").innerText.replace(/^\s+|\s+$/g, '');
//console.log('c author:', author);
              const date = comment.querySelector("div.review-comment-ratings").innerText.replace(/^\s+|\s+$/g, '');
//console.log('c date:', date);
              const text = comment.querySelector("p").innerText.replace(/^"|"+$/g, '').replace(/^\s+|\s+$/g, '');
//console.log('c text:', text);
              data.comments.push({author: author, date: dateSlashed2Date(date), text: text});
            });
//console.log('commentsList:', JSON.stringify(data.commentsList));
          }
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