const jwt = require("jsonwebtoken");
//const jwt = require('express-jwt');
// const jwksRsa = require('jwks-rsa');
//
// const checkJwt = jwt({
//   secret: jwksRsa.expressJwtSecret({
//     cache: true,
//     rateLimit: true,
//     jwksRequestsPerMinute: 5,
//     jwksUri: `https://marc0.eu.auth0.com/.well-known/jwks.json`,
//   }),

//   // validate the audience and the issuer
//   audience: `https://marc0.eu.auth0.com/api/v2/`, // API_IDENTIFIER
//   issuer: `https://marc0.eu.auth0.com`, // AUTH0_DOMAIN
//   algorithms: ['RS256']
// });

function public(req, res, next) {
  next();
}

function private(req, res, next) {
  const token = (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') ?
    req.headers.authorization.split(' ')[1] :
    req.headers['x-access-token']
  ;
  const secret = process.env.JWT_SECRET_TOKEN;

  jwt.verify(token, secret, function(err, decoded) {
    if (err) {
      return res.json({ status: "error", message: err.message, data: null });
    }
    // add user id to request
    req.body.userId = decoded.id;
    next();
  });
}

module.exports = {
  public,
  private,
}