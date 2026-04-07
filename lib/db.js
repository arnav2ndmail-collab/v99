// Stub DB — no Redis, no external DB required for this CBT-only build
export function isDBAvailable() { return false }
export async function dbGet(key) { return null }
export async function dbSet(key, val, ttl) { return null }
export async function dbDel(key) { return null }
export async function dbKeys(pattern) { return [] }
export async function dbScan(pattern) { return [] }
