const info = {
  key: "liberliber",
  type: "audiobook",
  regions: {
  //   "audiolibri": true,
    "*": true,
  },
  url: "https://www.liberliber.it/",
  listUrl: "https://www.liberliber.it/online/opere/audiolibri/elenco-per-opere/",
  immutable: false,
  disableScraping: false,
};

async function listPageEvaluate(region, page) {
  return new Promise(async (resolve, reject) => {
    const url = info.listUrl;
    if (!url) {
      throw (`list url ${info.listUrl} not found for provider ${info.key}`);
    }
    console.log('listPageEvaluate provider:', info.key, url);

    try {
      await page.goto(url);
    } catch (err) {
      return reject(err.message);
    }

    try {
      const items = await page.evaluate(async (info, url) => {
        const list = [];
        document.querySelector("div.post-content").querySelectorAll("li").forEach(item => {
          const data = {};
          data.provider = info.key;
          data.type = info.type;

          data.book = {}
          try { // url book
            data.book.url = item.querySelector("em > a").getAttribute("href");
          } catch (err) {
            throw (new Error(`reading url ${url} looking for book url: ${err.message}`));
          }

          // url id
          var segments = data.book.url.replace(/\/$/, '').split('/'); // handle potential trailing slash
          data.id = segments.pop() + '/' + segments.pop(); // last two segments of url (author/title)

          try { // title book
            data.book.title = item.querySelector("em > a").innerText.trim();
          } catch (err) {
            throw (new Error(`reading url ${url} looking for book title: ${err.message}`));
          }

          data.author = {}
          try { // url author
            data.author.url = item.querySelector("a").getAttribute("href");
          } catch (err) {
            throw (new Error(`reading url ${url} looking for author url: ${err.message}`));
          }

          try { // name author
            data.author.name = item.querySelector("a").innerText.trim();
          } catch (err) {
            throw (new Error(`reading url ${url} looking for author name: ${err.message}`));
          }

          list.push(data);
        });
        return list;
      }, info, url);
//console.log('itens:', items);
      return resolve(items);
    } catch (err) {
      return reject(err);
    }
  })
}

const itemPageEvaluate = async (region, page, item) => {
  return new Promise(async (resolve, reject) => {
    const itemUrl = item.book.url;
    if (!itemUrl) {
      throw(`url not defined for provider ${info.key} at region region ${region}`);
    }
    const url = itemUrl;
console.log('itemPageEvaluate url:', url);
    try {
      if (info.cookie) {
        await page.setCookie(info.cookie);
      }
    } catch (err) {
      return reject(`cookie set error: ${err.message}`);
    }

    try {
      await page.goto(url);
    } catch (err) {
      return reject(`goto error: ${err.message}`);
    }

    try {
      const itemFull = await page.evaluate(async (info, url, item) => {
        const data = item;
        
        try { // cover
          data.book.coverUrl = document.querySelector('ul.slides').querySelector('img').getAttribute('src');
        } catch (err) {
          throw (new Error(`reading url ${url} looking for cover: ${err.message}`));
        }

        try { // chapters
          data.book.chapters = [];
          chapter = document.querySelector('ul.ll_musica_elenco_ogg, ul.lm_ogg, ul.ll_audiolibri_elenco_ogg, ul.ll_musica_elenco_mp3, ul.lm_mp3, ul.ll_audiolibri_elenco_mp3');
          chapter.querySelectorAll('li').forEach(row => {
            const chapter = {};
            chapter.url = row.querySelector('a').getAttribute('href');
            chapter.title = row.querySelector('a').innerText.trim();
            data.book.chapters.push(chapter);
          });
        } catch (err) {
          throw (new Error(`reading url ${url} looking for chapters: ${err.message}`));
        }

        try { // metadata
          const metadata = [];
          chapter = document.querySelector('div.ll_metadati_full, div.ll_metadati_half_sx, div.ll_metadati_half_dx');
          chapter.querySelectorAll('div.ll_metadati_etichetta').forEach((row, index) => {
            const key = row.innerText.trim().replace(/:$/, '').toLowerCase();
            metadata[index] = {};
            switch (key) {
              case 'titolo':
                metadata[index].key = 'title';
                break;
              case 'titolo per ordinamento':
                metadata[index].key = 'orderingTitle';
                break;
              case 'autore':
                metadata[index].key = 'author';
                break;
              case 'opera di riferimento':
                metadata[index].key = 'referenceWork';
                break;
              case 'artista':
                metadata[index].key = 'artist';
                break;
              case 'copertina':
                metadata[index].key = 'cover';
                break;
              case 'cura':
                metadata[index].key = 'editedBy';
                break;
              case 'licenza':
                metadata[index].key = 'license';
                break;
              case 'data pubblicazione':
                metadata[index].key = 'publishDate';
                break;
              case 'opera elenco':
                metadata[index].key = 'listWork';
                break;
              case 'etichetta':
                metadata[index].key = 'label';
                break;
              case 'genere':
                metadata[index].key = 'genre';
                break;
              case 'soggetto BISAC':
                metadata[index].key = 'BISAC_subject';
                break;
              case 'ISBN':
                metadata[index].key = 'ISBN';
                break;
              case 'descrittore Dewey':
                metadata[index].key = 'deweyDescriptor';
                break;
              case 'affidabilità':
                metadata[index].key = 'reliability';
                break;
              case 'tipo di registrazione':
                metadata[index].key = 'recordingType';
                break;
              case 'pubblicazione':
                metadata[index].key = 'published';
                break;
              case 'anno di pubblicazione opera di riferimento':
                metadata[index].key = 'referenceWorkPublishingYear';
                break;
              case 'revisione':
                metadata[index].key = 'revision';
                break;
              default:
                console.error(`unforeseen metadata label: ${key}`)
            }
          });
          chapter.querySelectorAll('div.ll_metadati_dato').forEach((row, index) => {
            const value = row.innerText.trim();
            metadata[index].value = value;
          });

          // collapse metadata array
          data.book.metadata = {};
          metadata.map(meta => {
            data.book.metadata[meta.key] = meta.value;
          });
        } catch (err) {
          throw (new Error(`reading url ${url} looking for chapters: ${err.message}`));
        }

        return data;
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