const info = {
  key: "pf",
  type: "persons",
  subtype: "comments",
  url: "https://community.punterforum.com/",
  regions: {
    "italy.torino": {
      listUrl: "https://community.punterforum.com/forums/torino.175/",
      itemUrl: "https://community.punterforum.com/",
      imagesUrl: "https://community.punterforum.com/",
    },
  },
  defaultCountry: 'IT', // ISO-3166-1
  currency: "€", // TODO: put inside country...
  selfModerated: false,
  commentsOnly: true,
  immutable: true,
  login: {
    loginRequestTag: 'Hai raggiunto il numero massimo di visualizzazioni',
    url: 'https://community.punterforum.com/login/',
    username: 'ilbeluga', // (email: ilbeluga666@gmail.com)
    password: 'esticatsi.666',
    usernameSelector: "[name='login']",
    passwordSelector: "[name='password']",
    submitSelector: "[type='submit']",
  },
  commentsOnly: true,
};

const config = require('../config');
//const logger = require('../logger');

async function listPageEvaluate(region, page, nextListPage) {
  return new Promise(async (resolve, reject) => {
    const url = nextListPage ? nextListPage : info.regions[region].listUrl;
    const imagesUrl = info.regions[region].imagesUrl;
    if (!url) {
      throw (new Error(`region ${region} for provider ${info.key} has no list url`));
    }
    //logger.info(`listPageEvaluate.provider.${info.key} ${url}`);
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle0' }); // waitUntil: 'networkidle0' to load all scripts
    } catch (err) {
      return reject(err.message);
    }
    try {
      const items = await page.evaluate(async (config, info, url, imagesUrl, region) => {
        const list = [];
        let nextListPage = null;

        const group = document.querySelector("div.structItemContainer-group.js-threadList");
        if (!group) throw(new Error(`reading url ${url}, empty group`));
        
        group.querySelectorAll("div.structItem.structItem--thread").forEach(item => {
          if (!item) throw(new Error(`reading url ${url}, empty item`));
          const data = {};
          data.provider = info.key;
          data.region = region;
          //data.type = info.type;
          //data.missing = false;
          //data.immutable = info.immutable;
          data.onHoliday = false;
          data.images = [];

          try {
            data.url = item.querySelector("a:first-child").getAttribute("href").replace(/^\//, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for url: ${err.message}`));
          }

          try { // id
            data.id = data.url.replace(/^.*\./, '').replace(/\/$/, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for id: ${err.message}`));
          }

          if (config.scrape.onlyItemId.length && !config.scrape.onlyItemId.includes(data.id)) {
            //console.log('BREAK DUE TO scrape.onlyItemId ' + config.scrape.onlyItemId.length);
            return;
          }

          try {
            const titleAndPhoneElement = item.querySelector("div.structItem-title").querySelector("a:nth-child(2)");
            if (titleAndPhoneElement) {
              data.title = titleAndPhoneElement.innerText.replace(/_+/g, ' ').replace(/\s*\d+$/, '').replace(/[\+\-\s]+$/, '');
              data.title = decodeURIComponent(data.title);
              data.title = data.title.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // uppercase words
              data.phone = titleAndPhoneElement.innerText.match(/.*?(\d+)$/) ? titleAndPhoneElement.innerText.replace(/.*?(\d+)$/, '$1') : null;
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for title and phone: ${err.message}`));
          }

          try { // main image
            const imgElement = item.querySelector("div.structItem-iconContainer > a > img");
            if (imgElement) {
              const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.getAttribute("src").replace(/^\//, '').replace(/\?.*/, '').replace(/https:\/\/punterforum.com\//, '').replace(hostRegexp, '');
              if (!imageUrl.match(/proxy\.php/)) { // skip local icons
                const image = { url: imageUrl, category: 'main' };
                if ( // ignore placeholders
                  (!imageUrl.match(/images\/placeholder/)) &&
                  (!imageUrl.match(/images\/image_not/))
                ) {
                  data.images.push(image);
                }
              }
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for main image: ${err.message}`));
          }

          if (data.title) { // a real element
            list.push(data);
          } //else console.log('NOT pushing data title and phone:', JSON.stringify(data));
        });

        // get next page link url
        const nextListPageElement = document.querySelector("a.pageNav-jump.pageNav-jump--next");
        if (nextListPageElement) nextListPage = info.url + nextListPageElement.getAttribute("href").replace(/^\//, '');
        if (nextListPage) list.push({nextListPage}); // adding a list element with only nextListPage

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
    const imagesUrl = info.regions[region].imagesUrl;
    const itemUrl = item.url;
    if (!baseUrl || !itemUrl) {
      throw(new Error(`url not defined for provider ${info.key} at region region ${region}`));
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

        if (info.login) {
          const loginRequestTag = new RegExp(info.login.loginRequestTag);
          if (document.querySelector("body").innerText.match(loginRequestTag)) {
            console.info('ANONYMOUS LIMIT REACHED');
            return {loginRequested: true};
          }
        }

        try { // images
          // TODO: check bbImageWrapper for null
          document.querySelectorAll(/*"a.js-lbImage, */"div.bbImageWrapper.js-lbImage").forEach((imgElement) => {
            // TODO: check imgElement for null
            if (imgElement) {
              const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.querySelector("img").getAttribute("src").replace(/^\//, '').replace(/\?.*/, '').replace(/https:\/\/punterforum.com\//, '').replace(hostRegexp, '');
              const image = { url: imageUrl, category: null };
              if (!imageUrl.match(/proxy\.php/)) { // skip local icons
                if ( // ignore placeholders
                  (!imageUrl.match(/images\/placeholder/)) &&
                  (!imageUrl.match(/images\/image_not/))
                ) {
                  if (!data.images.some(img => img.url === imageUrl)) { // skip duplicates
                    image.category = 'full';
                    data.images.push(image);
                  }
                }
              }
            }
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for small images: ${err.message}`));
        }

        data.comments = [];
        data.adUrlReferences = [];

        document.querySelectorAll("article.message.message--post").forEach((block, index) => { // TODO: elaborate ALL comment blocks
          // TODO: check article.message for null
          let article = null;
          let articleElement = null;
          try {
            articleElement = block.querySelector("article.message-body");
            if (!articleElement) { // wrong or empty page
              return null;
            }
            article = articleElement.innerHTML.replace(/<blockquote.*?<\/blockquote>/gsi, ''); // remove all quotes from article
          } catch (err) {
            throw(new Error(`reading url ${url} looking for article: ${err.message}`));
          }  

          if (!data.phone) {
            try {
              if (article.match(/.*TELEFONO:\s*(\d+).*$/gsi)) {
                const phone = article.replace(/.*TELEFONO:\s*(\d+).*$/gsi, '$1'); // keep only the header part of the articke, where ad url references should be...
                if (phone) {
                  data.phone = phone;
                }
              }
            } catch (err) {
              throw(new Error(`reading url ${url} looking for phone: ${err.message}`));  
            }
          }

          //data.phone = phoneNormalize(data.phone);

          try { // ad url references
            const articleHeader = article.replace(/SERVIZI .*$/gsi, ''); // keep only the header part of the articke, where ad url references should be...
            const hrefRe = new RegExp(`a href="([^"]+)`, 'g');
            const rel1Re = new RegExp(`^\/`);
            const rel2Re = new RegExp(`^${info.url}`);
            const rel3Re = new RegExp(`^${info.url.replace(/^https:\/\//, 'http://')}`);
            const rel4Re = new RegExp(`^https?:\/\/.*?\.wikipedia\.org`);
            const rel5Re = new RegExp(`^https?:\/\/archive\.is`);

            const matches = articleHeader.matchAll(hrefRe);
            for (const match of matches) {
              const href = match[1];
              if (
                !href.match(rel1Re) &&
                !href.match(rel2Re) &&
                !href.match(rel3Re) &&
                !href.match(rel4Re) &&
                !href.match(rel5Re)
              ) { // skip relative links
                if (data.adUrlReferences.indexOf(href) === -1) { // avoid duplicate links
                  data.adUrlReferences.push(href);
                }
              }
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for ad url reference: ${err.message}`));
          }

          data.comments[index] = {};
          try { // author
            const authorElement = block.querySelector("a.username");
            data.comments[index].author = authorElement ? authorElement.innerText.replace(/^\s+|\s+$/g, '') : null;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for author: ${err.message}` + JSON.stringify(data)));
          }

          try { // date
            const dateElement = block.querySelector("time.u-dt");
            data.comments[index].date = dateElement ? dateElement.getAttribute('datetime')/*.replace(/^\s+|\s+$/g, '')*/ : null;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for date: ${err.message}`));
          }

          try { // text
            //const textElement = block.querySelector("article.message-body");
            //data.comments[index].text = textElement ? textElement.innerText.replace(/\n/gm, 'ˬ').replace(/.*DATI DELL'INSERZIONISTA\s*:?\s*(.*)\s*ˬ*$/gm, '$1').replace(/ˬ/gm, '\n').replace(/\n*/, '').replace(/\s*/, '').replace(/\n*$/, '').replace(/\s*$/, '') : null;
            const articleText = $("<div>").html(article).text();
            data.comments[index].text = articleText.replace(/\n/gm, 'ˬ').replace(/.*DATI DELL'INSERZIONISTA\s*:?\s*(.*)\s*ˬ*$/gm, '$1').replace(/ˬ/gm, '\n').replace(/\n*/, '').replace(/\s*/, '').replace(/\n*$/, '').replace(/\s*$/, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for text: ${err.message}`));
          }

          try { // vote ([1-5] / 5 stars)
            const voteElements = (article.match(/alt=.⭐./sgi) || []);
            if (voteElements && voteElements.length) { // vote was expressed with star images
              data.comments[index].vote = voteElements.length / 5;
//console.log(`VOTE (IMG) for person ${data.provider} ${data.id} comment ${index}: ${data.comments[index].vote}`);
            } else { // vote was expressed with unicode stars
              let starsOn = (article.match(/★+/gm) || [])[0]; starsOn = starsOn ? starsOn.length : 0;
              let starsOff = (article.match(/☆+/gm) || [])[0]; starsOff = starsOff ? starsOff.length : 0;
              if (starsOn > 0 || starsOff > 0) { // a meaningful result (for example: "★★★★☆")
                // 0, 5 => 0 / 5 (0.0)
                // 1, 4 => 1 / 5 (0.2)
                // 2, 3 => 2 / 5 (0.4)
                // 3, 2 => 3 / 5 (0.6)
                // 4, 1 => 4 / 5 (0.8)
                // 5, 0 => 5 / 5 (1.0)
                data.comments[index].vote = starsOn / (starsOn + starsOff);
//console.log(`VOTE (UNICODE) for person ${data.provider} ${data.id} comment ${index}: ${data.comments[index].vote}`);
              }
//else {console.log(`VOTE (UNICODE) for person ${data.provider} ${data.id} comment ${index}: NOT FOUND`);}
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for vote: ${err.message}`));
          }

        });
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