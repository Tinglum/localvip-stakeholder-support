'use client'

import * as React from 'react'

// A stored filename alone does not prove an older upload survived the move.
export function imageForSetup(url: string | null, loaded: boolean | undefined): string | null {
  return loaded === false ? null : url
}

export function useUploadedImageStatus(urls: Array<string | null>) {
  const key = JSON.stringify([...new Set(urls.filter((url): url is string => !!url))])
  const [status, setStatus] = React.useState<Record<string, boolean>>({})
  React.useEffect(() => {
    let cancelled = false
    const images: HTMLImageElement[] = []
    for (const url of JSON.parse(key) as string[]) {
      const image = new Image()
      images.push(image)
      const record = (loaded: boolean) => { if (!cancelled) setStatus(previous => ({ ...previous, [url]: loaded })) }
      image.onload = () => record(true)
      image.onerror = () => record(false)
      image.src = url
    }
    return () => { cancelled = true; for (const image of images) { image.onload = null; image.onerror = null } }
  }, [key])
  return { image: (url: string | null) => imageForSetup(url, url ? status[url] : undefined), unavailable: urls.filter((url): url is string => !!url && status[url] === false) }
}
