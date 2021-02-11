const express = require('express');
const router = express.Router();
const { public, private } = require('../auth');
const { getItems, getMainImages, createItem, deleteItem, updateItem, test } = require('../controllers/items');

// endpoint to get items
router.post('/', public, async (...args) => getItems(...args));

// endpoint to get items
router.get('/mainImages', public, async (...args) => getMainImages(...args));

// // endpoint to create an item
// router.post('/', private, async (...args) => createItem(...args));

// // endpoint to delete an item
// router.delete('/:id', async (...args) => deleteItem(...args));

// // endpoint to update an item
// router.put('/:id', async (req, res) => updateItem(...args));

// endpoint to make debug tests
router.get('/test', public, async (...args) => test(...args));

module.exports = router;