const appRoot = require('app-root-path');
const winston = require('winston');

// define the custom settings for each transport (file, console)
var options = {
  file: {
    level: 'info',
    filename: `${appRoot}/logs/web-scraping.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 10,
    colorize: false,
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};

// instantiate a new winston logger
const winstonFormat = winston.format.combine(
  winston.format.colorize({
    all: true
  }),
  winston.format.label({
    label: "LOG"
  }),
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:MM:SS"
  }),
  winston.format.printf(
    info => `${info.label} ${info.timestamp} ${info.level}: ${info.message}`
  )
);

const logger = winston.createLogger({
  transports: [
    new winston.transports.File(options.file),
    //new winston.transports.Console(options.console)
    new (winston.transports.Console)({
      format: winston.format.combine(winston.format.colorize(), winstonFormat)
    })
  ],
  exitOnError: false, // do not exit on handled exceptions
});

// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
  write: function (message, encoding) {
    // use the 'info' log level so the output will be picked up by both transports (file and console)
    logger.info('STREAM' + message);
  },
};

module.exports = logger;