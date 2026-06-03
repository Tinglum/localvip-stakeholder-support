/**
 * Browser-side Supabase client.
 *
 * Returns a stubbed client whose query methods resolve to empty data instead
 * of throwing. This protects pages that still call `supabase.from(...)` while
 * the QA backend migration is in progress.
 *
 * The real Supabase client is no longer used for non-demo data — all data now
 * flows through the .NET QA backend via the hooks in `./hooks.ts`.
 */

interface StubQueryResult {
  data: unknown[] | null
  error: { message: string } | null
  count?: number
}

interface StubBuilder {
  select: (..._args: unknown[]) => StubBuilder
  insert: (..._args: unknown[]) => StubBuilder
  update: (..._args: unknown[]) => StubBuilder
  delete: (..._args: unknown[]) => StubBuilder
  upsert: (..._args: unknown[]) => StubBuilder
  eq: (..._args: unknown[]) => StubBuilder
  neq: (..._args: unknown[]) => StubBuilder
  gt: (..._args: unknown[]) => StubBuilder
  lt: (..._args: unknown[]) => StubBuilder
  gte: (..._args: unknown[]) => StubBuilder
  lte: (..._args: unknown[]) => StubBuilder
  like: (..._args: unknown[]) => StubBuilder
  ilike: (..._args: unknown[]) => StubBuilder
  in: (..._args: unknown[]) => StubBuilder
  is: (..._args: unknown[]) => StubBuilder
  or: (..._args: unknown[]) => StubBuilder
  not: (..._args: unknown[]) => StubBuilder
  contains: (..._args: unknown[]) => StubBuilder
  containedBy: (..._args: unknown[]) => StubBuilder
  filter: (..._args: unknown[]) => StubBuilder
  match: (..._args: unknown[]) => StubBuilder
  order: (..._args: unknown[]) => StubBuilder
  limit: (..._args: unknown[]) => StubBuilder
  range: (..._args: unknown[]) => StubBuilder
  single: () => Promise<StubQueryResult>
  maybeSingle: () => Promise<StubQueryResult>
  then: <T>(onFulfilled: (value: StubQueryResult) => T | PromiseLike<T>) => Promise<T>
  catch: <T>(onRejected: (reason: unknown) => T | PromiseLike<T>) => Promise<T | StubQueryResult>
}

const EMPTY_RESULT: StubQueryResult = { data: [], error: null, count: 0 }
const EMPTY_SINGLE_RESULT: StubQueryResult = { data: null, error: null }

function makeStubBuilder(): StubBuilder {
  const result = Promise.resolve(EMPTY_RESULT)

  const builder = {} as StubBuilder

  const passthrough = () => builder
  builder.select = passthrough
  builder.insert = passthrough
  builder.update = passthrough
  builder.delete = passthrough
  builder.upsert = passthrough
  builder.eq = passthrough
  builder.neq = passthrough
  builder.gt = passthrough
  builder.lt = passthrough
  builder.gte = passthrough
  builder.lte = passthrough
  builder.like = passthrough
  builder.ilike = passthrough
  builder.in = passthrough
  builder.is = passthrough
  builder.or = passthrough
  builder.not = passthrough
  builder.contains = passthrough
  builder.containedBy = passthrough
  builder.filter = passthrough
  builder.match = passthrough
  builder.order = passthrough
  builder.limit = passthrough
  builder.range = passthrough
  builder.single = () => Promise.resolve(EMPTY_SINGLE_RESULT)
  builder.maybeSingle = () => Promise.resolve(EMPTY_SINGLE_RESULT)
  builder.then = (onFulfilled) => result.then(onFulfilled)
  builder.catch = (onRejected) => result.catch(onRejected)

  return builder
}

interface StubClient {
  from: (_table: string) => StubBuilder
  auth: {
    getUser: () => Promise<{ data: { user: null }; error: null }>
    getSession: () => Promise<{ data: { session: null }; error: null }>
    signOut: () => Promise<{ error: null }>
    onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } }
  }
  rpc: (..._args: unknown[]) => Promise<StubQueryResult>
  storage: {
    from: (_bucket: string) => {
      upload: (..._args: unknown[]) => Promise<{ data: null; error: { message: string } }>
      download: (..._args: unknown[]) => Promise<{ data: null; error: { message: string } }>
      getPublicUrl: (..._args: unknown[]) => { data: { publicUrl: string } }
      remove: (..._args: unknown[]) => Promise<{ data: null; error: null }>
    }
  }
}

function makeStubClient(): StubClient {
  return {
    from: () => makeStubBuilder(),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    rpc: () => Promise.resolve(EMPTY_RESULT),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: 'Storage disabled.' } }),
        download: () => Promise.resolve({ data: null, error: { message: 'Storage disabled.' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
  }
}

export function createClient() {
  return makeStubClient() as unknown as ReturnType<typeof import('@supabase/ssr').createBrowserClient>
}
