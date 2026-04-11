import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import { regenerateAllForStakeholder } from '@/lib/server/material-engine'
import { asUuid } from '@/lib/uuid'
import type { Business, Stakeholder } from '@/lib/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getAuthenticatedSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { profile, localProfileId } = session
    const supabase = createServiceClient()

    const shell = getStakeholderShell(profile)
    if (!['admin', 'field', 'launch_partner'].includes(shell)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const businessId = asUuid(params.id)
    if (!businessId) {
      return NextResponse.json(
        { error: 'Branding uploads require a linked local dashboard business id.' },
        { status: 400 },
      )
    }

    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (businessError) {
      return NextResponse.json(
        { error: `Business lookup failed: ${businessError.message}` },
        { status: 500 },
      )
    }

    const business = (businessData || null) as Business | null
    if (!business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const mediaType = formData.get('mediaType') as string | null

    if (!file || !mediaType || !['logo', 'cover_photo'].includes(mediaType)) {
      return NextResponse.json({ error: 'File and mediaType (logo or cover_photo) required.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'png'
    const filePath = `business-media/${businessId}/${mediaType}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    // Ensure bucket exists
    const storage = supabase.storage as any
    const { error: bucketError } = await storage.getBucket('materials')
    if (bucketError) {
      await storage.createBucket('materials', { public: true })
    }

    const { error: uploadError } = await supabase.storage
      .from('materials')
      .upload(filePath, fileBuffer, {
        upsert: true,
        contentType: file.type || 'image/png',
      })

    if (uploadError) {
      console.error('[business-media] storage upload error', uploadError)
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    const patch: Partial<Business> = mediaType === 'logo'
      ? { logo_url: publicUrl }
      : { cover_photo_url: publicUrl }

    const { error: updateError } = await (supabase.from('businesses') as any)
      .update(patch)
      .eq('id', businessId)

    if (updateError) {
      console.error('[business-media] businesses update error', updateError)
      return NextResponse.json(
        {
          error: `Business update failed: ${updateError.message || 'unknown error'}`,
          details: updateError.details || null,
          hint: updateError.hint || null,
          code: updateError.code || null,
        },
        { status: 500 },
      )
    }

    // Auto-regenerate materials on branding change
    const { data: stakeholderData } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('business_id', businessId)
      .limit(1)

    const stakeholder = ((stakeholderData || []) as Stakeholder[])[0] || null

    let regenerated = false
    if (stakeholder) {
      try {
        await regenerateAllForStakeholder(supabase, stakeholder.id, localProfileId)
        regenerated = true
      } catch (regenError) {
        console.error('[business-media] regeneration error (non-fatal)', regenError)
      }
    }

    return NextResponse.json({
      success: true,
      mediaType,
      fileUrl: publicUrl,
      regenerated,
    })
  } catch (error) {
    console.error('[business-media] unhandled error', error)
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Upload failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
