// Portable v4 UUID: uses Web Crypto (available in Node >=19 and Cloudflare Workers).

export function randomUUID() {
  return globalThis.crypto.randomUUID();
}