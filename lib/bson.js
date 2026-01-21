// BSON Type Codes
const TYPES = {
  DOUBLE: 0x01,
  STRING: 0x02,
  OBJECT: 0x03,
  ARRAY: 0x04,
  BINARY: 0x05,
  UNDEFINED: 0x06,
  BOOL: 0x08,
  DATE: 0x09,
  NULL: 0x0A,
  INT32: 0x10,
  INT64: 0x12
};

// BSON Serializer
function serialize(doc) {
  const chunks = [];

  for (const key in doc) {
    const value = doc[key];
    const keyBuf = Buffer.from(key);
    const keyLen = Buffer.from([keyBuf.length]);

    if (value === null || value === undefined) {
      chunks.push(Buffer.concat([
        Buffer.from([value === null ? TYPES.NULL : TYPES.UNDEFINED]),
        keyLen,
        keyBuf
      ]));
    }
    else if (typeof value === 'string') {
      const valBuf = Buffer.from(value, 'utf8');
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeInt32LE(valBuf.length);
      chunks.push(Buffer.concat([
        Buffer.from([TYPES.STRING]),
        keyLen,
        keyBuf,
        lenBuf,
        valBuf
      ]));
    }
    else if (typeof value === 'number') {
      if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) {
        const buf = Buffer.alloc(4);
        buf.writeInt32LE(value);
        chunks.push(Buffer.concat([
          Buffer.from([TYPES.INT32]),
          keyLen,
          keyBuf,
          buf
        ]));
      } else {
        const buf = Buffer.alloc(8);
        buf.writeDoubleLE(value);
        chunks.push(Buffer.concat([
          Buffer.from([TYPES.DOUBLE]),
          keyLen,
          keyBuf,
          buf
        ]));
      }
    }
    else if (typeof value === 'boolean') {
      chunks.push(Buffer.concat([
        Buffer.from([TYPES.BOOL]),
        keyLen,
        keyBuf,
        Buffer.from([value ? 1 : 0])
      ]));
    }
    else if (value instanceof Date) {
      const buf = Buffer.alloc(8);
      buf.writeBigInt64LE(BigInt(value.getTime()));
      chunks.push(Buffer.concat([
        Buffer.from([TYPES.DATE]),
        keyLen,
        keyBuf,
        buf
      ]));
    }
    else if (Buffer.isBuffer(value)) {
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeInt32LE(value.length);
      chunks.push(Buffer.concat([
        Buffer.from([TYPES.BINARY]),
        keyLen,
        keyBuf,
        lenBuf,
        value
      ]));
    }
    else if (Array.isArray(value)) {
      const arrayObj = {};
      value.forEach((item, idx) => {
        arrayObj[idx.toString()] = item;
      });
      const arrayBuf = serialize(arrayObj);
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeInt32LE(arrayBuf.length);
      chunks.push(Buffer.concat([
        Buffer.from([TYPES.ARRAY]),
        keyLen,
        keyBuf,
        lenBuf,
        arrayBuf
      ]));
    }
    else if (typeof value === 'object') {
      const objBuf = serialize(value);
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeInt32LE(objBuf.length);
      chunks.push(Buffer.concat([
        Buffer.from([TYPES.OBJECT]),
        keyLen,
        keyBuf,
        lenBuf,
        objBuf
      ]));
    }
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
}

// BSON Deserializer (supports both client-simple and server format)
function deserialize(buffer) {
  if (!buffer || buffer.length === 0) return {};

  // Detect server format: first 4 bytes equal total length
  if (buffer.length >= 4) {
    const total = buffer.readInt32LE(0);
    if (total === buffer.length) {
      return deserializeServer(buffer);
    }
  }
  return deserializeClient(buffer);
}

