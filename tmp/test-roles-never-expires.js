const roles = [
  { name: "admin" },
  { name: "system", neverExpires: true },
  { name: "user" },
  { name: "guest" },
]; // roles we recognize

const role = "admin";
//roles.filter(r => console.log(Object.keys(r)[0]));
console.log(roles.find(r => r.name === role && r.neverExpires));