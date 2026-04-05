import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://flevugepctwuuxsyacbg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZXZ1Z2VwY3R3dXV4c3lhY2JnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM5MTA2MSwiZXhwIjoyMDg5OTY3MDYxfQ.4gBz4YTdFCIp0s9hwty06Y5pL_i6HgUpPuOPXJDsCZQ'
)

const BIZ_IDS = [
  '4f06adc5-77c6-438f-b66e-b3e60336e52c','3ecd17c1-d4fd-4131-a88b-0f16df74e3ae',
  '8a1ba6d0-7bfe-4add-a140-1a632b224393','31a69873-79fd-4fc3-8227-998777c3d434',
  '6f380bf3-c4c4-4972-a7a1-e7a3af499a83','72199fcd-346f-45d7-9a1f-9191aa3020ec',
  'f9b9b067-f8dc-44bb-b450-cae67d04f680','0a35a6fb-90b9-4c57-bc88-9fd41ecad2c9',
  '28282613-715b-484e-a773-b53f6aca21ff','170d717b-c334-45fa-ae3b-aee9fc16a147',
  '650aa1ab-8670-4973-b55e-9d47d6a37057','9b7fec4b-3991-42ea-85b3-5316f7754384',
  'a0e701d3-85d9-43bb-a51a-664f5e2e81bf','f37df06d-bafd-48d6-9f81-56da3b6c3337',
  '9fb51eae-25e4-4571-bfc3-6bc66b976443','4498420a-626b-4be8-9165-7428ea2a6545',
  '8a866226-2c4b-4a8a-b605-d9394af8bb68','c8840373-093a-43b1-a2ab-f49f22b3e5a4',
  '06602ab9-f86e-4bed-b1ec-2a95510c6f5e','bf44b0ab-4ea4-4328-875a-01db10304643',
  '9d58e516-d72e-497f-8932-d28ba486cb79','f6741650-8ba1-490f-8a72-265583fa012e',
  '9dd6a004-ab3f-46c6-954b-32e306d2ec76','bafd0fa6-5795-4542-913f-109f71f3c4e6',
  '122876cb-56db-459a-bcfe-cc3f7e0901d3','98f5d4ef-4b2c-4a1c-9943-70bb04e2afd8',
  '782f8703-b058-4cd2-8ccf-3d78115b6ab1','4a6824fa-44ed-4883-b11d-027999d88bc1',
  '12892e85-02d0-4b53-bb0c-cfd9c11618b6','553cb283-6b83-453c-8878-ec65f58c9339',
]

const CAUSE_IDS = [
  '6e67cafa-c3c1-476e-9d09-83e6d367933f','addb662f-2fc3-4c9b-b3dc-74e1a13b64f8',
  'bdb1d9c6-9402-428b-902f-cbb517374c9a','7bdd2962-fdc0-49e7-83e3-526c3c7c3a38',
  'dc1413f2-7bbf-46b2-8a82-6eb5545400fd','212bc309-dab4-4544-9d5f-0f1eab51d81a',
  'bd1692ff-73aa-452f-a805-1a1c5d6d70da','f9d53cad-da5b-4adc-851b-109c489f993b',
  'd9f2109a-0868-4add-b420-d5c61e9318f0','0a9edd14-45fe-4553-83d5-5c9334d3ee3c',
  '648abb75-a568-4111-9464-8a2561744828','bf498869-c98d-4fe8-a61e-3d1b0f0ce7c9',
  'c9514abe-37bf-4bb5-9525-39c5919de101','c61c894c-67aa-464a-995c-4c818217636b',
  '0a71b569-c128-48bd-8837-9030bcb837a6','c5ce4f20-4573-4a5d-8c7d-abc029c41092',
  'b685e167-8655-40f7-a710-e752e76b8509','8cb26a3e-f9f2-443e-ba98-4ad4e406ec96',
]

async function run() {
  // Step 1: Find QR codes for duplicate businesses
  const { data: bizQrs } = await supabase
    .from('qr_codes').select('id').in('business_id', BIZ_IDS)
  const bizQrIds = (bizQrs || []).map(q => q.id)
  console.log('QR codes linked to dup businesses:', bizQrIds.length)

  // Step 2: Find QR codes for duplicate causes
  const { data: causeQrs } = await supabase
    .from('qr_codes').select('id').in('cause_id', CAUSE_IDS)
  const causeQrIds = (causeQrs || []).map(q => q.id)
  console.log('QR codes linked to dup causes:', causeQrIds.length)

  const allQrIds = [...bizQrIds, ...causeQrIds]

  // Step 3: Delete redirects referencing these QR codes
  if (allQrIds.length > 0) {
    const { error, count } = await supabase
      .from('redirects').delete({ count: 'exact' }).in('qr_code_id', allQrIds)
    console.log('Deleted redirects:', count, error ? 'ERROR: ' + error.message : 'OK')
  }

  // Step 4: Delete QR codes for duplicate businesses
  if (bizQrIds.length > 0) {
    const { error, count } = await supabase
      .from('qr_codes').delete({ count: 'exact' }).in('id', bizQrIds)
    console.log('Deleted biz qr_codes:', count, error ? 'ERROR: ' + error.message : 'OK')
  }

  // Step 5: Delete QR codes for duplicate causes
  if (causeQrIds.length > 0) {
    const { error, count } = await supabase
      .from('qr_codes').delete({ count: 'exact' }).in('id', causeQrIds)
    console.log('Deleted cause qr_codes:', count, error ? 'ERROR: ' + error.message : 'OK')
  }

  // Step 6: Also clear linked_qr_code_id on businesses being deleted (just in case)
  await supabase.from('businesses').update({ linked_qr_code_id: null }).in('id', BIZ_IDS)

  // Step 7: Delete the duplicate businesses
  const { error: bErr, count: bCount } = await supabase
    .from('businesses').delete({ count: 'exact' }).in('id', BIZ_IDS)
  console.log('Deleted businesses:', bCount, bErr ? 'ERROR: ' + bErr.message : 'OK')

  // Step 8: Delete the duplicate causes
  const { error: cErr, count: cCount } = await supabase
    .from('causes').delete({ count: 'exact' }).in('id', CAUSE_IDS)
  console.log('Deleted causes:', cCount, cErr ? 'ERROR: ' + cErr.message : 'OK')

  // Verify
  const { data: bizAfter } = await supabase.from('businesses').select('id, name').order('name')
  const { data: causesAfter } = await supabase.from('causes').select('id, name').order('name')
  console.log('\n=== REMAINING ===')
  console.log('Businesses:', bizAfter.length)
  for (const b of bizAfter) console.log('  ', b.name)
  console.log('Causes:', causesAfter.length)
  for (const c of causesAfter) console.log('  ', c.name)
}

run().catch(console.error)
