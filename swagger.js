const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    version: "", // by default: "1.0.0"
    title: "Web Scraping API",
    description: "A multi purpose aggregator API",
    license: {
      name: 'Licensed Under MIT',
      url: 'https://spdx.org/licenses/MIT.html',
    },
    contact: {
      name: 'Marco',
      email: 'marcoatorino@gmail.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server',
    },
  ],
  host: "localhost:3001",
  basePath: "", // by default: "/"
  schemes: ['http', 'https'],
  consumes: ['application/json'],
  produces: ['application/json'],
  securityDefinitions: {},
  definitions: {},
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./src/routes/users.js'],
};

module.exports = swaggerJSDoc(swaggerOptions);