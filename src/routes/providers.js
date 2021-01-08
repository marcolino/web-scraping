const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const { public, private } = require('../auth');
const { scrapeProviders } = require('../controllers/providers');

// endpoint to scrape items
router.post('/scrape', private, async (req, res, next) => {
  req.id = uuid.v4();
  // set status to 202: the request has been accepted for processing, but the processing has not been completed. See https://tools.ietf.org/html/rfc7231#section-6.3.3.
  res.status(202).json({ message: "Processing request...", data: {id: req.id}});
  scrapeProviders(req);
});

module.exports = router