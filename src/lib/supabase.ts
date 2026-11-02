import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
export const cloudEnabled = Boolean(supabase)

export type CloudMedicine = {
  id: string
  household_id: string
  name: string
  type: string
  purpose: string
  quantity: number
  unit: string
  expiry: string
  threshold: number
  location: string
  note: string
}

export type CloudSymptomLog = {
  id: string
  household_id: string
  type: string
  created_at: string
  severity: number
  duration: string
  note: string
  care: string
  medicine?: string | null
}

export async function createHousehold() {
  if (!supabase) throw new Error('Supabase 未配置')
  const { data, error } = await supabase.rpc('create_household')
  if (error) throw error
  return data as { household_id: string; invite_code: string }
}

export async function joinHousehold(inviteCode: string) {
  if (!supabase) throw new Error('Supabase 未配置')
  const { data, error } = await supabase.rpc('join_household', { requested_code: inviteCode.trim().toUpperCase() })
  if (error) throw error
  return data as { household_id: string }
}

export async function getHouseholdInviteCode(householdId: string) {
  if (!supabase) return null
  const { data, error } = await supabase.from('households').select('invite_code').eq('id', householdId).single()
  if (error) throw error
  return data.invite_code as string
}
