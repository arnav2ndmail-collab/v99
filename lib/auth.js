import crypto from 'crypto'

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lastnitro51@gmail.com'
export const ADMIN_PASS = process.env.ADMIN_PASS || 'lastnitro51'

export function hashPass(pass) {
  return crypto.createHash('sha256').update(pass + 'tz_salt_2026').digest('hex')
}
export function genToken() {
  return crypto.randomBytes(32).toString('hex')
}

// Stub user functions (no DB)
export async function getUser() { return null }
export async function createUser() { return { error: 'Not supported' } }
export async function validateUser() { return null }
export async function getAllUsers() { return [] }
export async function deleteUser() {}
export async function createSession() { return genToken() }
export async function getSession() { return null }
export async function deleteSession() {}
export async function createAdminSession() { return genToken() }
export async function isAdminSession(token) {
  // Verify using signed admin token stored in process
  if (!token) return false
  const valid = global._adminTokens || (global._adminTokens = new Set())
  return valid.has(token)
}
export function registerAdminToken(token) {
  if (!global._adminTokens) global._adminTokens = new Set()
  global._adminTokens.add(token)
}
export async function saveAttempt() { return 'id' }
export async function getUserAttempts() { return [] }
export async function deleteAttempt() {}
export async function getAllAttemptCount() { return 0 }
export function verifyAdminToken(token) {
  if (!token) return false
  const valid = global._adminTokens || new Set()
  return valid.has(token)
}
