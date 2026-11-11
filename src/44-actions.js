/* ============================================================================
   Hermes actions — one card per tool that actually ran.

   The point of the card is evidence, not decoration: the tool, the exact
   statement or script that ran, its real exit code, its real output, and how
   long it took. A failure is rendered as a failure, with the error the runtime
   produced — the card never turns a red run green.
   ========================================================================== */

const ACTION_LABEL = {
  query_table: 'SQL',
  run_script: 'Script',
  mcp_call: 'MCP'
}


/* ------------------------------------------------------------ highlighting

   One tokenizer for the three languages a card can hold. It runs over the
   string and returns React children — never HTML — so a query containing
   markup renders as text, which is what the reader typed. */

const HL_KEYWORDS = {
  sql: 'select from where group by order having limit offset join left right inner outer full on using as and or not in is null like between distinct union all case when then else end with asc desc count sum avg min max cast round abs over partition row_number date_trunc strftime',
  python: 'def return if elif else for while in not and or import from as class with try except finally raise yield lambda None True False is pass break continue global del assert async await print len sum min max abs round sorted list dict set tuple str int float range enumerate zip open',
  bash: 'if then else elif fi for while do done case esac function return export local echo cd ls cat grep awk sed mkdir rm cp mv curl git sudo exit set source'
}

// Four groups, always in this order: comment, string, number, keyword. The
// mapping is positional, so a non-capturing group anywhere in here would shift
// every match one class to the right (keywords rendered as numbers).
const HL_RE = (lang) => {
  const kw = HL_KEYWORDS[lang].split(' ').join('|')
  const parts = lang === 'python'
    ? ['(#[^\\n]*)', "(\'\'\'[\\s\\S]*?\'\'\'|\'[^\'\\n]*\'|\"[^\"\\n]*\")", '(\\b\\d+(?:\\.\\d+)?\\b)', `(\\b(?:${kw})\\b)`]
    : lang === 'bash'
      ? ['(#[^\\n]*)', "(\'[^\']*\'|\"[^\"]*\")", '(\\b\\d+(?:\\.\\d+)?\\b)', `(\\b(?:${kw})\\b)`]
      : ['(--[^\\n]*)', "(\'[^\']*\'|\"[^\"]*\")", '(\\b\\d+(?:\\.\\d+)?\\b)', `(\\b(?:${kw})\\b)`]
  return new RegExp(parts.join('|'), 'gi')
}

const HL_CLASS = [null, 'nb-hl-com', 'nb-hl-str', 'nb-hl-num', 'nb-hl-kw']

function highlight(code, lang) {
  const text = String(code || '')
  if (lang === 'json' || lang === 'text' || !text || !HL_KEYWORDS[lang]) return [text]
  const re = HL_RE(lang)
  const out = []
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue }
    if (m.index > last) out.push(text.slice(last, m.index))
    const g = m[1] ? 1 : m[2] ? 2 : m[3] ? 3 : 4
    out.push(jsx('span', { key: `h${i++}`, className: HL_CLASS[g], children: m[0] }))
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function codeLang(action) {
  if (action.tool === 'query_table') return 'sql'
  if (action.tool === 'run_script') return action.language === 'bash' ? 'bash' : 'python'
  return 'json'
}

