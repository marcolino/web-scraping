exports.type = "persons"; // type of objects we treat
exports.serverPort = 3001; // the server port we listen on
exports.jwtTokenExpiresIn = "6h"; // token expiration time
exports.schedule = "*/5 * * * *"; // run every 5 minutes
exports.networkTimeout = 60 * 1000; // network fetch timeout
exports.roles = [ "admin", "engine", "user", "guest" ]; // roles we recognize