const events = require('events');
const crypto = require('crypto');
const Connection = require('./connection');
const { serialize, deserialize } = require('./bson');
const model = require('./model');

class Database extends events {
  constructor(host, port, databaseId, username, password) {
    super();

    this.host = host || 'localhost';
    this.port = port || 5001;
    this.databaseId = databaseId;
    this.username = username;
    this.password = password;

    this.connection = null;
    this.authenticated = false;

    this._connect();
  }

  hash(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async _connect() {
    this.onConnecting();

    try {
      this.connection = new Connection(this.host, this.port);

      await this.connection.connect();
      this.onConnected();

      // Set up event handlers
      this.connection.socket.on('error', (err) => {
        this.onError(err);
      });

      this.connection.socket.on('close', () => {
        this.onDisconnected();
        this.authenticated = false;
      });

      this.connection.socket.on('end', () => {
        this.onDisconnecting();
      });

      // Authenticate
      await this._authenticate();

    } catch (err) {
      this.onError(err);
    }
  }

  async _authenticate() {
    try {
      const response = await this.connection.sendRequest('AUTHENTICATE', {
        databaseId: this.databaseId,
        username: this.username,
        password: this.password
      });

      if (response.success) {
        this.authenticated = true;
        this.onAuthenticated();
      } else {
        this.onAuthenticationFailed(response.error);
        this.connection.close();
      }
    } catch (err) {
      this.onError(err);
      this.connection.close();
    }
  }

  async createCollection(collectionName) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    const response = await this.connection.sendRequest('CREATE_COLLECTION', {
      databaseId: this.databaseId,
      collectionName: collectionName
    });

    return response;
  }

  async insertOne(collectionName, document) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    // Serialize document to BSON
    const bsonData = serialize(document);

    const response = await this.connection.sendRequest('INSERT_ONE', {
      databaseId: this.databaseId,
      collectionName: collectionName,
      document: bsonData.toString('base64')
    });

    // Throw error if insertion failed (e.g., duplicate _id)
    if (!response.success) {
      const error = new Error(response.error || 'Insert failed');
      error.response = response;
      throw error;
    }

    return response;
  }

  async insertMany(collectionName, documents) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    // Serialize all documents to BSON
    const bsonDocuments = documents.map(doc => serialize(doc).toString('base64'));

    const response = await this.connection.sendRequest('INSERT_MANY', {
      databaseId: this.databaseId,
      collectionName: collectionName,
      documents: bsonDocuments
    });

    // Throw error if insertion failed completely
    if (!response.success) {
      const error = new Error(response.error || 'Insert many failed');
      error.response = response;
      throw error;
    }

    return response;
  }

  async findOne(collectionName, filter = {}) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    const response = await this.connection.sendRequest('FIND_ONE', {
      databaseId: this.databaseId,
      collectionName: collectionName,
      filter: filter
    });

    // Deserialize BSON response if present
    if (response.success && response.data && response.data.document) {
      const doc = response.data.document;
      if (doc && doc.bson) {
        const buffer = Buffer.from(doc.bson, 'base64');
        const deserialized = deserialize(buffer);
        deserialized._id = doc._id;
        return deserialized;
      }
    }

    return null;
  }

  async find(collectionName, filter = {}, options = {}) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    const requestData = {
      databaseId: this.databaseId,
      collectionName: collectionName,
      filter: filter
    };

    // Add limit and skip if provided
    if (options.limit !== undefined) {
      requestData.limit = options.limit;
    }
    if (options.skip !== undefined) {
      requestData.skip = options.skip;
    }

    const response = await this.connection.sendRequest('FIND', requestData);

    // Deserialize BSON responses if present
    if (response.success && response.data && response.data.documents) {
      const documents = response.data.documents.map(doc => {
        if (doc && doc.bson) {
          const buffer = Buffer.from(doc.bson, 'base64');
          const deserialized = deserialize(buffer);
          deserialized._id = doc._id;
          return deserialized;
        }
        return null;
      }).filter(doc => doc !== null);

      return documents;
    }

    return [];
  }

  async updateOne(collectionName, filter, update) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    const requestData = {
      databaseId: this.databaseId,
      collectionName: collectionName,
      filter: filter,
      update: update
    };

    const response = await this.connection.sendRequest('UPDATE_ONE', requestData);
    return response.data;
  }

  async updateMany(collectionName, filter, update) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    const requestData = {
      databaseId: this.databaseId,
      collectionName: collectionName,
      filter: filter,
      update: update
    };

    const response = await this.connection.sendRequest('UPDATE_MANY', requestData);
    return response.data;
  }

  async deleteOne(collectionName, filter) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    const requestData = {
      databaseId: this.databaseId,
      collectionName: collectionName,
      filter: filter
    };

    const response = await this.connection.sendRequest('DELETE_ONE', requestData);
    return response.data;
  }

  async deleteMany(collectionName, filter) {
    if (!this.authenticated) {
      throw new Error('Not authenticated. Please connect first.');
    }

    const requestData = {
      databaseId: this.databaseId,
      collectionName: collectionName,
      filter: filter
    };

    const response = await this.connection.sendRequest('DELETE_MANY', requestData);
    return response.data;
  }

  disconnect() {
    if (this.connection) {
      this.connection.close();
    }
  }

  // Utility methods
  serializeBSON(obj) {
    return serialize(obj);
  }

  deserializeBSON(buffer) {
    return deserialize(buffer);
  }

  // Event handlers
  onConnecting() {
    // console.log("[Y0DATA] Connecting...");
    this.emit('connecting');
  }

  onConnected() {
    // console.log("[Y0DATA] Connected!");
    this.emit('connected');
  }

  onAuthenticated() {
    // console.log("[Y0DATA] Authenticated!");
    this.emit('authenticated');
  }

  onAuthenticationFailed(error) {
    // console.error(`[Y0DATA] Authentication failed: ${error}`);
    this.emit('authenticationFailed', error);
  }

  onDisconnecting() {
    // console.log("[Y0DATA] Disconnecting...");
    this.emit('disconnecting');
  }

  onDisconnected() {
    // console.log("[Y0DATA] Disconnected!");
    this.emit('disconnected');
  }

  onError(err) {
    // console.error(`[Y0DATA] Error: ${err.message}`);
    this.emit('error', err);
  }

  onReconnected() {
    // console.log("[Y0DATA] Reconnected!");
    this.emit('reconnected');
  }

  /**
   * Create a Mongoose-style model from a schema
   * @param {String} modelName - Name of the model
   * @param {Object} schema - Schema definition with fields
   * @param {String} collectionName - (Optional) Collection name, defaults to lowercase modelName + 's'
   * @returns {Object} Model instance with CRUD methods
   */
  model(modelName, schema, collectionName) {
    const collection = collectionName || (modelName.toLowerCase() + 's');
    const connection = this;

    return new Model();
  }
}

module.exports = Database;