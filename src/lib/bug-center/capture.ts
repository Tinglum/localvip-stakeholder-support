// Lightweight client-side capture for the bug reporter widget.
// Wraps console.error / window.onerror / unhandledrejection and failed
// fetch/XHR into bounded ring buffers so each bug report carries recent
// runtime context. Installs exactly once per page session.

const RING = 20

export interface CapturedConsoleError {
  at: string
  message: string
  stack?: string
}

export interface CapturedNetworkError {
  at: string
  method: string
  url: string
  status: number | null
  statusText?: string
  error?: string
}

const consoleErrors: CapturedConsoleError[] = []
const networkErrors: CapturedNetworkError[] = []
let installed = false

function pushConsole(entry: CapturedConsoleError) {
  consoleErrors.push(entry)
  if (consoleErrors.length > RING) consoleErrors.shift()
}

function pushNetwork(entry: CapturedNetworkError) {
  networkErrors.push(entry)
  if (networkErrors.length > RING) networkErrors.shift()
}

function stringifyArg(arg: unknown): string {
  if (arg instanceof Error) return arg.message
  if (typeof arg === 'string') return arg
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

export function installBugCapture() {
  if (installed || typeof window === 'undefined') return
  installed = true

  // console.error
  const originalConsoleError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    const errArg = args.find((a) => a instanceof Error) as Error | undefined
    pushConsole({
      at: new Date().toISOString(),
      message: args.map(stringifyArg).join(' ').slice(0, 1000),
      stack: errArg?.stack?.slice(0, 2000),
    })
    originalConsoleError(...args)
  }

  // window.onerror
  window.addEventListener('error', (event) => {
    pushConsole({
      at: new Date().toISOString(),
      message: event.message || 'Uncaught error',
      stack: event.error?.stack?.slice(0, 2000),
    })
  })

  // unhandledrejection
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    pushConsole({
      at: new Date().toISOString(),
      message: `Unhandled rejection: ${stringifyArg(reason)}`.slice(0, 1000),
      stack: reason instanceof Error ? reason.stack?.slice(0, 2000) : undefined,
    })
  })

  // fetch
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET') || 'GET').toUpperCase()
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    try {
      const response = await originalFetch(input, init)
      if (!response.ok) {
        pushNetwork({
          at: new Date().toISOString(),
          method,
          url,
          status: response.status,
          statusText: response.statusText,
        })
      }
      return response
    } catch (err) {
      pushNetwork({
        at: new Date().toISOString(),
        method,
        url,
        status: null,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  // XHR
  const XHR = window.XMLHttpRequest
  if (XHR) {
    const open = XHR.prototype.open
    const send = XHR.prototype.send
    XHR.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      ;(this as unknown as { __bugMethod?: string; __bugUrl?: string }).__bugMethod = String(method || 'GET').toUpperCase()
      ;(this as unknown as { __bugUrl?: string }).__bugUrl = String(url)
      // eslint-disable-next-line prefer-rest-params
      return open.apply(this, arguments as unknown as Parameters<typeof open>)
    }
    XHR.prototype.send = function (this: XMLHttpRequest, ...rest: unknown[]) {
      const meta = this as unknown as { __bugMethod?: string; __bugUrl?: string }
      this.addEventListener('loadend', () => {
        if (this.status === 0 || this.status >= 400) {
          pushNetwork({
            at: new Date().toISOString(),
            method: meta.__bugMethod || 'GET',
            url: meta.__bugUrl || '',
            status: this.status || null,
            statusText: this.statusText,
            error: this.status === 0 ? 'Request failed' : undefined,
          })
        }
      })
      // eslint-disable-next-line prefer-rest-params
      return send.apply(this, arguments as unknown as Parameters<typeof send>)
    }
  }
}

export function snapshotConsoleErrors(): CapturedConsoleError[] {
  return [...consoleErrors]
}

export function snapshotNetworkErrors(): CapturedNetworkError[] {
  return [...networkErrors]
}

export interface BugContext {
  pageUrl: string
  userAgent: string
  viewport: string
  consoleErrors: string
  networkErrors: string
}

export function snapshotContext(): BugContext {
  return {
    pageUrl: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    consoleErrors: JSON.stringify(snapshotConsoleErrors()),
    networkErrors: JSON.stringify(snapshotNetworkErrors()),
  }
}
