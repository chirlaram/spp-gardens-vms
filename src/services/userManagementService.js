import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export async function getUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, role, created_at')
    .order('role')
  if (error) throw error
  return data
}

export async function createUser({ username, display_name, role, pin }) {
  const hashed = await bcrypt.hash(pin.trim(), 10)
  const { data, error } = await supabase
    .from('users')
    .insert({ username: username.trim().toLowerCase(), display_name: display_name.trim(), role, pin: hashed })
    .select('id, username, display_name, role, created_at')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Username already exists')
    throw error
  }
  return data
}

export async function updateUser(id, { username, display_name, role, pin }) {
  const updates = {
    username: username.trim().toLowerCase(),
    display_name: display_name.trim(),
    role,
  }
  if (pin && pin.trim()) updates.pin = await bcrypt.hash(pin.trim(), 10)

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, username, display_name, role, created_at')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Username already exists')
    throw error
  }
  return data
}

export async function deleteUser(id) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id)
  if (error) throw error
}
