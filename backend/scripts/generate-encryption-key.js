#!/usr/bin/env node
/** Print a new DATA_ENCRYPTION_KEY for backend/.env */
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('hex'));
