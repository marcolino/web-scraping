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
    username: 'Billidechid', // maninthemiddle
    password: 'Billi123', // supercazzola!123
    usernameSelector: "[name='login']",
    passwordSelector: "[name='password']",
    submitSelector: "[type='submit']",
  },
  disableScraping: true,
};

async function listPageEvaluate(region, page, nextListPage) {
  return new Promise(async (resolve, reject) => {
    const url = nextListPage ? nextListPage : info.regions[region].listUrl;
    const imagesUrl = info.regions[region].imagesUrl;
    if (!url) {
      throw(`region ${region} for provider ${info.key} has no list url`);
    }
console.log('listPageEvaluate provider:', info.key, url);
    try {
      await page.goto(url);
    } catch (err) {
      return reject(err.message);
    }
    try {
      const items = await page.evaluate(async (info, url, imagesUrl, region) => {
        const list = [];
        let nextListPage = null;

        const group = document.querySelector("div.structItemContainer-group.js-threadList");
        group.querySelectorAll("div.structItem.structItem--thread").forEach(item => {
          const data = {};
          data.provider = info.key;
          data.region = region;
          data.type = info.type;
          data.missing = false;
          data.holiday = false;
          data.images = [];

          try {
            data.url = item.querySelector("a:first-child").getAttribute("href").replace(/^\//, '');
          } catch (err) {
            throw(new Error(`reading url ${url} looking for url: ${err.message}`));
          }

          try { // id
            data.id = data.url.replace(/^.*\./, '').replace(/\/$/, '');
          } catch (err) {
            throw (new Error(`reading url ${url} looking for id: ${err.message}`));
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
              let imageUrl = imgElement.getAttribute("src").replace(/^\//, '').replace(hostRegexp, '');
              const image = { url: imageUrl, category: 'main' };
              if (imageUrl !== "images/placeholder.jpg") { // skip placeholders
                data.images.push(image);
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
    const imagesUrl = info.regions[region].imagesUrl;
    const itemUrl = item.url;
    if (!baseUrl || !itemUrl) {
      throw(new Error(`url not defined for provider ${info.key} at region region ${region}`));
    }
    const url = baseUrl + itemUrl;
console.log('itemPageEvaluate url:', url);
    try {
      await page.goto(url);
    } catch (err) {
      return reject(err);
    }
    try {
      const itemFull = await page.evaluate(async (info, url, imagesUrl, item) => {
        const data = item;

        if (info.login) {
          const loginRequestTag = new RegExp(info.login.loginRequestTag);
          if (document.querySelector("body").innerText.match(loginRequestTag)) {
            console.log('ANONYMOUS LIMIT REACHED');
            return {loginRequested: true};
          }
        }

        try { // images
          document.querySelectorAll(/*"a.js-lbImage, */"div.bbImageWrapper.js-lbImage").forEach((imgElement) => {
            if (imgElement) {
              const hostRegexp = new RegExp('^' + imagesUrl);
              let imageUrl = imgElement.querySelector("img").getAttribute("src").replace(/^\//, '').replace(hostRegexp, '');
              const image = { url: imageUrl, category: null };
              if (!imageUrl.match(/^proxy.php\?image=/)) { // skip local icons
                if (!data.images.some(img => img.url === imageUrl)) { // skip duplicates
                  image.category = 'small';
                  data.images.push(image);
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
          let article = null;
          let articleElement = null;
          try {
            articleElement = block.querySelector("article.message-body");
            if (!articleElement) { // wrong or empty page
              return null;
            }
            article = articleElement.innerHTML;
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
            const hrefRegexp = /a href="([^"]+)"/g;
            const matches = articleHeader.matchAll(hrefRegexp);
            for (const match of matches) {
              const href = match[1];
              if (!href.match(/^\//)) { // skip relative links
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
            textElement = block.querySelector("article.message-body");
            data.comments[index].text = textElement ? textElement.innerText.replace(/\n/gm, 'ˬ').replace(/.*DATI DELL'INSERZIONISTA\s*:?\s*(.*)\s*ˬ*$/gm, '$1').replace(/ˬ/gm, '\n').replace(/\n*/, '').replace(/\s*/, '').replace(/\n*$/, '').replace(/\s*$/, '') : null;
          } catch (err) {
            throw(new Error(`reading url ${url} looking for text: ${err.message}`));
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