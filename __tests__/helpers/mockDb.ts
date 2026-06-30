// In-memory Supabase client mock.
// Implements the subset of the Supabase query builder API used by the four
// route handlers under test: sessions, join, trigger-payments, leave.

type Row = Record<string, unknown>

export function createMockDb(
  seed: Record<string, Row[]> = {},
  user: { id: string } | null = null,
) {
  const tables: Record<string, Row[]> = {}
  for (const [k, rows] of Object.entries(seed)) {
    tables[k] = rows.map(r => ({ ...r }))
  }

  const get = (t: string): Row[] => {
    if (!tables[t]) tables[t] = []
    return tables[t]
  }

  let forcedInsertError: { message: string } | null = null

  function makeSelectChain(table: string, isCount: boolean) {
    const preds: Array<(r: Row) => boolean> = []
    let lim: number | null = null

    const b: any = {
      eq: (c: string, v: unknown) => { preds.push(r => r[c] === v); return b },
      neq: (c: string, v: unknown) => { preds.push(r => r[c] !== v); return b },
      is: (c: string, v: unknown) => { preds.push(r => v === null ? r[c] == null : r[c] === v); return b },
      not: (c: string, op: string, v: unknown) => {
        if (op === 'is' && v === null) preds.push(r => r[c] != null)
        return b
      },
      in: (c: string, vs: unknown[]) => { preds.push(r => vs.includes(r[c])); return b },
      order: () => b,
      limit: (n: number) => { lim = n; return b },
      maybeSingle: async () => {
        const rows = get(table).filter(r => preds.every(p => p(r)))
        return { data: rows[0] ?? null, error: null }
      },
      single: async () => {
        const rows = get(table).filter(r => preds.every(p => p(r)))
        const data = rows[0] ?? null
        return { data, error: data ? null : { message: 'Not found', code: 'PGRST116' } }
      },
      then(resolve: any, reject?: any) {
        let rows = get(table).filter(r => preds.every(p => p(r)))
        if (lim !== null) rows = rows.slice(0, lim)
        const result = isCount
          ? { count: rows.length, data: null, error: null }
          : { data: rows, error: null }
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return b
  }

  function makeUpdateChain(table: string, data: Row) {
    const preds: Array<(r: Row) => boolean> = []
    let applied = false

    const applyOnce = () => {
      if (applied) return
      applied = true
      get(table).forEach(r => { if (preds.every(p => p(r))) Object.assign(r, data) })
    }

    const b: any = {
      eq: (c: string, v: unknown) => { preds.push(r => r[c] === v); return b },
      neq: (c: string, v: unknown) => { preds.push(r => r[c] !== v); return b },
      is: (c: string, v: unknown) => { preds.push(r => v === null ? r[c] == null : r[c] === v); return b },
      // .update().eq().is().select('id') — used for the atomic LFO claim
      select: (_cols?: string) => {
        const matching = get(table).filter(r => preds.every(p => p(r)))
        matching.forEach(r => Object.assign(r, data))
        applied = true
        return { data: matching, error: null }
      },
      then: (resolve: any, reject?: any) => {
        applyOnce()
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      },
    }
    return b
  }

  function makeDeleteChain(table: string) {
    const preds: Array<(r: Row) => boolean> = []
    const b: any = {
      eq: (c: string, v: unknown) => { preds.push(r => r[c] === v); return b },
      then: (resolve: any, reject?: any) => {
        tables[table] = get(table).filter(r => !preds.every(p => p(r)))
        return Promise.resolve({ error: null }).then(resolve, reject)
      },
    }
    return b
  }

  return {
    _tables: tables,
    // Force the next insert to return an error (used in Test 1 to simulate DB failure)
    _forceInsertError(err: { message: string } | null) { forcedInsertError = err },

    from(table: string) {
      return {
        select(cols: string, opts?: { count?: string; head?: boolean }) {
          return makeSelectChain(table, opts?.count === 'exact')
        },

        insert(data: Row) {
          if (forcedInsertError) {
            const err = forcedInsertError
            forcedInsertError = null
            return {
              select: () => ({ single: async () => ({ data: null, error: err }) }),
              then: (resolve: any, reject?: any) => Promise.resolve({ data: null, error: err }).then(resolve, reject),
            }
          }
          const row = { id: `mock-${Math.random().toString(36).slice(2, 9)}`, ...data }
          get(table).push(row)
          return {
            select: (_cols?: string) => ({ single: async () => ({ data: row, error: null }) }),
            then: (resolve: any, reject?: any) => Promise.resolve({ data: row, error: null }).then(resolve, reject),
          }
        },

        update: (data: Row) => makeUpdateChain(table, data),
        delete: () => makeDeleteChain(table),
      }
    },

    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
  }
}
