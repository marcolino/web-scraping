// ========== lib/error.js ==========
module.exports = function () {
  return function (err, req, res, next) {
    res.status(500).json({ message: `unknown error` });
  };
};