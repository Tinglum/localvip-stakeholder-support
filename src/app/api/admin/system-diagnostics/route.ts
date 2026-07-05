import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { getStakeholderShell, isAdminProfile } from '@/lib/stakeholder-access'

type DiagnosticStatus = 'healthy' | 'warning' | 'critical'

interface DiagnosticMetric {
  label: string
  value: string | number | boolean | null
}

interface DiagnosticCheck {
  id: string
  title: string
  category: string
  status: DiagnosticStatus
  endpoint?: string
  latencyMs: number
  message: string
  detail?: string
  metrics?: DiagnosticMetric[]
}

interface ProbeResult<T = unknown> {
  ok: boolean
  status: number
  latencyMs: number
  payload: T | null
  error: string | null
  endpoint: string
}

function formatProbeFailureDetail(probe: ProbeResult<unknown>, options?: { prefix?: string }) {
  const parts: string[] = []

  if (probe.status > 0) {
    parts.push(`HTTP ${probe.status}`)
  }

  if (probe.error) {
    parts.push(`${options?.prefix || 'Returned error'}: ${probe.error}`)
  }

  return parts.join('\n')
}

function formatUpstreamWarningDetail(message: string, label = 'Upstream QA response') {
  return `${label}: ${message}`
}

function getCollectionSize(payload: unknown): number {
  if (Array.isArray(payload)) return payload.length
  if (!payload || typeof payload !== 'object') return 0

  const record = payload as Record<string, unknown>
  const collectionKeys = ['items', 'results', 'notifications', 'data', 'rows']
  for (const key of collectionKeys) {
    if (Array.isArray(record[key])) return record[key].length
  }

  return 0
}

async function probeJson<T>(
  request: NextRequest,
  path: string,
  timeoutMs = 12000,
): Promise<ProbeResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await fetch(new URL(path, request.url), {
      headers: {
        cookie: request.headers.get('cookie') || '',
        'x-system-diagnostics': '1',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    const latencyMs = Date.now() - started
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null)

    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error?: unknown }).error || `HTTP ${response.status}`)
        : typeof payload === 'string'
          ? payload
          : `HTTP ${response.status}`

      return {
        ok: false,
        status: response.status,
        latencyMs,
        payload: null,
        error: message,
        endpoint: path,
      }
    }

    return {
      ok: true,
      status: response.status,
      latencyMs,
      payload: payload as T,
      error: null,
      endpoint: path,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      payload: null,
      error: error instanceof Error ? error.message : 'Request failed.',
      endpoint: path,
    }
  } finally {
    clearTimeout(timer)
  }
}

function makeCheck(input: DiagnosticCheck): DiagnosticCheck {
  return input
}

