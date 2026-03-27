import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function retireAffiliates() {
  console.log('Looking for affiliate accounts...')

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,role')
    .eq('role', 'affiliate')

  if (error) throw error

  if (!profiles || profiles.length === 0) {
    console.log('No affiliate accounts found.')
    return
  }

  console.log(`Found ${profiles.length} affiliate account(s). Deleting...`)

  for (const profile of profiles) {
    console.log(`  Removing ${profile.email} (${profile.full_name})`)

    const { error: authError } = await supabase.auth.admin.deleteUser(profile.id)
    if (authError) throw authError

    await (supabase.from('audit_logs') as any).insert({
      user_id: null,
      action: 'retired_affiliate_account',
      entity_type: 'profile',
      entity_id: profile.id,
      old_values: { role: 'affiliate', email: profile.email, full_name: profile.full_name },
      new_values: { deleted: true },
      metadata: { source: 'scripts/retire-affiliates.ts' },
    })
  }

  console.log('Affiliate cleanup complete.')
}

retireAffiliates().catch((error) => {
  console.error(error)
  process.exit(1)
})
