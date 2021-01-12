exports.type = "persons"; // type of objects we treat
exports.defaultServerPort = 3001; // the server port we listen on
exports.jwtTokenExpiresIn = "8h"; // token expiration time
exports.schedule = "*/5 * * * *"; // run every 5 minutes
exports.networkTimeout = 60 * 1000; // network fetch timeout
exports.roles = [ "admin", "system", "user", "guest" ]; // roles we recognize
exports.imagesBaseFolder = "./cache/persons/images/";
exports.debug = false; // debug puppeteer providers scraping

const MONGO_USER = "marco";
const MONGO_PASS = "esticazzi!123";
const MONGO_DB = "web-scraping";
exports.MONGO_URI = `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@cluster0.e76px.mongodb.net/${MONGO_DB}?retryWrites=true&w=majority`;