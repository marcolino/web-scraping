const info = {
  key: "mr",
  type: "persons",
  url: "https://www.moscarossa.biz/",
  regions: {
    "italy.torino": {
      listUrl: "https://www.moscarossa.biz/escort-torino-1.html",
      itemUrl: "https://www.moscarossa.biz/",
      imagesUrl: "https://foto.moscarossa.biz/",
    },
  },
  currency: "€", // TODO: put inside country...
  mediumPricePerHalfHour: 70,
  mediumPricePerHour: 120,
};

const config = require('../config');

async function listPageEvaluate(region, page) {
  return new Promise(async (resolve, reject) => {
    const url = info.regions[region].listUrl;
    const imagesUrl = info.regions[region].itemUrl; // this provider uses a cgi on itemUrl to provide images...
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
        const listElement = document.querySelectorAll("div.evidenzia_accompa_topg,div.evidenzia_accompa_topr,div.evidenzia_accompa_topgiallo,div.evidenzia_accompa_premium");
        if (listElement) {
          listElement.forEach(item => {
            const data = {};
            data.warnings = {};
            data.provider = info.key;
            data.region = region;
            //data.type = info.type;
            //data.missing = false;
            //data.immutable = info.immutable;
            data.onHoliday = false;
            data.images = [];
            
            try { // url
              data.url = item.querySelector("a").getAttribute("href");
            } catch (err) {
              throw(new Error(`reading url ${url} looking for url: ${err.message}`));
            }

            try { // id
              data.id = data.url.replace(/.*-(\d+)\.php$/, '$1');
            } catch (err) {
              throw(new Error(`reading url ${url} looking for id: ${err.message}`));
            }

            if (config.scrape.onlyItemId.length && !config.scrape.onlyItemId.includes(data.id)) {
              //console.log('BREAK DUE TO scrape.onlyItemId');
              return;
            }

            try { // main image
              const imgElement = item.querySelector("img.img_accompa_elenco_desktop");
              if (imgElement) {
                const hostRegexp = new RegExp('^' + imagesUrl);
                let imageUrl; // the first (8) images have "data-src" attribute, the following have "src" attribute
                imageUrl = imgElement.getAttribute("data-src").replace(hostRegexp, '').replace(/cdn-cgi\/image\/[^\/]*\/https?:\/\/.*?\//, '');
                if (!imageUrl) imageUrl = imgElement.getAttribute("src").replace(hostRegexp, '').replace(/cdn-cgi\/image\/[^\/]*\/https?:\/\/.*?\//, '');
                if (imageUrl) {
                  const image = { url: imageUrl, category: 'main' };
                  data.images.push(image);
                }
              }
            } catch (err) {
              throw(new Error(`reading url ${url} looking for main image: ${err.message}`));
            }

            try { // title
              const titleElement = item.querySelector("div.nome_accompa_elenco");
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
        }
//console.log('****** ', list.length);
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
    const imagesUrl = info.regions[region].itemUrl; // this provider uses a cgi on itemUrl to provide images...
    if (!baseUrl || !itemUrl) {
      throw (new Error(`url not defined for provider ${info.key} at region region ${region}`));
    }
    const url = baseUrl + itemUrl;

    try {
      let response = await page.goto(url, { waitUntil: 'networkidle0' }); // waitUntil: 'networkidle0' to load all scripts (we need it for address lat/lon)
      if (response.status() == 429) { // TODO: handle 429 status for all providers
        const retryAfter = parseInt(response.headers()['retry-after']);
        return resolve({retryAfter});
      }
    } catch (err) {
      return reject(err);
    }

    try {
      const itemFull = await page.evaluate(async (info, url, imagesUrl, item) => {
        const data = item;

        try { // subtitle
          data.subtitle = document.querySelector("h1.h1_home").innerText.replace(/^\s+|\s+$/g, '').replace(/^.*\n/, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for subtitle: ${err.message}`));
        }
        try { // phone
           const phoneElement = document.querySelector("a.testo_tel");
           if (phoneElement) {
             data.phone = phoneElement.getAttribute("href").replace(/^tel:\/\//, '').replace(/^\s+|\s+$/g, '');
           } else {
             data.warnings.phone = false;
             data.onHoliday = true;
           }
        } catch (err) {
          throw(new Error(`reading url ${url} looking for phone: ${err.message}`));
        }
//console.log('phone:', data.phone); return;
        
        try { // selfDescription
          data.selfDescription = document.querySelector("span#testo_annuncio").innerText.replace(/^\s+|\s+$/g, '').replace(/\n+/g, '\n');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for description: ${err.message}`));
        }
//console.log('selfDescription:', data.selfDescription); return;
        
        try { // full images
          document.querySelectorAll("img.img_annuncio").forEach(imgElement => {
            if (imgElement) {
//console.log('imageUrl:', imgElement);
              const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.getAttribute("data-src").replace(hostRegexp, '').replace(/cdn-cgi\/image\/[^\/]*\/https?:\/\/.*?\//, '');
              const image = { url: imageUrl, category: 'full' };
              data.images.push(image);
            }
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for full images: ${err.message}`));
        }

        try { // address coordinates
          const latlonElement = document.querySelector("span#button_vedi_mappa");
          if (latlonElement) { // a map is present
            const latlon = latlonElement.getAttribute("onclick").replace(/^vedi_punto_osm\((.*?), (.*?)\).*/, '$1,$2');
            data.addressCoordinates = latlon.split(',');
          }
        } catch (err) {
          throw(new Error(`reading url ${url} looking for address: ${err.message}`));
        }

        try { // info
          let matches = {};
          document.querySelectorAll("table.table.table-condensed.testo_base tr").forEach(item => {
            const el = item.innerText;
            matches = el.match(/^\s*Città\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.address = matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Dettaglio zona\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.address += (data.address ? ', ' : '') + matches[1].replace(/^\s+|\s+$/g, '');
            matches = el.match(/^\s*Categoria\s*(.*)\s*/i);
            if (matches && matches.length > 0) data.sexualOrientation = matches[1].replace(/^\s+|\s+$/g, '');
            switch (data.sexualOrientation) {
              case "donne": data.sexualOrientation = "F"; break;
              case "boy": data.sexualOrientation = "M"; break;
              case "transessuali": data.sexualOrientation = "TX"; break;
              default: break; // keep value found...
            }
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for info 1: ${err.message}`));
        }
        
        return data; 
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