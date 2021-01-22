const express = require('express');
const router = express.Router();
const { public, private } = require('../auth');
const { scrapeProviders, scrapeProvidersImages, groupItems } = require('../controllers/providers');
const logger = require('../logger');

// endpoint to scrape items
router.post('/scrape', private, async (req, res, next) => {
  // set status to 202: the request has been accepted for processing, but the processing has not been completed. See https://tools.ietf.org/html/rfc7231#section-6.3.3.
  res.status(202).json({ message: "Started request process", data: {id: req.requestId}});
  //await scrapeProviders(req);
  //logger.info('finished scraping providers');
  await scrapeProvidersImages(req);
  logger.info('finished scraping providers images');
  //await groupItems(req);
  //logger.info('finished grouping items');
});

module.exports = router