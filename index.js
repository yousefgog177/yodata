const Database = require('./lib/database');
const { serialize, deserialize, TYPES } = require('./lib/bson');

module.exports = Database;
module.exports.Database = Database;
module.exports.BSON = { serialize, deserialize, TYPES };
