const info = {
  key: "toe",
  type: "persons",
  url: "https://www.torinoerotica.com/",
  regions: {
    "italy.torino": {
      listUrl: "https://www.torinoerotica.com/annunci-escort-torino/",
      itemUrl: "https://www.torinoerotica.com/",
      imagesUrl: "https://www.torinoerotica.com/",
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
    try {
      await page.goto(url);
    } catch (err) {
      return reject(err.message);
    }
    try {
      const items = await page.evaluate(async (config, info, url, imagesUrl, region) => {
        const list = [];
        document.querySelectorAll("div.escorts-col").forEach(item => {
          const data = {};
          data.provider = info.key;
          data.region = region;
          //data.type = info.type;
          //data.missing = false;
          //data.immutable = info.immutable;
          data.onHoliday = false;
          data.images = [];
          
          try { // url
            //data.url = item.querySelector("a.icon-zoom1move").getAttribute("href").replace(/^\.\/.\/annuncio\?id=/, '').replace(/^.\//, '');
            data.url = item.querySelector("a:first-child").getAttribute("href").replace(/^.\//, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for url: ${err.message}`));
          }

          try { // id
            data.id = data.url.replace(/^annuncio\?id=/, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for id: ${err.message}`));
          }

          if (config.scrape.onlyItemId.length && !config.scrape.onlyItemId.includes(data.id)) {
            //console.log('BREAK DUE TO scrape.onlyItemId');
            return;
          }

          try { // main image
            const imgElement = item.querySelector("img");
            if (imgElement) {
              const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.getAttribute("src").replace(/^\//, '').replace(/\?.*/, '').replace(hostRegexp, '');
              const image = { url: imageUrl, category: 'main' };
              data.images.push(image);
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for main image: ${err.message}`));
          }

          try { // title
            const titleElement = item.querySelector("h3.h6");
            if (titleElement) {
              data.title = titleElement.innerText.replace(/_+/g, ' ').replace(/^\s+|\s+$/g, '');
              data.title = decodeURIComponent(data.title);
              data.title = data.title.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // uppercase words
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for title: ${err.message}`));
          }

          if (data.title) { // a real element
            list.push(data);
          }
        });
        return list;
      }, config,  info, url, imagesUrl, region);
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
    const imagesUrl = info.regions[region].imagesUrl;
    if (!baseUrl || !itemUrl) {
      throw (new Error(`url not defined for provider ${info.key} at region region ${region}`));
    }
    const url = baseUrl + itemUrl;

    try {
      const response = await page.goto(url);
    } catch (err) {
      return reject(err);
    }
    try {
      const itemFull = await page.evaluate(async (info, url, imagesUrl, item) => {
        const data = item;

        try { // subtitle
          data.subtitle = document.querySelector("span.h5").innerText.replace(/^\s+|\s+$/g, '').replace(/^.*\n/, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for title: ${err.message}`));
        }

        try { // phone
          data.phone = document.querySelector("span[title^='Telefono']").innerText.replace(/^\s+|\s+$/g, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for phone: ${err.message}`));
        }

        try { // selfDescription
          data.selfDescription = document.querySelector("div.annuncio-box > p").innerText.replace(/^\s+|\s+$/g, '').replace(/\n+/g, '\n');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for description: ${err.message}`));
        }

        // this provider use the same copy of the images for both small and full versions
        // try { // small images
        //   document.querySelectorAll("div.gallery > div > a > img").forEach(imgElement => {
        //     if (imgElement) {
        //       //const hostRegexp = new RegExp('^' + imagesUrl);
        //       let imageUrl = imgElement.getAttribute("src"); //.replace(/^\//, '').replace(hostRegexp, '');
        //       const image = { url: imageUrl, category: 'small' };
        //       data.images.push(image);
        //     }
        //   });
        // } catch (err) {
        //   throw(new Error(`reading url ${url} looking for small images: ${err.message}`));
        // }

        try { // full images
          document.querySelectorAll("div.gallery.row.no-gutters.d-none > div > a").forEach(imgElement => {
            if (imgElement) {
              //const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.getAttribute("href").replace(/\?.*/, ''); //.replace(/^\//, '').replace(hostRegexp, '');
              const image = { url: imageUrl, category: 'full' };
              data.images.push(image);
            }
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for small images: ${err.message}`));
        }

//         try { // address
//           data.address = document.querySelector("a[id='bt-mappa']").innerText.replace(/^\s+|\s+$/g, '').replace(/^Mappa/, '').replace(/[(]/, '').replace(/[)]/, '').replace(/^\s+|\s+$/g, '');
//         } catch (err) {s
//           throw(new Error(`reading url ${url} looking for address: ${err.message}`));
//         }

        try { // info 1
          let matches = {};
          document.querySelectorAll("li.list-group-item.bg-transparent").forEach(item => {
            const el = item.innerText;
            matches = el.match(/^\s*Categoria\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.sexualOrientation = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Eta\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.age = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Location\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.address = matches[1].replace(/^\s+|\s+$/g, '');
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for info 1: ${err.message}`));
        }

        try { // info 2
          let matches = {};
          document.querySelectorAll("div.annuncio-box > ul > li").forEach(item => {
            const el = item.innerText;
            matches = el.match(/^\s*Orientamento:\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.sexualOrientation = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Altezza:\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.height = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Peso:\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.weight = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Scarpe:\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.shoeSize = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Taglia:\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.dressSize = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Etnia:\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.nationality = matches[1].replace(/^\s+|\s+$/g, '');
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for info 2: ${err.message}`));
        }

        try { // comments
          const commentsList = [];
          const commentsElement = document.querySelector("div.comment-people");
          commentsElement.querySelectorAll("div.contents:not([id='response-comment'])").forEach(commentElement => {
            let c = {};
            c.author = commentElement.querySelector("div.text > h6").innerText.replace(/^@/, '');
            c.date = datetimeSlashed2Date(commentElement.querySelector("p.date").innerText);
            c.text = commentElement.querySelector("p:not([class='date'])").innerText.replace(/^\s+|\s+$/g, '').replace(/\n+/g, '\n');
            commentsList.push(c);
          });
          data.comments = commentsList;
        } catch (err) {
          throw(new Error(`reading url ${url} looking for comments: ${err.message}`));
        }
        
        return data;
  
        function datetimeSlashed2Date(str) {
          if (!str || str === 'n.d.') {
            return null;
          }
          const [ date, time ] = str.split(' ');
          const [ day, month, year ] = date.split('/');
          const d = new Date(`${year}-${month}-${day} ${time}`);
          return d.toISOString();
          //return `${year}-${month}-${day} ${time}`;
        }
      }, info, url, imagesUrl, item);
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