// create an express app
const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

const { dbConnect } = require('./utils/db');
const usersRoutes = require('./routes/users');
//const itemsRoutes = require('./routes/items');
//const providersRoutes = require('./routes/providers');
//const logger = require('./logger');
const config = require('./config');

const app = express()

// use the express-static middleware
app.use(express.static("public"))

// define the first route
app.get("/", function (req, res) {
  res.send("<h1>Hello World!</h1>")
})

// start the server listening for requests
app.listen(process.env.PORT || 3000,
  () => console.log("Server is running..."));