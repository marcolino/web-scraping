const appRoot = require('app-root-path');
const winston = require('winston');

// define the custom settings for each transport (file, console)
var options = {
  file: {
    // level: 'info',
    // filename: `${appRoot}/logs/web-scraping.log`,
    // handleExceptions: true,
    // json: true,
    // maxSize: 5242880, // 5 MB
    // maxFiles: '10d', // 10 days
    // colorize: false,
  },
  console: {
    // level: 'debug',
    // handleExceptions: true,
    // json: false,
    // colorize: true,
  },
};

// define a winston format for file
const winstonFileFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS"
  }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// define a winston format for console
const winstonConsoleFormat = winston.format.combine(
  winston.format.colorize({
    all: true
  }),
  winston.format.label({
    label: "LOG"
  }),
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS"
  }),
  winston.format.printf(
    info => `${info.label} ${info.timestamp} ${info.level}: ${info.message}`
  )
);

// instantiate a new winston logger
const logger = winston.createLogger({
  transports: [
    new (winston.transports.File)({
      ...options.file,
      format: winstonFileFormat,
    }),
    (process.env.NODE_ENV !== 'production') &&
    new (winston.transports.Console)({
      ...options.console,
      format: winstonConsoleFormat,
    })
  ],
  exitOnError: false, // do not exit on handled exceptions
});

module.exports = (...args) => console.log(...args);
// process.on('unhandledRejection', (error) =>{
//   logger.error(`unhandled exception ${error.stack ? error.stack : ''}`);
// });

// process.on('uncaughtException', (error) =>{
//   logger.error(`uncaught exception ${error.stack ? error.stack : ''}`);
// });

// // // create a stream object with a 'write' function that will be used by `morgan`
// // logger.stream = {
// //   write: function (message, encoding) {
// //     // use the 'info' log level so the output will be picked up by both transports (file and console)
// //     logger.info('STREAM' + message);
// //   },
// // };

// module.exports = logger;