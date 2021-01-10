exports.type = "persons"; // type of objects we treat
exports.serverPort = 3001; // the server port we listen on
exports.jwtTokenExpiresIn = "8h"; // token expiration time
exports.schedule = "*/5 * * * *"; // run every 5 minutes
exports.networkTimeout = 60 * 1000; // network fetch timeout
exports.roles = [ "admin", "system", "user", "guest" ]; // roles we recognize
exports.imagesBaseFolder = "./cache/persons/images/";
exports.debug = false; // debug puppeteerproviders scraping