function envCheck(label: string, value: string | undefined): DiagnosticCheck {
  return {
    id: `env_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    title: label,
    category: 'Configuration',
    status: value ? 'healthy' : 'critical',
    latencyMs: 0,
    message: value ? 'Configured.' : 'Missing configuration value.',
    detail: value ? undefined : `${label} is not set.`,
  }
}

function summarizeChecks(checks: DiagnosticCheck[]) {
  const healthy = checks.filter((check) => check.status === 'healthy').length
  const warning = checks.filter((check) => check.status === 'warning').length
  const critical = checks.filter((check) => check.status === 'critical').length
  const averageLatencyMs = checks.length > 0
    ? Math.round(checks.reduce((sum, check) => sum + check.latencyMs, 0) / checks.length)
    : 0

  const overallStatus: DiagnosticStatus = critical > 0
    ? 'critical'
    : warning > 0
      ? 'warning'
      : 'healthy'

  return {
    overallStatus,
    summary: {
      healthy,
      warning,
      critical,
      averageLatencyMs,
    },
  }
}

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!isAdminProfile(session.profile)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const shell = getStakeholderShell(session.profile)
  const checks: DiagnosticCheck[] = [
    envCheck('NEXT_PUBLIC_QA_AUTH_BASE_URL', process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL),
    envCheck('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL),
  ]

  const [
    authSessionProbe,
    qaProfileProbe,
    crmBusinessesProbe,
    crmCausesProbe,
    qaBusinessesProbe,
    materialsProbe,
    searchProbe,
    qrBridgeProbe,
    outreachBridgeProbe,
  ] = await Promise.all([
    probeJson<{
      source?: string
      profile?: { email?: string; role?: string }
      expiresAt?: string | null
      localProfileId?: string | null
    }>(request, '/api/auth/session'),
    probeJson<{
      ok?: boolean
      shell?: string
      qaSession?: { email?: string | null; expiresAt?: string | null; hasRefreshToken?: boolean }
      profile?: Record<string, unknown>
      error?: string
    }>(request, '/api/qa/debug/profile'),
    probeJson<{ items?: Array<{ rowId: string; qaBusinessId?: number | null; origin?: string; detailHref?: string }>; qaError?: string | null }>(request, '/api/crm/businesses'),
    probeJson<{ items?: Array<{ rowId: string; qaCauseId?: number | null; origin?: string }>; qaError?: string | null }>(request, '/api/crm/causes'),
    probeJson<unknown[]>(request, '/api/qa/businesses'),
    probeJson<unknown[]>(request, '/api/materials'),
    probeJson<{ results?: unknown[]; error?: string }>(request, '/api/qa/search?q=lo'),
    probeJson<unknown[]>(request, '/api/qa/dashboard/qr_codes?entity_type=business'),
    probeJson<unknown[]>(request, '/api/qa/dashboard/outreach_activities?entity_type=business'),
  ])

  checks.push(
    makeCheck({
      id: 'auth_session',
      title: 'Authenticated session',
      category: 'Identity & Access',
      endpoint: authSessionProbe.endpoint,
      status: authSessionProbe.ok && !!authSessionProbe.payload?.profile?.email ? 'healthy' : 'critical',
      latencyMs: authSessionProbe.latencyMs,
      message: authSessionProbe.ok
        ? `Signed in as ${authSessionProbe.payload?.profile?.email || 'unknown user'}.`
        : authSessionProbe.error || 'The session endpoint failed.',
      detail: authSessionProbe.ok ? undefined : formatProbeFailureDetail(authSessionProbe),
      metrics: authSessionProbe.ok ? [
        { label: 'Source', value: authSessionProbe.payload?.source || 'unknown' },
        { label: 'Role', value: authSessionProbe.payload?.profile?.role || session.profile.role },
        { label: 'Local profile', value: authSessionProbe.payload?.localProfileId ? 'linked' : 'missing' },
      ] : undefined,
    }),
  )

  checks.push(
    makeCheck({
      id: 'qa_profile',
      title: 'QA identity bridge',
      category: 'Identity & Access',
      endpoint: qaProfileProbe.endpoint,
      status: qaProfileProbe.ok && qaProfileProbe.payload?.ok ? 'healthy' : 'critical',
      latencyMs: qaProfileProbe.latencyMs,
      message: qaProfileProbe.ok && qaProfileProbe.payload?.ok
        ? 'QA profile lookup succeeded.'
        : qaProfileProbe.error || qaProfileProbe.payload?.error || 'QA profile probe failed.',
      detail: qaProfileProbe.ok && qaProfileProbe.payload?.ok
        ? undefined
        : formatProbeFailureDetail(qaProfileProbe),
      metrics: qaProfileProbe.ok ? [
        { label: 'Shell', value: qaProfileProbe.payload?.shell || shell },
        { label: 'QA email', value: qaProfileProbe.payload?.qaSession?.email || session.profile.email },
        { label: 'Refresh token', value: qaProfileProbe.payload?.qaSession?.hasRefreshToken ? 'present' : 'missing' },
      ] : undefined,
    }),
  )

  checks.push(
    makeCheck({
      id: 'crm_businesses',
      title: 'CRM business aggregation',
      category: 'Hybrid CRM',
      endpoint: crmBusinessesProbe.endpoint,
      status: !crmBusinessesProbe.ok
        ? 'critical'
        : crmBusinessesProbe.payload?.qaError
          ? 'warning'
          : 'healthy',
      latencyMs: crmBusinessesProbe.latencyMs,
      message: !crmBusinessesProbe.ok
        ? crmBusinessesProbe.error || 'The CRM businesses route failed.'
        : crmBusinessesProbe.payload?.qaError
          ? `Businesses loaded with QA warning: ${crmBusinessesProbe.payload.qaError}`
          : 'CRM businesses list loaded successfully.',
      detail: !crmBusinessesProbe.ok
        ? formatProbeFailureDetail(crmBusinessesProbe)
        : crmBusinessesProbe.payload?.qaError
          ? formatUpstreamWarningDetail(crmBusinessesProbe.payload.qaError)
          : undefined,
      metrics: crmBusinessesProbe.ok ? [
        { label: 'Rows', value: Array.isArray(crmBusinessesProbe.payload?.items) ? crmBusinessesProbe.payload.items.length : 0 },
      ] : undefined,
    }),
  )

  checks.push(
    makeCheck({
      id: 'crm_causes',
      title: 'CRM cause aggregation',
      category: 'Hybrid CRM',
      endpoint: crmCausesProbe.endpoint,
      status: !crmCausesProbe.ok
        ? 'critical'
        : crmCausesProbe.payload?.qaError
          ? 'warning'
          : 'healthy',
      latencyMs: crmCausesProbe.latencyMs,
      message: !crmCausesProbe.ok
        ? crmCausesProbe.error || 'The CRM causes route failed.'
        : crmCausesProbe.payload?.qaError
          ? `Causes loaded with QA warning: ${crmCausesProbe.payload.qaError}`
          : 'CRM causes list loaded successfully.',
      detail: !crmCausesProbe.ok
        ? formatProbeFailureDetail(crmCausesProbe)
        : crmCausesProbe.payload?.qaError
          ? formatUpstreamWarningDetail(crmCausesProbe.payload.qaError)
          : undefined,
      metrics: crmCausesProbe.ok ? [
        { label: 'Rows', value: Array.isArray(crmCausesProbe.payload?.items) ? crmCausesProbe.payload.items.length : 0 },
      ] : undefined,
    }),
  )

  const sampleBusiness = Array.isArray(crmBusinessesProbe.payload?.items) ? crmBusinessesProbe.payload.items[0] : null
  if (!sampleBusiness) {
    checks.push(
      makeCheck({
        id: 'sample_business_detail',
        title: 'Sample business detail handshake',
        category: 'Hybrid CRM',
        status: 'warning',
        latencyMs: 0,
        message: 'No business rows exist yet, so detail-route cooperation could not be sampled.',
        detail: crmBusinessesProbe.payload?.qaError
          ? formatUpstreamWarningDetail(crmBusinessesProbe.payload.qaError, 'Sampling blocked by QA business response')
          : undefined,
      }),
    )
  } else {
    const detailPath = `/api/crm/businesses/${encodeURIComponent(sampleBusiness.rowId)}${sampleBusiness.qaBusinessId != null ? `?qaId=${sampleBusiness.qaBusinessId}` : ''}`
    const detailProbe = await probeJson<{
      business?: { name?: string }
      localBusinessId?: string | null
      qaBusinessId?: number | null
      origin?: string
      readOnly?: boolean
    }>(request, detailPath)

    checks.push(
      makeCheck({
        id: 'sample_business_detail',
        title: 'Sample business detail handshake',
        category: 'Hybrid CRM',
        endpoint: detailProbe.endpoint,
        status: detailProbe.ok && !!detailProbe.payload?.business ? 'healthy' : 'critical',
        latencyMs: detailProbe.latencyMs,
        message: detailProbe.ok && detailProbe.payload?.business
          ? `Loaded sample business detail for ${detailProbe.payload.business.name || 'sample record'}.`
          : detailProbe.error || 'Sample business detail route failed.',
        detail: detailProbe.ok && detailProbe.payload?.business ? undefined : formatProbeFailureDetail(detailProbe),
        metrics: detailProbe.ok ? [
          { label: 'Origin', value: detailProbe.payload?.origin || 'unknown' },
          { label: 'QA id', value: detailProbe.payload?.qaBusinessId ?? 'none' },
          { label: 'Local row', value: detailProbe.payload?.localBusinessId ? 'present' : 'none' },
        ] : undefined,
      }),
    )

    if (detailProbe.ok && detailProbe.payload?.localBusinessId) {
      const localStateProbe = await probeJson<{ stakeholders?: unknown[]; tasks?: unknown[]; notes?: unknown[] }>(
        request,
        `/api/crm/businesses/${encodeURIComponent(detailProbe.payload.localBusinessId)}/local-state`,
      )

      checks.push(
        makeCheck({
          id: 'sample_business_workspace',
          title: 'Sample business workspace state',
          category: 'Hybrid CRM',
          endpoint: localStateProbe.endpoint,
          status: localStateProbe.ok ? 'healthy' : 'critical',
          latencyMs: localStateProbe.latencyMs,
          message: localStateProbe.ok
            ? 'Local workspace state for a sample business loaded successfully.'
            : localStateProbe.error || 'The sample business local-state route failed.',
          detail: localStateProbe.ok ? undefined : formatProbeFailureDetail(localStateProbe),
          metrics: localStateProbe.ok ? [
            { label: 'Stakeholders', value: Array.isArray(localStateProbe.payload?.stakeholders) ? localStateProbe.payload.stakeholders.length : 0 },
            { label: 'Tasks', value: Array.isArray(localStateProbe.payload?.tasks) ? localStateProbe.payload.tasks.length : 0 },
            { label: 'Notes', value: Array.isArray(localStateProbe.payload?.notes) ? localStateProbe.payload.notes.length : 0 },
          ] : undefined,
        }),
      )
    } else {
      checks.push(
        makeCheck({
          id: 'sample_business_workspace',
          title: 'Sample business workspace state',
          category: 'Hybrid CRM',
          status: detailProbe.ok && detailProbe.payload?.qaBusinessId ? 'warning' : 'critical',
          latencyMs: 0,
          message: detailProbe.ok && detailProbe.payload?.qaBusinessId
            ? 'Sample business is QA-only, so the page will rely on QA fallback workspace data instead of local-state.'
            : 'A sample workspace route could not be evaluated.',
          detail: !detailProbe.ok ? formatProbeFailureDetail(detailProbe) : undefined,
        }),
      )
    }
  }

  checks.push(
    makeCheck({
      id: 'qa_business_index',
      title: 'QA business directory',
      category: 'QA Bridges',
      endpoint: qaBusinessesProbe.endpoint,
      status: qaBusinessesProbe.ok ? 'healthy' : 'critical',
      latencyMs: qaBusinessesProbe.latencyMs,
      message: qaBusinessesProbe.ok
        ? 'QA business list is reachable.'
        : qaBusinessesProbe.error || 'The QA business list failed.',
      detail: qaBusinessesProbe.ok ? undefined : formatProbeFailureDetail(qaBusinessesProbe),
      metrics: qaBusinessesProbe.ok ? [
        { label: 'Rows', value: getCollectionSize(qaBusinessesProbe.payload) },
      ] : undefined,
    }),
  )

  checks.push(
    makeCheck({
      id: 'materials_library',
      title: 'Materials library bridge',
      category: 'QA Bridges',
      endpoint: materialsProbe.endpoint,
      status: materialsProbe.ok ? 'healthy' : 'critical',
      latencyMs: materialsProbe.latencyMs,
      message: materialsProbe.ok
        ? 'Materials endpoint responded successfully.'
        : materialsProbe.error || 'The materials endpoint failed.',
      detail: materialsProbe.ok ? undefined : formatProbeFailureDetail(materialsProbe),
      metrics: materialsProbe.ok ? [
        { label: 'Rows', value: getCollectionSize(materialsProbe.payload) },
      ] : undefined,
    }),
  )

  checks.push(
    makeCheck({
      id: 'qa_search',
      title: 'Global QA search bridge',
      category: 'QA Bridges',
      endpoint: searchProbe.endpoint,
      status: !searchProbe.ok
        ? 'critical'
        : searchProbe.payload?.error
          ? 'warning'
          : 'healthy',
      latencyMs: searchProbe.latencyMs,
      message: !searchProbe.ok
        ? searchProbe.error || 'The QA search route failed.'
        : searchProbe.payload?.error
          ? `Search returned an application warning: ${searchProbe.payload.error}`
          : 'QA search endpoint responded successfully.',
      detail: !searchProbe.ok
        ? formatProbeFailureDetail(searchProbe)
        : searchProbe.payload?.error
          ? formatUpstreamWarningDetail(searchProbe.payload.error)
          : undefined,
      metrics: searchProbe.ok ? [
        { label: 'Results', value: getCollectionSize(searchProbe.payload) },
      ] : undefined,
    }),
  )

  checks.push(
    makeCheck({
      id: 'qr_bridge',
      title: 'QR code table bridge',
      category: 'QA Bridges',
      endpoint: qrBridgeProbe.endpoint,
      status: qrBridgeProbe.ok ? 'healthy' : 'critical',
      latencyMs: qrBridgeProbe.latencyMs,
      message: qrBridgeProbe.ok
        ? 'QR code bridge query succeeded.'
        : qrBridgeProbe.error || 'The QR code bridge failed.',
      detail: qrBridgeProbe.ok ? undefined : formatProbeFailureDetail(qrBridgeProbe),
      metrics: qrBridgeProbe.ok ? [
        { label: 'Rows', value: getCollectionSize(qrBridgeProbe.payload) },
      ] : undefined,
    }),
  )

  checks.push(
    makeCheck({
      id: 'outreach_bridge',
      title: 'Outreach activity bridge',
      category: 'QA Bridges',
      endpoint: outreachBridgeProbe.endpoint,
      status: outreachBridgeProbe.ok ? 'healthy' : 'critical',
      latencyMs: outreachBridgeProbe.latencyMs,
      message: outreachBridgeProbe.ok
        ? 'Outreach activity bridge query succeeded.'
        : outreachBridgeProbe.error || 'The outreach bridge failed.',
      detail: outreachBridgeProbe.ok ? undefined : formatProbeFailureDetail(outreachBridgeProbe),
      metrics: outreachBridgeProbe.ok ? [
        { label: 'Rows', value: getCollectionSize(outreachBridgeProbe.payload) },
      ] : undefined,
    }),
  )

  const { overallStatus, summary } = summarizeChecks(checks)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    profile: {
      email: session.profile.email,
      role: session.profile.role,
      shell,
      source: session.source,
    },
    overallStatus,
    summary,
    checks,
  })
}
