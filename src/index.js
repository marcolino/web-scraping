// create an express app
const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

const { dbConnect } = require('./utils/db');
const { addRequestId } = require('./auth');
const usersRoutes = require('./routes/users');
const itemsRoutes = require('./routes/items');
const providersRoutes = require('./routes/providers');
const logger = require('./logger');
const config = require('./config');

const app = express()

// adding Helmet to enhance your API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// enabling CORS for all requests
app.use(cors());

// set logging level depending on environment
app.use(morgan((process.env.NODE_ENV !== 'production') ? 'dev' : 'combined'));

// adding routes
app.use(`/users`, usersRoutes);
app.use(`/items`, itemsRoutes);
app.use(`/providers`, providersRoutes);
app.use(`/doc`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// default root route
app.get(`/`, (req, res) => {
  res.json({ message: `REST API to scrape the web` });
});

app.get('/favicon.ico', (req, res) => {
  res.sendStatus(204); // no content
});

// handle default requests with 404
app.use((req, res) => {
  res.status(404).json({ message: `uh uh... not found` });
});

// error handler middleware
app.use((error, req, res, next) => {
  logger.error(error.stack);
  res.status(500).json({ message: `internal server error: ${error}`, stack: error.stack }); // error.stack is available only if dev
})

// any route middleware
app.all('*', addRequestId);

// connect to the database instance
 dbConnect().then(async () => {
  // start the server
  const port = process.env.PORT || config.defaultServerPort;
  app.listen(port, async () => {
    logger.info(`listening on port ${port}`);
  });
});