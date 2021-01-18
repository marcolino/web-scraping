/**
 * Function to group a list of objects by a key property value.
 * Only one (the first one) object with each key property value is kept, others are ignored.
 */
function groupBy(list, keyGetter) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyGetter(item);
    let collection = map.get(key);
    if (!collection) {
      //map.set(key, [item]);
      map.set(key, item);
    } else {
      //collection.push(item);
      collection = item;
    }
  });
  return map;
}

const itemsList = [
  { name: "Alice", group: "A" },
  { name: "Beatrice", group: "B" },
  { name: "Carla", group: "C" },
  { name: "Diana", group: "B" }
];
const itemsListGrouped = groupBy(itemsList, item => item.group);
console.log('group A:', itemsListGrouped.get("A"));
console.log('group B:', itemsListGrouped.get("B"));
console.log('group C:', itemsListGrouped.get("C"));
