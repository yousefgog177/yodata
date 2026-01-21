class Model {
    constructor(collection, schema, connection) {
        this.collectionName = collection;
        this.schema = schema;
        this.connection = connection;
    }

    async createCollection() {
        return await this.connection.createCollection(this.collectionName);
    }

    async insertOne(document) {
        return await this.connection.insertOne(this.collectionName, document);
    }

    async insertMany(documents) {
        return await this.connection.insertMany(this.collectionName, documents);
    }

    async findOne(filter) {
        return await this.connection.findOne(this.collectionName, filter);
    }

    async find(filter = {}, options = {}) {
        return await this.connection.find(this.collectionName, filter, options);
    }

    async findById(id) {
        return await this.connection.findOne(this.collectionName, { _id: id });
    }

    async updateOne(filter, update) {
        return await this.connection.updateOne(this.collectionName, filter, update);
    }

    async updateMany(filter, update) {
        return await this.connection.updateMany(this.collectionName, filter, update);
    }

    async deleteOne(filter) {
        return await this.connection.deleteOne(this.collectionName, filter);
    }

    async deleteMany(filter) {
        return await this.connection.deleteMany(this.collectionName, filter);
    }

    async countDocuments(filter = {}) {
        const result = await this.connection.find(this.collectionName, filter, {});
        return result.documents ? result.documents.length : 0;
    }
}
module.exports = Model;