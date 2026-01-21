# Y0data services #

**MongoDB-style client for connecting to Y0Data worker server**
**Your data will save in servers y0data, so no disk will take from your server**

# install y0data

``` js
npm install y0data
```

# Connect Database

``` js
const Database = require('y0data');

// Create connection with host, port, databaseId, username, password
const db = new Database(
  'localhost',  // host
  5001,         // port
  'f9b07fbe-7c8d-4f9d-9028-ebec6b3b2eea',  // databaseId
  'yousuf',     // username
  '41371755aa'  // password
);
```

# events

```js
db.on('authenticated', async ()=>{
  console.log(`DataBase Ready`)
  // Now you can use database methods
})

db.on('error', (err)=>{  
  console.log(`Error: ` + err)
})

db.on('connected', ()=>{
  console.log(`Connected to server`)
})

db.on('disconnected', ()=>{
  console.log(`Disconnected from server`)
})
```

# setup collection

```js
let customersDB = db.model('Customer', {}, 'customers')
// Now you can use customersDB methods
```

# functions

## Create
```js
let data = await customersDB.insertOne({"money": 51}) // example output → '[Accepted Data]'
let data = await customersDB.insertOne({"_id": "123", "money": 5}) // example output → '{Accepted Data} / null'
let data = await customersDB.insertMany([{"money": 51}, {"money": 9}]) // example output → '[Accepted Data]'
/*
Data will be serialized to BSON format automatically
*/
```

## find data
```js
let options = {
  money: {$gte: 10}, // Get Users have money greater than or equal to 10
  age: {$gt: 50} // get Users have age greater than 50
}

let data = await customersDB.find(options) // example output → 'Array'
let data = await customersDB.find(options, {limit: 20}) // (Get Only 20 data) example output → 'Array'
let data = await customersDB.find(options, {skip: 20}) // (Skip first 20) example output → 'Array'
let data = await customersDB.find(options, {limit: 20, skip: 10}) // (Skip 10 and limit 20) example output → 'Array'

let data = await customersDB.findOne(options) // example output → 'Object/Null'
let data = await customersDB.findOne(options, {skip: 20}) // (Skip first 20) example output → 'Object/Null'
let data = await customersDB.findById('123') // (Find by ID) example output → 'Object/Null'
```

## Update Data
```js
let options = {
  money: {$gte: 10}, // Get Users have money greater than or equal to 10
  _id: {$in: ['123', '1234']} // get Users with IDs in array
}

let new_values = {
  $inc: {money: 50}, // Add money you can also do -50 to remove

  $push: {arr: ["1"]}, // add in array items 
  $push: {arr: "1"}, // add in array item

  $pull: {arr: ["1"]}, // delete from array items
  $pull: {arr: "1"} // delete from array item
}

let data = await customersDB.updateOne(options, new_values) // example output → 'true/false' 

let data = await customersDB.updateMany(options, new_values); // example output → 'true/false' (if update one only will return true always)
```

## Delete Data
```js
let options = {
  money: {$gte: 10}, // Get Users have money greater than or equal to 10
  _id: {$in: ['123', '1234']} // get Users with IDs in array
}

let data = await customersDB.deleteOne(options) // example output → 'true/false'

let data = await customersDB.deleteMany(options); // example output → 'true/false' (if update one only will return true always)
```

## Other functions will support you
```js
let options = {
  money: {$gte: 10}, // Get Users have money greater than or equal to 10
}

let data = await customersDB.countDocuments(options) // example output → 'Number'
```

## Disconnect
```js
db.disconnect() // Close connection to server
```