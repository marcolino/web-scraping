
    try {
      const repeat = (async() => {
        const response = await page.goto(url, { waitUntil: 'networkidle0' }); // waitUntil: 'networkidle0' to load all scripts (we need it for address lat/lon)
console.log('status: ', response.status());
        if (response.status() === 200) {
          ; // everything's fine
        } else {
          if (response.status() === 429) { // TODO: handle 429 status for all providers
            const retryAfter = parseInt(response.headers()['retry-after']) + 1; // + 1 to be on the safe side...
            console.log(`url ${url} responded with 429, waiting for ${retryAfter} seconds...`);
            setTimeout(repeat, 1000 * retryAfter);
          } else { // other errors
            return reject(new Error(`error ${response.status()} fetching page at ${url}`));
          }
        }
      });
      repeat();
    } catch (err) {
      return reject(err);
    }