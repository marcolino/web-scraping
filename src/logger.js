const appRoot = require('app-root-path');
const winston = require('winston');
const jsonStringify = require('fast-safe-stringify');

// define the custom settings for each transport (file, console)
var options = {
  file: {
    level: 'info',
    filename: `${appRoot}/logs/web-scraping.log`,
    handleExceptions: true,
    json: true,
    maxSize: 5242880, // 5 MB
    maxFiles: '10d', // 10 days
    colorize: true,
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};

// format all arguments in the console log way (avoid printing "[object Object]"...)
const logLikeFormat = {
  transform(info) {
    const { timestamp, label, message } = info;
    const level = info[Symbol.for('level')];
    const args = info[Symbol.for('splat')] || [];
    const strArgs = args.map(jsonStringify).join(' ');
    info[Symbol.for('message')] = `${timestamp} ${label ? '['+label+'] ' : ''}${level}: ${message} ${strArgs}`;
    return info;
  }
};

// define a winston format for file
const winstonFileFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS"
  }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`
  ),
  logLikeFormat,
);

// define a winston format for console
const winstonConsoleFormat = winston.format.combine(
  winston.format.colorize({
    all: true
  }),
  winston.format.label({
    label: null, //"LOG"
  }),
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS"
  }),
  // winston.format.printf(
  //   info => `${info.label} ${info.timestamp} ${info.level}: ${info.message}`
  // ),
  logLikeFormat,
);

// instantiate a new winston logger
const logger = winston.createLogger({
  transports: [
    new (winston.transports.File)({
      ...options.file,
      format: winstonFileFormat,
    }),
    //(process.env.NODE_ENV !== 'production') &&
    new (winston.transports.Console)({
      ...options.console,
      format: winstonConsoleFormat,
    })
  ],
  exitOnError: false, // do not exit on handled exceptions
});

process.on('unhandledRejection', (error) =>{
  logger.error(`unhandled exception ${error.stack ? error.stack : ''}`);
});

process.on('uncaughtException', (error) =>{
  logger.error(`uncaught exception ${error.stack ? error.stack : ''}`);
});

// // // create a stream object with a 'write' function that will be used by `morgan`
// // logger.stream = {
// //   write: function (message, encoding) {
// //     // use the 'info' log level so the output will be picked up by both transports (file and console)
// //     logger.info('STREAM' + message);
// //   },
// // };

module.exports = logger;
//module.exports = (...args) => console.log(...args);