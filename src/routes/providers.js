const express = require('express');
const router = express.Router();
const { public, private } = require('../auth');
/*const { scrapeProviders } =*/ require('../controllers/providers');

// endpoint to scrape items
router.post('/scrape', private, async (...args) => scrapeProviders(...args));

module.exports = router