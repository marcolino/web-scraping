const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const logger = require('./logger');
const users = require('./models/Users');
const config = require('./config');

// roles required per endpoint
const endpointRoles = {
  '/providers/scrape': [ 'admin', 'system' ],
  '/providers/scrapeSchedule': [ 'admin', 'system' ],
};

function public(req, res, next) {
  // add unique id to request
  req.requestId = uuid.v4();
  next();
}

const private = (req, res, next) => {
  // add unique id to request
  req.requestId = uuid.v4();

  const token = (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') ?
    req.headers.authorization.split(' ')[1] :
    req.headers['x-access-token']
  ;
  const secret = process.env.JWT_SECRET_TOKEN;

  jwt.verify(token, secret, async(err, decoded) => {
    if (err) {
      return res.status(401).json({ message: `this is a private route (${err.message})` });
    }
//logger.info('decoded: ' + JSON.stringify(decoded));
    // add user id to request
    req.userId = decoded.id;
    req.role = decoded.role;
//logger.debug(`user id: ${req.userId}`);

    // verify user's role is sufficient
    const endpoint = req.originalUrl;
//logger.log(`middleware req endpoint:`, endpoint, endpointRoles, endpointRoles[endpoint], endpoint in endpointRoles ? true : false);
    if (endpoint in endpointRoles) { // this endpoint has a specific role requirement
      const user = await users.findOne({_id: req.userId});
//logger.info(`user: ${user}`);
      if (!req.role) { // user has no role set
        return res.status(401).json({ message: `this is a reserved route, sorry` });
      }
      if (!endpointRoles[endpoint].includes(req.role)) { // user has a role set, and it is not contained in requested roles
        return res.status(401).json({ message: `this is a reserved route and your role is insufficient, sorry` });
      }
      // user is authorized
    } else {
      // this endpoint has no specific role requirement, authorize any user for this request
    }
    next();
  });
}

const verifyUserPassword = (user, password) => {
  console.log('verifyUserPassword', user, password);
  logger.debug('verifyUserPassword', user, password);
  if (
    (bcrypt.compareSync(password, user.password)) ||
    ((process.env.NODE_ENV === 'development') && (password === user.password)) // while developing we accept clean text passwords too
  ) {
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET_TOKEN,
      config.roles.find(r => r.name === user.role && r.neverExpires) ? { expiresIn: config.jwtTokenExpiresIn } : {} // some roles will never expire
      //user.role !== 'system' ? { expiresIn: config.jwtTokenExpiresIn } : {} // 'system' user role will never expire
    );
    return token;
  }
  return null;
}

module.exports = {
  public,
  private,
  verifyUserPassword,
}