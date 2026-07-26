import { NextRequest, NextResponse } from 'next/server'
import { fetchQaNetworkTree, fetchQaNodeDetail } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

// Detail for ONE member of a business's own network.
//
// `/api/dashboard/nodes/[id]` is operator-only, so the business portal gets its
// own scoped door: the caller must name the network root it is looking at, and
// the node has to actually be in that tree before any detail is returned. A node
// QA can't describe comes back as `{ available: false }` rather than an error —
// the row still expands, it just shows what the tree already knew.
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['business', 'admin'])
  if ('error' in access) return access.error

  const nodeId = params.id?.trim()
  const rootAccountId = request.nextUrl.searchParams.get('rootAccountId')?.trim()

  if (!nodeId || !/^\d+$/.test(nodeId)) {
    return NextResponse.json({ error: 'A numeric node id is required.' }, { status: 400 })
  }
  if (!rootAccountId || !/^\d+$/.test(rootAccountId)) {
    return NextResponse.json({ error: 'A numeric rootAccountId is required.' }, { status: 400 })
  }

  try {
    const tree = await fetchQaNetworkTree(rootAccountId, 10)
    const inNetwork =
      String(tree.rootId) === nodeId || (tree.nodes || []).some((node) => String(node.id) === nodeId)
    if (!inNetwork) {
      return NextResponse.json({ error: 'That member is not in this network.' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'This network could not be checked right now.' }, { status: 502 })
  }

  try {
    return NextResponse.json({ available: true, detail: await fetchQaNodeDetail(nodeId) })
  } catch {
    return NextResponse.json({ available: false })
  }
}
