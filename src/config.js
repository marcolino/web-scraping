exports.type = "persons"; // type of objects we treat
exports.defaultServerPort = 3001; // the server port we listen on
exports.jwtTokenExpiresIn = "8h"; // token expiration time
exports.schedule = "*/30 * * * *"; // run every 5 minutes
exports.networkTimeout = 60 * 1000; // network fetch timeout
exports.roles = [ // roles we recognize
  { name: "admin" },
  { name: "system", neverExpires: true },
  { name: "user" },
  { name: "guest" },
];
exports.scrape = {
  debug: {
    puppeteer: false, // debug puppeteer while scraping providers
    duplicateItemsPersonsCollection: true, // duplicate db collection 'items.persons' before starting
    duplicateImagesCache: true, // duplicate images cache before starting
  },
  onlyRegions: ["italy.torino"], // scrape only a subset of regions
  onlyProviders: ["sgi"], // scrape only a subset of providers
  onlyItemId: ["adv7150"], // scrape only a subset of items id's
  onlyFirstPages: 0, // scrape only the first n pages (0 means all pages)
  onlyFirstItems: 0, // scrape only the first n items (0 means all items)
  alsoImmutables: false, // scrape also immutable providers (by default, scrape only added items of immutable providers)
};
exports.images = {
  baseFolder: "./cache/persons/images/",
  size: {
    width: 300,
    height: 'auto',
  },
  quality: 66,
};

if (process.env.DB === "cloud") { // TODO: put MONGO_URI in environment, in production
  const MONGO_USER = "marco";
  const MONGO_PASS = "esticazzi!123";
  const MONGO_DB = "web-scraping";
  exports.MONGO_URI = `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@cluster0.e76px.mongodb.net/${MONGO_DB}?retryWrites=true&w=majority`;
} else {
  const MONGO_DB = "web-scraping";
  exports.MONGO_URI = `mongodb://localhost:27017/${MONGO_DB}`;
}