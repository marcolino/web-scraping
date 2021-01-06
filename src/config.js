//require("dotenv").config();
const languages = require('language-list')();
 
exports.serverPort = 3001;
exports.apiVersion = "v1";
exports.jwtTokenExpiresIn = "6h";
exports.schedule = "*/5 * * * *"; // run every 5 minutes
exports.navigationTimeout = 60 * 1000;
exports.roles = [ "admin", "engine", "user", "guest" ];
exports.languages = languages.getLanguageCodes();