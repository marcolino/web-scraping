const express = require('express');
const router = express.Router();
// const { public, private } = require('../auth');
// const { signin, signup, profile } = require('../controllers/users');

// /**
//  * @swagger
//  * /v1/users/signup:
//  *   post:
//  *     summary: Register a user
//  *     description: Registers a user
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               name:
//  *                 type: string
//  *                 description: The user's name
//  *                 example: "Marco"
//  *               email:
//  *                 type: string
//  *                 description: The user's email
//  *                 example: "marcosolari@gmail.com"
//  *               password:
//  *                 type: string
//  *                 description: The user's password
//  *                 example: "12345678"
//  *     responses:
//  *       200:
//  *         description: User is authenticated
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                  name:
//  *                    type: string
//  *                    description: The user name
//  *       403:
//  *         description: User is not authenticated
//  */
// router.post('/signup', public, (...args) => signup(...args));

// /**
//  * @swagger
//  * /v1/users/signin:
//  *   post:
//  *     summary: Authenticate a user
//  *     description: Authenticates a user
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               email:
//  *                 type: string
//  *                 description: The user's email
//  *                 example: "marcosolari@gmail.com"
//  *               password:
//  *                 type: string
//  *                 description: The user's password
//  *                 example: "12345678"
//  *     responses:
//  *       200:
//  *         description: User is authenticated
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                  name:
//  *                    type: string
//  *                    description: The user name
//  *       422:
//  *         description: User could not be registered
//  */
// router.post('/signin', public, (...args) => signin(...args));

// router.get('/profile', private, (...args) => profile(...args));

module.exports = router;