const express = require('express');
const router = express.Router();
const { public, private } = require('../auth');
const itemsController = require('../controllers/items');

// endpoint to get items
router.get('/', public, async (req, res, next) => {
  const filter = req.params.filter;
  const items = await itemsController.getItems(filter);
console.log('get items:', items)
  res.send({ status: true, message: `${items.length} items found`, items});
});

// endpoint to get items
router.get('/mainImages', public, async (req, res, next) => {
  const filter = req.params.filter;
  const items = await itemsController.getItems(filter);
console.log('get items:', items)
  res.send({ status: true, message: `${items.length} items found`, items: items.map(i => i.imageUrl)});
});

// endpoint to create an item
router.post('/', private, async (req, res, next) => {
  const item = req.body;
  const id = await itemsController.createItem(item);
  res.send({ message: 'item inserted', id });
});

// endpoint to delete an item
router.delete('/:id', async (req, res, next) => {
  const id = req.params.id;
  await deleteItem(id);
  res.send({ message: 'Item removed', id });
});

// endpoint to update an item
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const item = req.body;
  await updateItem(id, item);
  res.send({ message: 'Item updated', id });
});

module.exports = router;