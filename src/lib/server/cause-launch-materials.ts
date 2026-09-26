import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { renderCauseCampaignFlyer, type FlyerAudience } from './cause-campaign-flyers'

type LaunchCause = {
  id: number
  name: string
  city?: string | null
  state?: string | null
  imageUrl?: string | null
  coverPhotoUrl?: string | null
  category?: string | null
  referralCode?: string | null
}

type LandingRecord = { status?: string; draft?: unknown; published?: unknown }
type GeneratedList = { items?: Array<{ generatedFileUrl?: string | null; generationStatus?: string | null; metadata?: unknown }> }

const slugify = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0, 70)

function assetUrl(value: string | null | undefined, folder: 'logos' | 'covers') {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${QA_AUTH_CONFIG.baseUrl}/uploads/${folder}/${encodeURIComponent(value)}`
}

async function qaJson<T>(path: string, init?: RequestInit, message = 'Launch materials request failed.') {
  return parseQaResponse<T>(await fetchQaApi(path, init), message)
}

export async function getCauseLaunchStatus(causeId: number, request: typeof qaJson = qaJson) {
  const [landing, generated] = await Promise.all([
    request<LandingRecord>(`/api/dashboard/v1/Nonprofit/${causeId}/landing-page`),
    request<GeneratedList>(`/api/dashboard/v1/GeneratedMaterial?causeAccountId=${causeId}`),
  ])
  const flyerCount = generated?.items?.filter(item => item.generatedFileUrl && item.generationStatus !== 'failed').length || 0
  const draft = landing?.draft as { slug?: string; video?: { src?: string }; assets?: { mark?: { src?: string }; crowd?: { src?: string } } } | null
  const videoUrl = draft?.video?.src || null
  return {
    flyers: flyerCount > 0 ? 'generated' : 'missing',
    flyerCount,
    landingPages: landing?.status || 'not_started',
    landingSlug: draft?.slug || null,
    video: videoUrl ? 'generated'
      : !draft?.assets?.mark?.src || !draft?.assets?.crowd?.src ? 'waiting for images'
        : !process.env.CAUSE_VIDEO_RENDER_URL || !process.env.CAUSE_VIDEO_RENDER_TOKEN ? 'renderer not configured' : 'ready to render',
    videoUrl,
  }
}

export async function generateCauseLaunchMaterials(cause: LaunchCause, request: typeof qaJson = qaJson) {
  const steps: Record<string, { status: string; detail?: string }> = {}
  const landingPath = `/api/dashboard/v1/Nonprofit/${cause.id}/landing-page`
  let campaignSlug = `${slugify(cause.name) || 'cause'}-${cause.id}`
  let logoUrl = assetUrl(cause.imageUrl, 'logos')
  let coverUrl = assetUrl(cause.coverPhotoUrl, 'covers')
  try {
    const record = await request<LandingRecord>(landingPath)
    campaignSlug = String((record?.draft as { slug?: string } | null)?.slug || campaignSlug)
    const draftAssets = (record?.draft as { assets?: { mark?: { src?: string }; crowd?: { src?: string } } } | null)?.assets
    logoUrl ||= draftAssets?.mark?.src || ''
    coverUrl ||= draftAssets?.crowd?.src || ''
    if (record?.draft || record?.published) {
      const draft = record.draft as Record<string, unknown> | null
      const assets = draft?.assets as Record<string, { src?: string; alt?: string }> | undefined
      const logo = logoUrl
      const cover = coverUrl
      if (draft && assets && ((!assets.mark?.src && logo) || (!assets.crowd?.src && cover))) {
        const config = { ...draft, assets: {
          ...assets,
          mark: assets.mark?.src ? assets.mark : { src: logo, alt: `${cause.name} logo` },
          crowd: assets.crowd?.src ? assets.crowd : { src: cover, alt: `${cause.name} community` },
        } }
        const slug = String(draft.slug || `${slugify(cause.name) || 'cause'}-${cause.id}`)
        await request(landingPath, {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, config }),
        })
        steps.landingPages = { status: 'draft', detail: 'Newly uploaded assets added to the campaign draft.' }
      } else {
        steps.landingPages = { status: record.status || 'draft', detail: 'Existing campaign preserved.' }
      }
    } else {
      const slug = `${slugify(cause.name) || 'cause'}-${cause.id}`
      const config = {
        slug, revision: 'draft', schoolName: cause.name, organizationName: cause.name,
        causeAccountId: cause.id, locality: [cause.city, cause.state].filter(Boolean).join(', ') || 'your community',
        routeBase: `/landing/${slug}`,
        colors: { navy: '#071A3D', navyDeep: '#031126', royal: '#153E78', silver: '#C8CBD1', silverLight: '#EEF0F3', gold: '#D0A323' },
        assets: {
          mark: { src: logoUrl, alt: `${cause.name} logo` },
          crowd: { src: coverUrl, alt: `${cause.name} community` },
        },
        scheduleCallUrl: '', disclaimer: '', assetsArePlaceholder: false,
      }
      const saved = await request<{ blockers?: string[] }>(landingPath, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, config }),
      })
      steps.landingPages = { status: 'draft', detail: saved?.blockers?.join(' ') || 'Ready for review.' }
    }
  } catch (error) {
    steps.landingPages = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }

  try {
    if (!cause.referralCode) {
      steps.flyers = { status: 'waiting', detail: 'The cause needs a referral code before its QR flyers can be generated.' }
    } else {
      const campaignUrl = `https://my.localvip.com/landing/${encodeURIComponent(campaignSlug)}`
      const audiences: FlyerAudience[] = ['business', 'families', 'schools']
      const flyerErrors: string[] = []
      let customGenerated = 0
      if (logoUrl && coverUrl) {
        const existing = await request<GeneratedList>(`/api/dashboard/v1/GeneratedMaterial?causeAccountId=${cause.id}&pageSize=100`)
        const version = `${logoUrl}|${coverUrl}|${cause.referralCode}`
        for (const audience of audiences) {
          const alreadySaved = existing?.items?.some(item => {
            const metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) as Record<string, unknown> : item.metadata as Record<string, unknown> | null
            return item.generatedFileUrl && metadata?.generator === 'cause-campaign-v1' && metadata?.audience === audience && metadata?.version === version
          })
          if (alreadySaved) { customGenerated += 1; continue }
          try {
            const joinUrl = `${campaignUrl}/${audience}?ref=${encodeURIComponent(cause.referralCode)}`
            const bytes = await renderCauseCampaignFlyer({ name: cause.name,
              locality: [cause.city, cause.state].filter(Boolean).join(', ') || 'Your community',
              logoUrl, coverUrl, joinUrl, audience })
            const filename = `${slugify(cause.name) || 'cause'}-${audience}-flyer.pdf`
            const form = new FormData()
            form.append('file', new File([new Uint8Array(bytes)], filename, { type: 'application/pdf' }))
            const uploaded = await request<{ fileUrl: string }>(
              '/api/dashboard/v1/MaterialAsset/upload?folder=cause-launch', { method: 'POST', body: form },
              `Could not upload ${audience} flyer.`)
            if (!uploaded?.fileUrl) throw new Error('The asset upload did not return a file URL.')
            await request('/api/dashboard/v1/GeneratedMaterial', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ causeAccountId: cause.id, generatedFileUrl: uploaded.fileUrl,
                generatedFileName: filename, libraryFolder: 'Cause launch', tags: `school,cause,${audience}`,
                metadata: { generator: 'cause-campaign-v1', audience, version, joinUrl } }),
            }, `Could not save ${audience} flyer.`)
            customGenerated += 1
          } catch (error) {
            flyerErrors.push(`${audience}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
      const templatesResult = await request<unknown>('/api/dashboard/v1/MaterialTemplate?isActive=true')
      const raw = Array.isArray(templatesResult) ? templatesResult
        : (templatesResult && typeof templatesResult === 'object' && Array.isArray((templatesResult as { items?: unknown[] }).items))
          ? (templatesResult as { items: unknown[] }).items : []
      const templates = raw.filter(item => {
        if (!item || typeof item !== 'object') return false
        const row = item as Record<string, unknown>
        const value = row.stakeholderTypes ?? row.stakeholder_types
        let types: unknown[]
        if (Array.isArray(value)) types = value
        else {
          const text = String(value || '').trim()
          if (text.startsWith('[')) {
            try {
              const parsed = JSON.parse(text) as unknown
              types = Array.isArray(parsed) ? parsed : [text]
            } catch { types = text.split(',') }
          } else types = text.split(',')
        }
        return types.length === 0 || types.every(type => !String(type).trim())
          || types.some(type => ['cause', 'school', 'community', 'nonprofit'].includes(String(type).trim().toLowerCase()))
      }) as Array<{ id: number | string; name?: string }>
      if (templates.length === 0) {
        steps.flyers = { status: customGenerated === 3 ? 'generated' : 'waiting',
          detail: customGenerated === 3 ? '3/3 audience flyers generated.' : 'Upload a logo and cover photo to generate three audience flyers.' }
      } else {
        const errors: string[] = []
        let generated = 0
        for (const template of templates) {
          try {
            await request<unknown>('/api/dashboard/v1/GeneratedMaterial', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ causeAccountId: cause.id, templateId: template.id }),
            }, `Could not generate ${template.name || 'a flyer'}.`)
            generated += 1
          } catch (error) {
            errors.push(`${template.name || template.id}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        const allErrors = [...flyerErrors, ...errors]
        steps.flyers = { status: allErrors.length ? (generated || customGenerated ? 'partial' : 'failed') :
          customGenerated === 3 || (!logoUrl || !coverUrl) ? 'generated' : 'partial',
          detail: `${customGenerated}/3 audience flyers, ${generated}/${templates.length} templates generated.${allErrors.length ? ` ${allErrors.join(' ')}` : ''}` }
      }
    }
  } catch (error) {
    steps.flyers = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }

  const renderUrl = process.env.CAUSE_VIDEO_RENDER_URL
  const renderToken = process.env.CAUSE_VIDEO_RENDER_TOKEN
  if (!logoUrl || !coverUrl) {
    steps.video = { status: 'waiting', detail: 'Upload the cause logo and cover photo to render the video.' }
  } else if (!renderUrl || !renderToken) {
    steps.video = { status: 'not_configured', detail: 'Set CAUSE_VIDEO_RENDER_URL and CAUSE_VIDEO_RENDER_TOKEN to connect the renderer.' }
  } else {
    try {
      const response = await fetch(`${renderUrl.replace(/\/$/, '')}/render`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${renderToken}` },
        body: JSON.stringify({ accountId: cause.id, causeName: cause.name,
          kind: /school|pta|booster/i.test(cause.category || '') ? 'school' : 'cause',
          locality: [cause.city, cause.state].filter(Boolean).join(', '),
          logoUrl, coverPhotoUrl: coverUrl,
          joinUrl: cause.referralCode ? `https://my.localvip.com/auth/signup?ref=${encodeURIComponent(cause.referralCode)}` : '',
        }),
        signal: AbortSignal.timeout(240000),
      })
      const rendered = await response.json() as { src?: string; poster?: string; error?: string }
      if (!response.ok || !rendered.src || !rendered.poster) throw new Error(rendered.error || 'Video render failed.')
      const record = await request<LandingRecord>(landingPath)
      const draft = record?.draft as Record<string, unknown> | null
      if (!draft?.slug) throw new Error('Landing draft is missing; video could not be attached.')
      await request(landingPath, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: draft.slug, config: { ...draft, video: { src: rendered.src, poster: rendered.poster } } }),
      })
      steps.video = { status: 'generated', detail: rendered.src }
    } catch (error) {
      steps.video = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
    }
  }
  return { causeId: cause.id, steps }
}
