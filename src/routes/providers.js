const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require("path");
const { private } = require('../auth');
const { scrapeProviders, scrapeProvidersImages, scrapeSchedule, groupProvidersItems, someCommonImages, itemsMerge, showCommonImages } = require('../controllers/providers');
const { verifyConsistency, verifyOrphanedImages } = require('../controllers/debug');

const logger = require('../logger');
const config = require('../config');

// endpoint to scrape items
router.post('/scrape', private, async (req, res, next) => {
  // set status to 202: the request has been accepted for processing, but the processing has not been completed. See https://tools.ietf.org/html/rfc7231#section-6.3.3.
  res.status(202).json({ message: "Started scraping process", data: {id: req.requestId}});
  await scrapeProviders(req);
  await scrapeProvidersImages(req);
  //await groupProvidersItems(req);
});

// endpoint to schedule scrape providers
router.post('/scrapeSchedule', private, async (req, res, next) => {
  await scrapeSchedule(req);
  res.status(200).json({ message: "Scheduled scraping process", data: {id: req.requestId}});
});

router.post('/group', private, async (req, res, next) => {
  try {
    // set status to 202: the request has been accepted for processing, but the processing has not been completed. See https://tools.ietf.org/html/rfc7231#section-6.3.3.
    res.status(202).json({ message: "Started grouping process", data: {id: req.requestId}});
    await groupProvidersItems(req);
  } catch (err) {
    logger.error(`error grouping providers items: ${err}`);
  }
});

// system only routes (verify)
router.post('/verify', private, async (req, res, next) => {
  const verifyConsistencyFilter = req.body.verifyConsistencyFilter ? req.body.verifyConsistencyFilter : {};
  const verifyOrphanedImagesFilter = req.body.verifyOrphanedImagesFilter ? req.body.verifyOrphanedImagesFilter : {};

  let status = 200;
  const results = {};
  results.verifyConsistency = await verifyConsistency(verifyConsistencyFilter);
  results.verifyOrphanedImages = await verifyOrphanedImages(verifyOrphanedImagesFilter);
  if (
    (results.verifyConsistency.status !== 200) ||
    (results.verifyOrphanedImages.status !== 200)
  ) {
    status = 400;
  }
  res.status(status).json({results: {
    verifyConsistency: results.verifyConsistency.result,
    verifyOrphanedImages: results.verifyOrphanedImages.result,
  }});
}); 

router.post('/verifyConsistency', private, async (req, res, next) => {
  const filter = req.body.verifyConsistencyFilter ? req.body.verifyConsistencyFilter : {};
  const response = verifyConsistency(filter);
  res.status(response.status).json(...(response.result));
});

router.post('/verifyOrphanedImages', private, async (req, res, next) => {
  const filter = req.body.verifyOrphanedImagesFilter ? req.body.verifyOrphanedImagesFilter : {};
  const response = verifyConsistency(filter);
  res.status(response.status).json(...(response.result));
});

router.post('/verifyDuplicateImagesForPerson', private, async (req, res, next) => {
});

// system only routes (debug)
router.post('/debugSomeCommonImages', private, async (req, res, next) => {
});

router.post('/debugItemsMerge', private, async (req, res, next) => {
});

module.exports = router;