import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eqwglyolzmpqjeoafgwr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxd2dseW9sem1wcWplb2FmZ3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzMxNzgsImV4cCI6MjA3Mjc0OTE3OH0.fBPvCUHQP5lwSOuXVFdTHxMgYU4kHWtBDD4BHeAtBD8'

export const supabase = createClient(supabaseUrl, supabaseKey)
