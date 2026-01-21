const net = require('net');
const crypto = require('crypto');

class Connection {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.reader = null;
    this.writer = null;
    this.requestQueue = new Map();
    this.objectMapper = require('./bson');
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({
        host: this.host,
        port: this.port
      }, () => {
        resolve();
      });

      this.socket.on('data', (data) => {
        this._handleResponse(data.toString());
      });

      this.socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  sendRequest(type, data) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        return reject(new Error('Connection is not established'));
      }

      const requestID = crypto.randomUUID();

      const message = {
        type: type,
        requestID: requestID,
        data: data
      };

      this.requestQueue.set(requestID, { resolve, reject });

      const jsonMessage = JSON.stringify(message);
      this.socket.write(jsonMessage + '\n');
    });
  }

  _handleResponse(data) {
    try {
      const response = JSON.parse(data);
      const requestID = response.requestID;

      if (this.requestQueue.has(requestID)) {
        const { resolve } = this.requestQueue.get(requestID);
        this.requestQueue.delete(requestID);
        resolve(response);
      }
    } catch (err) {
      console.error(`[Y0DATA] Failed to parse response: ${err.message}`);
    }
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
    }
  }

  isConnected() {
    return this.socket && !this.socket.destroyed;
  }
}

module.exports = Connection;