function deserializeClient(buffer) {
  let offset = 0;
  const obj = {};

  while (offset < buffer.length) {
    const type = buffer.readUInt8(offset++);
    const keyLen = buffer.readUInt8(offset++);
    const key = buffer.slice(offset, offset + keyLen).toString('utf8');
    offset += keyLen;

    if (type === TYPES.NULL) {
      obj[key] = null;
    } else if (type === TYPES.UNDEFINED) {
      obj[key] = undefined;
    } else if (type === TYPES.STRING) {
      const len = buffer.readInt32LE(offset);
      offset += 4;
      obj[key] = buffer.slice(offset, offset + len).toString('utf8');
      offset += len;
    } else if (type === TYPES.INT32) {
      obj[key] = buffer.readInt32LE(offset);
      offset += 4;
    } else if (type === TYPES.DOUBLE) {
      obj[key] = buffer.readDoubleLE(offset);
      offset += 8;
    } else if (type === TYPES.INT64) {
      obj[key] = Number(buffer.readBigInt64LE(offset));
      offset += 8;
    } else if (type === TYPES.BOOL) {
      obj[key] = !!buffer.readUInt8(offset);
      offset += 1;
    } else if (type === TYPES.DATE) {
      const timestamp = Number(buffer.readBigInt64LE(offset));
      obj[key] = new Date(timestamp);
      offset += 8;
    } else if (type === TYPES.BINARY) {
      const len = buffer.readInt32LE(offset);
      offset += 4;
      obj[key] = buffer.slice(offset, offset + len);
      offset += len;
    } else if (type === TYPES.ARRAY) {
      const len = buffer.readInt32LE(offset);
      offset += 4;
      const arrayBuf = buffer.slice(offset, offset + len);
      const arrayObj = deserializeClient(arrayBuf);
      obj[key] = Object.keys(arrayObj).sort((a, b) => Number(a) - Number(b)).map(k => arrayObj[k]);
      offset += len;
    } else if (type === TYPES.OBJECT) {
      const len = buffer.readInt32LE(offset);
      offset += 4;
      const objBuf = buffer.slice(offset, offset + len);
      obj[key] = deserializeClient(objBuf);
      offset += len;
    }
  }
  return obj;
}

function deserializeServer(buffer) {
  let offset = 4; // skip total size
  const obj = {};

  while (offset < buffer.length) {
    const type = buffer.readUInt8(offset++);
    if (type === 0x00) break; // end marker

    // read null-terminated key
    let keyStart = offset;
    while (offset < buffer.length && buffer[offset] !== 0x00) {
      offset++;
    }
    const key = buffer.slice(keyStart, offset).toString('utf8');
    offset++; // skip null terminator

    switch (type) {
      case TYPES.NULL:
        obj[key] = null;
        break;
      case TYPES.UNDEFINED:
        obj[key] = undefined;
        break;
      case TYPES.STRING: {
        const len = buffer.readInt32LE(offset);
        offset += 4;
        // server writes length including trailing null
        const strLen = Math.max(0, len - 1);
        obj[key] = buffer.slice(offset, offset + strLen).toString('utf8');
        offset += len; // consume payload + trailing null
        break;
      }
      case TYPES.INT32:
        obj[key] = buffer.readInt32LE(offset);
        offset += 4;
        break;
      case TYPES.INT64:
        obj[key] = Number(buffer.readBigInt64LE(offset));
        offset += 8;
        break;
      case TYPES.DOUBLE:
        obj[key] = buffer.readDoubleLE(offset);
        offset += 8;
        break;
      case TYPES.BOOL:
        obj[key] = !!buffer.readUInt8(offset);
        offset += 1;
        break;
      case TYPES.ARRAY:
      case TYPES.OBJECT: {
        const len = buffer.readInt32LE(offset);
        offset += 4;
        const inner = buffer.slice(offset, offset + len);
        // Recursively parse using server rules
        obj[key] = deserializeServer(inner);
        offset += len;
        break;
      }
      default:
        // Skip unknown types safely by breaking
        return obj;
    }
  }
  return obj;
}

module.exports = {
  TYPES,
  serialize,
  deserialize
};