function ActionCard({ action, notebook, onSay, onSaved }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const view = result || action
  const ok = !!view.ok
  const engine = view.engine ? ` · ${view.engine}` : ''
  const tool = view.tool || 'query_table'
  const language = view.language === 'bash' ? 'Bash' : tool === 'run_script' ? 'Python' : ''
  const title = tool === 'query_table'
    ? `SQL${engine}`
    : tool === 'run_script' ? `${language} sandbox` : `MCP · ${view.server || 'server'}`
  const input = tool === 'query_table'
    ? (view.sql || '')
    : tool === 'run_script' ? (view.code || '')
      : JSON.stringify({ server: view.server, tool: view.tool_name, arguments: view.arguments }, null, 2)
  const ms = view.ms

  const output = () => {
    if (tool === 'query_table') {
      if (!ok) return el('div', { className: 'nb-act-err', children: view.error || 'the query failed' })
      const cols = view.columns || []
      const rows = view.rows || []
      const table = el('div', { className: 'nb-act-tablewrap' },
        el('table', { className: 'nb-act-table' },
          el('thead', null, el('tr', null, cols.map((c, i) => el('th', { key: i, children: String(c) })))),
          el('tbody', null, rows.slice(0, 40).map((r, i) => el('tr', { key: i },
            r.map((cell, k) => el('td', { key: k, children: cell === null ? '∅' : String(cell) })))))))
      return view.truncated
        ? el('div', null, table, el('div', { className: 'nb-act-note', children: 'first 40 of a longer result' }))
        : table
    }
    const text = view.out || ''
    const err = tool === 'run_script' ? (view.err || '') : (ok ? '' : view.error || '')
    return el('div', null,
      text ? el('pre', { className: 'nb-act-pre', children: text }) : null,
      err ? el('pre', { className: 'nb-act-pre nb-act-err', children: err }) : null,
      !text && !err ? el('div', { className: 'nb-act-note', children: 'no output' }) : null)
  }

  const rerun = async () => {
    setBusy(true)
    try {
      const out = await api('/agent/rerun', {
        method: 'POST',
        body: {
          notebook: notebook.id, tool,
          arguments: tool === 'query_table' ? { sql: view.sql }
            : tool === 'run_script' ? { language: view.language || 'python', code: view.code }
              : { server: view.server, tool: view.tool_name, arguments: view.arguments }
        },
        timeoutMs: 90000
      })
      setResult(out.action)
      setOpen(true)
      if (onSay) onSay(`${title} re-ran · ${out.action.ok ? 'ok' : 'failed'}`)
    } catch (e) {
      if (onSay) onSay(`could not re-run: ${e.message || e}`)
    } finally { setBusy(false) }
  }

  const saveAsSource = async () => {
    const body = tool === 'query_table' && ok
      ? (view.columns || []).length
        ? [view.columns.join(' | '), ...(view.rows || []).map((r) => r.join(' | '))].join('\n')
        : ''
      : (view.out || '')
    if (!body.trim()) { if (onSay) onSay('nothing to save from this run'); return }
    setBusy(true)
    try {
      await api('/note', {
        method: 'POST',
        body: { notebook: notebook.id, text: body, title: `Result · ${title}` },
        timeoutMs: 60000
      })
      if (onSay) onSay('saved as a source — it is searchable now')
      if (onSaved) onSaved()
    } catch (e) {
      if (onSay) onSay(`could not save: ${e.message || e}`)
    } finally { setBusy(false) }
  }

  return el('div', { className: 'nb-act', 'data-ok': ok ? 'true' : 'false' },
    el('button', {
      type: 'button', className: 'nb-act-head',
      onClick: () => setOpen((o) => !o),
      'aria-expanded': open,
      title: open ? 'Hide the details' : 'Show what ran'
    },
    el('span', { className: 'nb-act-status', 'aria-hidden': 'true',
      children: busy ? '◐' : ok ? '✓' : '✕' }),
    el('span', { className: 'nb-act-title', children: title }),
    el('span', { className: 'nb-act-meta',
      // the right noun per tool: an exit code is a script's vocabulary, a row
      // count is a query's
      children: tool === 'query_table'
        ? (ok ? `${(view.rows || []).length} row${(view.rows || []).length === 1 ? '' : 's'}${view.truncated ? '+' : ''}` : 'failed')
        : tool === 'run_script' ? (ok ? 'exit 0' : `exit ${view.exit === null || view.exit === undefined ? '?' : view.exit}`) : (ok ? 'ok' : 'failed') }),
    ms !== undefined && ms !== null ? el('span', { className: 'nb-act-ms', children: `${ms}ms` }) : null,
    jsx('span', { className: 'nb-act-chev', 'aria-hidden': 'true',
      children: jsx(Glyph, { name: 'chevron', size: 13 }) })),
    open
      ? el('div', { className: 'nb-act-body' },
          input ? el('div', null,
            el('div', { className: 'nb-act-label', children: tool === 'query_table' ? 'Statement' : 'Code' }),
            el('pre', { className: 'nb-act-pre nb-act-in', children: highlight(input, codeLang(view)) })) : null,
          el('div', { className: 'nb-act-label', children: 'Result' }),
          output(),
          el('div', { className: 'nb-act-foot' },
            jsx(Btn, { size: 'sm', icon: 'refresh', disabled: busy, onClick: rerun, children: 'Re-run' }),
            tool === 'query_table' && ok
              ? jsx(Btn, { size: 'sm', icon: 'download', onClick: () => {
                  const cols = view.columns || []
                  const rows = view.rows || []
                  const csv = [cols.join(','), ...rows.map((r) => r.map((c) => {
                    const v = c === null || c === undefined ? '' : String(c)
                    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
                  }).join(','))].join('\n')
                  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${tool}-result.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                  if (onSay) onSay(`exported ${rows.length} rows as CSV`)
                }, children: 'Export CSV' })
              : null,
            jsx(Btn, { size: 'sm', icon: 'note', disabled: busy, onClick: saveAsSource, children: 'Save as source' }),
            jsx(Btn, { size: 'sm', icon: 'copy', onClick: () => copyText(
              tool === 'query_table' && ok
                ? [view.columns.join('\t'), ...(view.rows || []).map((r) => r.join('\t'))].join('\n')
                : (view.out || view.code || ''), onSay), children: 'Copy output' })))
      : null)
}

/* --------------------------------------------------------------- council

   The verdict band under a council answer. It is deliberately quiet: one line
   of judgement and, when something did not hold, the exact claims the second
   pass could not support — never a badge that looks like a second opinion from
   a different model. */

const COUNCIL_LABEL = { holds: 'every claim is supported', partly: 'some claims are not supported', fails: 'contradicts the passages' }

function CouncilBand({ council, onSay }) {
  if (!council) return null
  if (!council.ok) {
    return el('div', { className: 'nb-council', 'data-verdict': 'unknown' },
      el('span', { className: 'nb-council-dot', 'aria-hidden': 'true' }),
      el('span', { children: `Council could not check this answer: ${council.error || 'no verdict'}` }))
  }
  const v = council.verdict || 'partly'
  const bad = council.unsupported || []
  return el('div', { className: 'nb-council', 'data-verdict': v },
    el('span', { className: 'nb-council-dot', 'aria-hidden': 'true' }),
    el('span', { className: 'nb-council-lab', children: 'Council' }),
    el('span', { children: COUNCIL_LABEL[v] || v }),
    el('span', { className: 'nb-council-note', children: council.model || 'second pass' }),
    bad.length
      ? el('ul', { className: 'nb-council-bad' }, bad.map((c, i) => el('li', { key: i, children: c })))
      : null,
    council.note ? el('div', { className: 'nb-council-note', children: council.note }) : null)
}
