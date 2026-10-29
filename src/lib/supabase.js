import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasValidPublicConfig = (() => {
  if (!supabaseUrl || !supabaseAnonKey) return false
  if (/your-project-ref|placeholder|example|replace-with|<.*>/i.test(supabaseUrl)) return false
  if (/your-|placeholder|example|replace-with|<.*>/i.test(supabaseAnonKey)) return false
  try {
    const url = new URL(supabaseUrl)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
})()

export const supabase = hasValidPublicConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
