const info = {
  key: "ef",
  type: "persons",
  url: "https://www.escortforumit.xxx/",
  regions: {
    "italy.torino": {
      listUrl: "https://www.escortforumit.xxx/escorts/city_it_torino/",
      itemUrl: "https://www.escortforumit.xxx/",
      imagesUrl: "https://pic.escortforumit.xxx/escortforumit.xxx/",
    },
  },
  cookie: { // reason: terms accepted
    name: '18',
    value: '1',
    domain: 'www.escortforumit.xxx',
  },
  currency: "€", // TODO: put inside country...
  mediumPricePerHalfHour: 120,
  mediumPricePerHour: 200,
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
    //logger.info(`listPageEvaluate.provider.${info.key}.${url}`);
    try {
      if (info.cookie) {
        await page.setCookie(info.cookie);
      }
    } catch (err) {
      return reject('cookie set error:', err.message);
    }

    try {
      await page.goto(url);
    } catch (err) {
      return reject(err.message);
    }

    try {
      const items = await page.evaluate(async (config, info, url, imagesUrl, region) => {
        const list = [];
        document.querySelector("div.escorts").querySelectorAll("div.escort").forEach(item => {
          const data = {};
          data.provider = info.key;
          data.region = region;
          //data.type = info.type;
          //data.missing = false;
          //data.immutable = info.immutable;
          data.images = [];

          try { // url
            data.url = item.querySelector("a.showname").getAttribute("href").replace(/^\//, '').replace(/\?.*/, '')
          } catch (err) {
            throw(new Error(`reading url ${url} looking for url: ${err.message}`));
          }

          try { // id
            data.id = data.url.replace(/accompagnatrici\/[^-]+-/, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for id: ${err.message}`));
          }

          if (config.scrape.onlyItemId.length && !config.scrape.onlyItemId.includes(data.id)) {
            //console.log('BREAK DUE TO scrape.onlyItemId');
            return;
          }

          try { // title
            data.title = item.querySelector("a,showname").innerText.replace(/_+/g, ' ').replace(/^\s+|\s+$/g, '')
            data.title = decodeURIComponent(data.title);
            data.title = data.title.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()); // uppercase words
          } catch (err) {
            throw(new Error(`reading url ${url} looking for title: ${err.message}`));
          }

          try { // main image
            const imgElement = item.querySelector("img.escort-thumb");
            if (imgElement) {
              const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.getAttribute("src").replace(/^\//, '').replace(/\?.*/, '').replace(hostRegexp, '');
              const image = { url: imageUrl, category: 'main' };
              data.images.push(image);
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for main image: ${err.message}`));
          }

          try { // ad class
            const adClassElement = item.querySelector("div.image > span");
            if (adClassElement) {
              data.adClass = adClassElement.getAttribute('class');
            }
          } catch (err) {
            throw(new Error(`reading url ${url} looking for class: ${err.message}`));
          }

          try { // price
            data.price = item.querySelector("div.l_price").innerText.replace(/^\s+|\s+$/g, '');
            if (data.price === "-") data.price = null;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for price: ${err.message}`));
          }

          try { // additionalInfo
            data.additionalInfo = item.querySelector("div.l_slogan_text").innerText.replace(/^\s+|\s+$/g, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for additional info: ${err.message}`));
          }

          try { // selfDescription
            data.selfDescription = item.querySelector("div.l_about_text").innerText.replace(/^\s+|\s+$/g, '').replace(/\n+/g, '\n');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for self description: ${err.message}`));
          }

          try { // suspicious flag
            data.suspicious = item.querySelector("span.suspicious") !== null;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for suspicious flag: ${err.message}`));
          }

          list.push(data);
        });
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
    const imagesUrl = info.regions[region].imagesUrl;
    if (!baseUrl || !itemUrl) {
      throw (new Error(`url not defined for provider ${info.key} at region region ${region}`));
    }
    const url = baseUrl + itemUrl;
    //logger.info(`itemPageEvaluate.provider.${info.key}.${url}`);
    try {
      if (info.cookie) {
        await page.setCookie(info.cookie);
      }
    } catch (err) {
      return reject(`cookie set error: ${err.message}`);
    }

    try {
      const response = await page.goto(url);
    } catch (err) {
      return reject(`goto error: ${err.message}`);
    }

    try {
      const itemFull = await page.evaluate(async (info, url, imagesUrl, item) => {
        const data = item;

        try { // subtitle
          data.subtitle = document.querySelector("div.head.info").innerText.replace(/^\s+|\s+$/g, '');
        } catch (err) {
          throw(new Error(`reading url ${url} looking for title: ${err.message}`));
        }

        try { // services
          document.querySelectorAll('div#profile-container table tr').forEach(row => {
            const rowHeader = row.querySelector('th') ? row.querySelector('th').innerText.replace(/:\s*$/, '').toLowerCase() : null;
            const rowContent = row.querySelector('td') ? row.querySelector('td').innerText.replace(/^\s+|\s+$/g, '').toLowerCase() : null;
            switch (rowHeader) {
              case 'telefono':
                data.phone = rowContent;
                break;
              case 'istruzioni telefono':
                data.contactInstructions = rowContent;
                break;
              case 'etnia':
                data.ethnicity = rowContent;
                break;
              case 'nazionalità':
                data.nationality = rowContent;
                break;
              case 'età':
                data.age = rowContent;
                break;
              case 'occhi':
                data.eyesColor = rowContent;
                break;
              case 'capelli':
                data.hairColor = rowContent;
                break;
              case 'peli pubici':
                data.pubicHair = rowContent;
                break;
              case 'tatoo':
                data.tatoo = rowContent;
                break;
              case 'piercings':
                data.piercings = rowContent;
                break;
              case 'altezza':
                data.height = rowContent;
                break;
              case 'peso':
                data.weight = rowContent;
                break;
              case 'coppa taglia':
                data.breastSize = rowContent;
                break;
              case 'breast':
                data.breastType = rowContent;
                break;
              case 'misura scarpe':
                data.shoeSize = rowContent;
                break;
              case 'fumatore/rice':
                //if (typeof rowContent !== 'undefined') throw(new Error('SMOKER: ' + JSON.stringify(rowContent)));
                data.smoker = (!rowContent || rowContent === 'no' || rowContent === 'occasionalmente') ? false : true;
                //if (rowContent) throw(new Error('SMOKER:' . JSON.stringify([data.smoker, rowContent ? rowContent : null])));
                break;
              case 'lingue':
                data.spokenLanguages = rowContent.split('\n');
                break;
              case 'orientamento':
                data.sexualOrientation = rowContent;
                break;
              default:
                //console.log('default:', rowHeader, ':', rowContent);
                break;
            }
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for services: ${err.message}`));
        }

        // try { // small images
        //   document.querySelectorAll("div#gallery-content-0 img").forEach(imgElement => {
        //     if (imgElement) {
        //       const hostRegexp = new RegExp('^' + imagesUrl);
        //       let imageUrl = imgElement.getAttribute("src").replace(/^\//, '').replace(/\?.*/, '').replace(hostRegexp, '');
        //       const image = { url: imageUrl, category: 'small' };
        //       if (imageUrl !== "#") {
        //         data.images.push(image);
        //       }
        //     }
        //   });
        // } catch (err) {
        //   throw(new Error(`reading url ${url} looking for small images: ${err.message}`));
        // }

        try { // full images
          document.querySelectorAll("div#gallery-content-0 a").forEach(imgElement => {
            if (imgElement) {
              const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.getAttribute("href").replace(/^\//, '').replace(/\?.*/, '').replace(hostRegexp, '');
              const image = { url: imageUrl, category: 'full' };
              if (imageUrl !== "#") {
                data.images.push(image);
              }
            }
          });
        } catch (err) {
          throw(new Error(`reading url ${url} looking for full images: ${err.message}`));
        }

        data.comments = [];

        return data;

        // We are not processing comments from this provider, since they are auto-moderated and even auto-produced, so completely misleading
        //
        // TODO: TO GET COMMENTS: https://www.escortforumit.xxx/it/comments-v2/ajax-show?escort_id=16625&page=1...N (6 per page)
        // TODO: TO GET REVIEWS: https://www.escortforumit.xxx/recensioni/brendaNA-16625?page=1...N (2 per page)
        // try { // comments
        //   let commentsList = [];
        //   const commentsSelector = document.querySelectorAll("div#comments_container > span");
        //   if (commentsSelector) { // any comment present
        //     commentsSelector.querySelectorAll("span").forEach((commenter, index) => {
        //       const qs = commenter.querySelector("a");
        //       if (qs && qs.innerText) {
        //         const author = qs.innerText.replace(/^\s+|\s+$/g, '');
        //         commentsList[index] = {};
        //         commentsList[index].author = author.trim();
        //       }
        //       qs = commenter.querySelector("span");
        //       if (qs && qs.innerText) {
        //         const datetimecount = qs.innerText;
        //         const a = datetimecount.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '').split(",");
        //         const date = a[0];
        //         const time = a[1];
        //         const authorCommentsCount = a[2];
        //         const reviews = a[3];
        //         commentsList[index] = commentsList[index] || {};
        //         commentsList[index].date = datetimeSpaced2Date(date.trim(), time.trim());
        //         commentsList[index].authorCommentsCount = parseInt(authorCommentsCount);
        //         commentsList[index].reviews = reviews;
        //       }
        //     });
        //     commentsSelector.querySelectorAll("span.comment_body").forEach((comment, index) => {
        //       if (comment && comment.innerText) {
        //         const text = comment.innerText.replace(/^\s+|\s+$/g, '');
        //         commentsList[index] = commentsList[index] || {};
        //         commentsList[index].text = text.trim();
        //       }
        //     });
        //   }
        //   data.comments = commentsList;
        // } catch (err) {
        //   throw(new Error(`reading url ${url} looking for comments: ${err.message}`));
        // }
        //
        // function datetimeSpaced2Date(date, time) {
        //   const day = date.substr(0, 2);
        //   const monthLiteral = date.substr(3, 3);
        //   let month = "";
        //   switch (monthLiteral) {
        //     case 'Jan': month = '01'; break;
        //     case 'Feb': month = '02'; break;
        //     case 'Mar': month = '03'; break;
        //     case 'Apr': month = '04'; break;
        //     case 'May': month = '05'; break;
        //     case 'Jun': month = '06'; break;
        //     case 'Jul': month = '07'; break;
        //     case 'Aug': month = '08'; break;
        //     case 'Sep': month = '09'; break;
        //     case 'Oct': month = '10'; break;
        //     case 'Nov': month = '11'; break;
        //     case 'Dec': month = '12'; break;
        //   }
        //   const year = date.substr(7, 4);
        //   let seconds = "";
        //   if (time.length <= 5) seconds += ":00"; // add seconds to time
        //   return `${year}-${month}-${day} ${time}${seconds}`;
        // }

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