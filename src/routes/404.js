// ========== lib/404.js ==========
module.exports = function () {
  return function (req, res, next) {
    res.status(404).send('uh oh');
  };
};