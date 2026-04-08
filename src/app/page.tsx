import { redirect } from 'next/navigation'

function encodeQuery(searchParams?: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(entry => {
        if (typeof entry === 'string') query.append(key, entry)
      })
      return
    }

    if (typeof value === 'string') {
      query.set(key, value)
    }
  })

  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export default function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  redirect(`/login${encodeQuery(searchParams)}`)
}
