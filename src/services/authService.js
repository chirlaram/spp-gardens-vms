import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

const ROLE_PERMISSIONS = {
  management: ['create', 'edit', 'payment', 'cancel', 'postpone', 'commitments', 'view_all', 'dashboard', 'complete', 'view_kitchen', 'incidentals', 'bill', 'rooms', 'events_tab', 'manage_users'],
  accounts: ['create', 'edit', 'payment', 'cancel', 'postpone', 'commitments', 'view_all', 'dashboard', 'incidentals', 'bill', 'rooms'],
  sales: ['commitments', 'commitments_read', 'view_all', 'dashboard'],
  events: ['dashboard', 'view_all', 'commitments', 'commitments_read', 'events_tab', 'complete', 'incidentals', 'bill', 'rooms'],
  housekeeping: ['view_kitchen', 'rooms'],
}

const SESSION_KEY = 'spp_session'

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export async function login(username, pin) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .single()

  if (error || !data) {
    throw new Error('Invalid username or PIN')
  }

  const pinMatch = data.pin.startsWith('$2')
    ? await bcrypt.compare(pin.trim(), data.pin)
    : data.pin === pin.trim()

  if (!pinMatch) {
    throw new Error('Invalid username or PIN')
  }

  const permissions = ROLE_PERMISSIONS[data.role] || []
  const session = {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    role: data.role,
    permissions,
  }
  setSession(session)
  return session
}

export function logout() {
  clearSession()
}

export function hasPermission(user, permission) {
  if (!user) return false
  return (user.permissions || []).includes(permission)
}
