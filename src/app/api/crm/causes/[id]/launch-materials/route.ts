import { NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { generateCauseLaunchMaterials, getCauseLaunchStatus } from '@/lib/server/cause-launch-materials'
import { fetchPortalCauseAccounts } from '@/lib/server/portal-cause'

export const runtime = 'nodejs'
export const maxDuration = 300

async function context(id: string) {
  const operator = await getOperatorRouteContext(['admin', 'field', 'launch_partner', 'community'])
  if ('error' in operator) return { error: operator.error }
  if (!operator.session.qaSession) return { error: NextResponse.json({ error: 'A QA session is required.' }, { status: 401 }) }
  if (!/^[1-9]\d*$/.test(id)) return { error: NextResponse.json({ error: 'A linked cause account is required.' }, { status: 400 }) }
  if (operator.shell === 'community') {
    const userId = Number(operator.session.localProfileId)
    const accounts = Number.isInteger(userId) && userId > 0 ? await fetchPortalCauseAccounts(userId) : null
    if (!accounts?.some(account => account.accountId === Number(id))) {
      return { error: NextResponse.json({ error: 'This cause is not linked to your account.' }, { status: 403 }) }
    }
  }
  return { id: Number(id) }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const authorized = await context(params.id)
  if ('error' in authorized) return authorized.error
  try {
    return NextResponse.json(await getCauseLaunchStatus(authorized.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load launch status.' }, { status: 502 })
  }
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const authorized = await context(params.id)
  if ('error' in authorized) return authorized.error
  try {
    const cause = await fetchQaCauseDetail(authorized.id)
    return NextResponse.json(await generateCauseLaunchMaterials(cause))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not generate launch materials.' }, { status: 502 })
  }
}
