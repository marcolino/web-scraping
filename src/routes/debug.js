const express = require('express');
const path = require('path');
const router = express.Router();
const { public } = require('../auth');

router.get('/sci', public, (req, res, next) => {
  res
    //.set("Content-Security-Policy", "default-src *; style-src 'self' http://* 'unsafe-inline'; script-src 'self' http://* 'unsafe-inline' 'unsafe-eval'")
    .sendFile(path.resolve('debug/sci.html'));
});

router.get('/grid', public, (req, res, next) => {
console.log('req.route', req.route.path);
  res
    //.set("Content-Security-Policy", "default-src *; style-src 'self' http://* 'unsafe-inline'; script-src 'self' http://* 'unsafe-inline' 'unsafe-eval'")
    .sendFile(path.resolve('debug/grid.html'));
});

router.use((req, res, next) => {
console.log('req.route', req.route.path);
  res.status(404).json({ message: `uh uh... not found` });
});

module.exports = router;