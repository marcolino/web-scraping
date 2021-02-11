const o = [
  { url: "1", category: "main", pHash: "123"},
  { url: "2", category: "full", pHash: "456"},
 ];
 const n = [
  { url: "1", category: "main", pHash: "123"},
  { url: "2", category: "full", pHash: "NEW"},
  { url: "3", category: "full"},
 ];
 
 //Array.prototype.push.apply(o, n);
 
 const arraysMerge = (o, n, keyPropsSet) => {
   const all = [...o, ...n]; // merge the two arrays
   
   // look for duplicate entries, and merge them
   const merged = [];
   all.forEach(a => { // scan trough items all
     // look for duplicates of this all element into merged array
     const index = merged.findIndex(m => {
       let dup = true;
       for (let i = 0; i < keyPropsSet.length; i++) {
         const keyProp = keyPropsSet[i];     
         if (m[keyProp] !== a[keyProp]) {
           dup = false;
           break;
         }
       }
       return dup;
     });
     if (index >= 0) { // a duplicate found in merged array: merge this all element with the duplicate
       merged[index] = {...(merged[index]), ...(a)}
     } else { // no duplicate found in merged array: push this all element
       merged.push(a);
     }
   });
   return merged;
 }
 
 console.log('merged:', arraysMerge(o, n, ['url']));