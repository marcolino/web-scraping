const jwt = require('jsonwebtoken');
const uuid = require('uuid');
//const logger = require('./logger');
const users = require('./models/Users');

function public(req, res, next) {
  next();
}

function private(req, res, next) {
  next();
}

// const jwt = require('jsonwebtoken');
// const uuid = require('uuid');
// const logger = require('./logger');
// const users = require('./models/Users');
// //const jwt = require('express-jwt');
// // const jwksRsa = require('jwks-rsa');
// //
// // const checkJwt = jwt({
// //   secret: jwksRsa.expressJwtSecret({
// //     cache: true,
// //     rateLimit: true,
// //     jwksRequestsPerMinute: 5,
// //     jwksUri: `https://marc0.eu.auth0.com/.well-known/jwks.json`,
// //   }),

// //   // validate the audience and the issuer
// //   audience: `https://marc0.eu.auth0.com/api/v2/`, // API_IDENTIFIER
// //   issuer: `https://marc0.eu.auth0.com`, // AUTH0_DOMAIN
// //   algorithms: ['RS256']
// // });

// // roles required per endpoint
// const endpointRoles = { // TODO: into database?
//   '/providers/scrape': [ 'admin', 'system' ],
//   '/providers/scrapeSchedule': [ 'admin', 'system' ],
// };

// function public(req, res, next) {
//   // add unique id to request
//   req.requestId = uuid.v4();
//   next();
// }

// const private = (req, res, next) => {
//   // add unique id to request
//   req.requestId = uuid.v4();

//   const token = (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') ?
//     req.headers.authorization.split(' ')[1] :
//     req.headers['x-access-token']
//   ;
//   const secret = process.env.JWT_SECRET_TOKEN;

//   jwt.verify(token, secret, async(err, decoded) => {
//     if (err) {
//       return res.status(401).json({ message: `this is a private route (${err.message})` });
//     }
// //logger.debug(`decoded:`, decoded);
//     // add user id to request
//     req.userId = decoded.id;
//     req.role = decoded.role;
// //logger.debug(`user id: ${req.userId}`);

//     // verify user's role is sufficient
//     const endpoint = req.originalUrl;
// //logger.log(`middleware req endpoint:`, endpoint, endpointRoles, endpointRoles[endpoint], endpoint in endpointRoles ? true : false);
//     if (endpoint in endpointRoles) { // this endpoint has a specific role requirement
//       const user = await users.findOne({_id: req.userId});
// //logger.log('user:', user);
//       if (!req.role) { // user has no role set
//         return res.status(401).json({ message: `this is a reserved route, sorry` });
//       }
//       if (!endpointRoles[endpoint].includes(req.role)) { // user has a role set, and it is not contained in requested roles
//         return res.status(401).json({ message: `this is a reserved route and your role is insufficient, sorry` });
//       }
//       // user is authorized
//     } else {
//       // this endpoint has no specific role requirement, authorize any user for this request
//     }
//     next();
//   });
// }

module.exports = {
  public,
  private,
}