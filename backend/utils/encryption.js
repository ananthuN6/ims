// backend/utils/encryption.js — AES-256-GCM encrypt/decrypt for JSON stored in PostgreSQL

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const ENC_MARKER = '__enc';
const ENC_VERSION = 1;

let _key = undefined;
let _warnedNoKey = false;

function resolveKey() {
  if (_key !== undefined) return _key;
  const raw = (process.env.DATA_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    _key = null;
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    _key = Buffer.from(raw, 'hex');
  } else {
    _key = crypto.scryptSync(raw, 'ims-data-encryption-v1', 32);
  }
  return _key;
}

function isEncryptionEnabled() {
  return !!resolveKey();
}

function warnNoKeyOnce() {
  if (!warnNoKeyOnce._done && !resolveKey()) {
    warnNoKeyOnce._done = true;
    console.warn(
      '[Encryption] DATA_ENCRYPTION_KEY not set — database rows stored in plaintext. ' +
      'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
}

function isEncryptedPayload(value) {
  return (
    value &&
    typeof value === 'object' &&
    value[ENC_MARKER] === ENC_VERSION &&
    typeof value.data === 'string'
  );
}

/** Encrypt a plain object for storage in JSONB. */
function encryptForStorage(plainObject) {
  const key = resolveKey();
  if (!key) {
    warnNoKeyOnce();
    return plainObject;
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(plainObject), 'utf8'),
    cipher.final(),
  ]);
  return {
    [ENC_MARKER]: ENC_VERSION,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

/** Decrypt a stored value (encrypted wrapper or legacy plaintext object). */
function decryptFromStorage(stored) {
  if (!stored) return stored;
  if (!isEncryptedPayload(stored)) return stored;

  const key = resolveKey();
  if (!key) {
    throw new Error(
      'Encrypted data found but DATA_ENCRYPTION_KEY is not set. Set the key used when data was encrypted.',
    );
  }

  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(stored.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(stored.tag, 'base64'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(stored.data, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString('utf8'));
}

module.exports = {
  isEncryptionEnabled,
  isEncryptedPayload,
  encryptForStorage,
  decryptFromStorage,
};
