exports.type = "persons"; // type of objects we treat
exports.defaultServerPort = 3001; // the server port we listen on
exports.jwtTokenExpiresIn = "8h"; // token expiration time
exports.schedule = "*/5 * * * *"; // run every 5 minutes
exports.networkTimeout = 60 * 1000; // network fetch timeout
exports.roles = [ // roles we recognize
  { name: "admin" },
  { name: "system", neverExpires: true },
  { name: "user" },
  { name: "guest" },
];
exports.imagesBaseFolder = "./cache/persons/images/";
exports.scrape = {
  debug: false, // debug puppeteer while scraping providers
  onlyProvider: ['toe'], // scrape only a subset of providers
  onlyItemId: [], // scrape only a subset of items id's
  onlyFirstPages: 0, // scrape olny the first n pages
  onlyFirsItems: 2, // scrape only the first n items
}

if (process.env.DB === "cloud") { // TODO: put MONGO_URI in environment, in production
  const MONGO_USER = "marco";
  const MONGO_PASS = "esticazzi!123";
  const MONGO_DB = "web-scraping";
  exports.MONGO_URI = `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@cluster0.e76px.mongodb.net/${MONGO_DB}?retryWrites=true&w=majority`;
} else {
  const MONGO_DB = "web-scraping";
  exports.MONGO_URI = `mongodb://localhost:27017/${MONGO_DB}`;
}