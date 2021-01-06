//import { statusCodes } from 'http-status-codes';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const users = require('../models/Users');
const config = require('../config');

async function signup(req, res, next) {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;

  if (!name) {
    return res.status(400).json({ message: "no name specified" });
  }
  if (!email) {
    return res.status(400).json({ message: "no email specified" });
  }
  if (!password) {
    return res.status(400).json({ message: "no password specified" });
  }

  try {
    let user = await users.create({ name, email, password });
    delete user._doc.password;
    res.status(200).json({ message: "user registered successfully", data: { user } });
  } catch (err) {
    //return next(err);
    if (err.name === 'MongoError' && err.code === 11000) {
      // duplicate email
      return res.status(422).json({ message: 'User with this email already exists', data: { email } });
    }
    // other error
    return res.status(500).json({ message: `cannot register user: ${err}` });
  }
}

async function signin(req, res, next) {
  const email = req.body.email;
  const password = req.body.password;

  if (!email) {
    return res.status(400).json({ message: "no email specified" });
  }
  if (!password) {
    return res.status(400).json({ message: "no password specified" });
  }

  try {
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(403).json({ message: "email not found", data: { email } });
    }
    if (
      (bcrypt.compareSync(password, user.password)) ||
      ((process.env.NODE_ENV === 'development') && (password === user.password))
     ) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_TOKEN, { expiresIn: config.jwtTokenExpiresIn });
      return res.status(200).json({ message: "user authenticated successfully", data: { user, token: token } });
    } else {
      return res.status(403).json({ message: "invalid user email/password", data: { email } });
    }
  } catch (err) {
    return res.status(500).json({ message: `cannot authenticate user: ${err}` });
  }
}

async function profile(req, res, next) {
  const userId = req.body.userId;

  if (!userId) { // should not happen, route is private, we should have userId im body from auth
    return res.status(400).json({ message: "no user id found" });
  }

  try {
    const user = await users.findOne({ _id: userId });
    if (!user) {
      return res.status(403).json({ message: "user not found", data: { userId } });
    }
    return res.status(200).json({ data: { user } });
  } catch (err) {
    return res.status(500).json({ message: `cannot find user: ${err}` });
  }
}

module.exports = {
  signup,
  signin,
  profile,
};