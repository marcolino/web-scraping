const puppeteer = require('puppeteer');
const config = require('../config');

exports.browserLaunch = async () => {
  return await puppeteer.launch({
    headless: true,
    //args: ["--no-sandbox", "--disable-dev-shm-usage"]
    //args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}

exports.browserPageNew = async (browser) => {
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(config.networkTimeout);
  return page;
}

exports.browserPageClose = async (page) => {
  return await page.close();
}

exports.browserClose = async (browser) => {
  return await browser.close();
}