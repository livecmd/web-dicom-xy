#!/usr/bin/env node
import crypto from 'crypto';

const args = process.argv.slice(2);
const options = new Map();

for (let index = 0; index < args.length; index += 2) {
  const key = args[index];
  const value = args[index + 1];

  if (!key?.startsWith('--') || value === undefined) {
    throw new Error('Usage: node .scripts/deployment-license-hash.mjs --salt <salt> [--hospital <id>] [--host <hostname>]');
  }

  options.set(key.slice(2), value);
}

const salt = options.get('salt') || '';

function normalize(value) {
  return value.trim().toLowerCase();
}

function hash(kind, value) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${kind}:${normalize(value)}`)
    .digest('hex');
}

if (options.has('hospital')) {
  console.log(`OHIF_LICENSE_HOSPITAL_HASHES=${hash('hospital', options.get('hospital'))}`);
}

if (options.has('host')) {
  console.log(`OHIF_LICENSE_HOST_HASHES=${hash('host', options.get('host'))}`);
}

if (salt) {
  console.log(`OHIF_LICENSE_SALT=${salt}`);
}
