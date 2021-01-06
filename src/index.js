// importing the dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

const { startDatabase } = require('./controllers/db');
const users = require('./routes/users');
const items = require('./routes/items');
const config = require('./config');


// defining the Express app
const app = express();

//app.set('secretKey', process.env.JWT_SECRET_TOKEN); // jwt secret token

// adding Helmet to enhance your API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// enabling CORS for all requests
app.use(cors());

// set logging level depending on environment
app.use(morgan((process.env.NODE_ENV !== 'production') ? 'dev' : 'TODO, low prod level...'));

// adding morgan to log HTTP requests
app.use(morgan('combined'));

// adding routes
app.use(`/${config.apiVersion}/users`, users);
app.use(`/${config.apiVersion}/items`, items);
app.use(`/${config.apiVersion}/doc`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// default root route
app.get(`/${config.apiVersion}/`, (req, res) => {
  res.json('REST API to scrape the web');
});

app.get('/favicon.ico', (req, res) => {
  res.sendStatus(204); // no content
});

// handle default requests with 404
app.use((req, res) => {
  res.status(404).json({ message: "not found" });
});

// error handler middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ message: `internal server error: ${error}`, stack: error.stack }); // error.stack is available only if dev
 })

// start the database instance
startDatabase().then(async () => {
  // start the server
  app.listen(config.serverPort, async () => {
    console.log('listening on port 3001');
  });
});