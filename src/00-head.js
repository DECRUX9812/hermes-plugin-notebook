/**
 * HERMES NOTEBOOK — a grounded research studio inside Desktop.
 *
 * NotebookLM's shape, Hermes' rules: sources go in, everything else is derived
 * from them and cites them. Three columns and one status bar:
 *
 *   rail     notebooks, then this notebook's sources with the model's own
 *            auto-labels; search and label filters narrow them
 *   main     grounded Q&A with numbered citations that open the source they
 *            cite, or the viewer for whatever artifact is selected
 *   studio   the twelve outputs, each with the state it is actually in
 *            (not generated / writing / ready, with its real timestamp)
 *
 * The second surface is the lab: the same shell, the same status bar, and a
 * fleet deck that measures eight hosts over the audited ssh transport — a
 * terminal, service control, a file browser and VM snapshots, all of which
 * report the real exit code instead of a green tick.
 *
 * Every pixel here resolves through the app's theme variables, so the page
 * follows dark/light and the user's accent without a second stylesheet.
 */
import * as SDK from '@hermes/plugin-sdk'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

/* Namespace import, then local constants with the host's own strings as the
 * preferred source. A named import that the running build does not export is a
 * module-level SyntaxError — the plugin then appears in no list at all, with no
 * error you can see from outside. This shape degrades instead: a missing area
 * constant falls back to the wire string it maps to, and a missing component
 * becomes null (the settings page simply drops that row).
 */
const host = SDK.host
const ROUTES_AREA = SDK.ROUTES_AREA || 'routes'
const SIDEBAR_NAV_AREA = SDK.SIDEBAR_NAV_AREA || 'sidebar.nav'
const PALETTE_AREA = SDK.PALETTE_AREA || 'palette'
const STATUSBAR_AREAS = SDK.STATUSBAR_AREAS || { left: 'statusBar.left', right: 'statusBar.right' }
const TRANSCRIPT_DIRECTIVE_AREA = SDK.TRANSCRIPT_DIRECTIVE_AREA || 'transcript.directives'

const ID = 'hermes-notebook'
const ROUTE = '/notebook'

/* ---------------------------------------------------------------- tokens */

const T = {
  text: 'var(--ui-text-primary, #e9e9ef)',
  text2: 'var(--ui-text-secondary, #b6b6c2)',
  text3: 'var(--ui-text-tertiary, #8b8b99)',
  text4: 'var(--ui-text-quaternary, #6d6d7a)',
  accent: 'var(--ui-accent, #8b93ff)',
  line: 'var(--ui-stroke-secondary, rgba(233,233,239,0.11))',
  lineSoft: 'var(--ui-stroke-tertiary, rgba(233,233,239,0.07))',
  card: 'var(--ui-bg-secondary, rgba(233,233,239,0.045))',
  cardDeep: 'var(--ui-bg-tertiary, rgba(233,233,239,0.03))',
  ok: 'var(--ui-success, #3fb950)',
  warn: 'var(--ui-warning, #d29922)',
  danger: 'var(--ui-danger, #f85149)',
  cyan: 'var(--ui-cyan, #56b6c2)',
  purple: 'var(--ui-purple, #9e94d5)'
}

const CSS = `
/* ============================================================================
   SYSTEM: "Filed" — editorial-technical instrument.
   Adapted from Open Design packages "tom-modern" (structure: sharp 0-radius
   geometry, hairline rules, hard offset elevation, mono eyebrows, single accent,
   graph-paper ground) and "atelier-zero" (editorial metadata: plate numbers,
   filed-under stamps, Roman-numeral index, one accent period per heading).
   Every value still resolves through the app's own tokens, so the page follows
   the user's light/dark theme and accent. No pinned surface hexes.
   ========================================================================== */

.nb-root{
  --nb-rail: 300px; --nb-studio: 392px;
  --nb-hair: color-mix(in srgb, ${T.text} 19%, transparent);
  --nb-hair-soft: color-mix(in srgb, ${T.text} 11%, transparent);
  --nb-wash: color-mix(in srgb, ${T.text} 3.5%, transparent);
  --nb-wash-2: color-mix(in srgb, ${T.text} 6%, transparent);
  --nb-gridline: color-mix(in srgb, ${T.text} 5.5%, transparent);
  display:flex; flex-direction:column; height:100%; min-height:0;
  color:${T.text}; font-size:16px; line-height:1.5;
  font-variant-numeric: tabular-nums;
}
.nb-root *{box-sizing:border-box}
.nb-root :focus-visible{outline:2px solid ${T.accent}; outline-offset:2px; border-radius:0}
.nb-mono{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-ligatures:none}
.nb-num{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums}

/* every section label on the page is the same mono eyebrow */
.nb-meta{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.18em;
  text-transform:uppercase;color:${T.text3};font-weight:600}

/* ------------------------------------------------------------------ app bar */
.nb-bar{display:flex;align-items:center;gap:16px;height:52px;flex:0 0 52px;
  padding:0 18px;border-bottom:1px solid var(--nb-hair)}
.nb-brand{display:flex;align-items:center;gap:12px;min-width:0}
.nb-mark{width:24px;height:24px;display:grid;place-items:center;flex:0 0 auto;
  background:transparent;border:1px solid color-mix(in srgb,${T.accent} 60%, transparent);color:${T.accent}}
.nb-brandname{font-family:var(--ui-font-mono,ui-monospace,monospace);font-weight:700;letter-spacing:.2em;
  font-size:11.5px;text-transform:uppercase;color:${T.text}}
.nb-crumb{font-family:var(--ui-font-mono,ui-monospace,monospace);color:${T.text3};font-size:11.5px;
  letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  border-left:1px solid var(--nb-hair);padding-left:12px}
.nb-crumb b{color:${T.text2};font-weight:600}
.nb-spacer{flex:1 1 auto}
.nb-actions{display:flex;align-items:center;gap:10px}

/* ---------------------------------------------------------------- controls */
.nb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:32px;padding:0 14px;border-radius:0;cursor:pointer;
  font-size:12.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;
  font-family:var(--ui-font-mono,ui-monospace,monospace);
  border:1px solid var(--nb-hair);background:transparent;color:${T.text};
  transition:background .12s ease,border-color .12s ease,box-shadow .12s ease}
.nb-btn:hover{background:var(--nb-wash-2);border-color:color-mix(in srgb,${T.text} 30%, transparent)}
.nb-btn:active{transform:translateY(1px)}
.nb-btn[disabled]{opacity:.4;cursor:not-allowed}
.nb-btn[data-variant=primary]{background:${T.accent};border-color:${T.accent};
  color:#0b0c11;font-weight:700}
.nb-btn[data-variant=primary]:hover{background:color-mix(in srgb,${T.accent} 86%, ${T.text});
  border-color:color-mix(in srgb,${T.accent} 86%, ${T.text});box-shadow:3px 3px 0 color-mix(in srgb,${T.text} 12%, transparent)}
.nb-btn[data-variant=primary][disabled]{background:transparent;border-color:var(--nb-hair);color:${T.text3}}
.nb-btn[data-variant=primary][disabled]:hover{box-shadow:none}
.nb-btn[data-variant=ghost]{background:transparent;border-color:transparent;color:${T.text2}}
.nb-btn[data-variant=ghost]:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-btn[data-size=sm]{min-height:28px;padding:0 10px;font-size:11px}
.nb-icon{width:32px;height:32px;min-height:32px;padding:0;border-radius:0;display:grid;place-items:center;
  cursor:pointer;border:1px solid transparent;background:transparent;color:${T.text3}}
.nb-icon:hover{border-color:var(--nb-hair);background:var(--nb-wash);color:${T.text}}
.nb-icon[data-active=true]{border-color:color-mix(in srgb,${T.accent} 50%, transparent);color:${T.accent}}

.nb-seg{display:inline-flex;border:1px solid var(--nb-hair);background:transparent;padding:0}
.nb-seg[data-fill="true"]{display:flex;width:100%}
.nb-seg[data-fill="true"] > button{flex:1;justify-content:center}
.nb-seg > button{min-height:32px;padding:0 12px;border:0;border-right:1px solid var(--nb-hair-soft);
  background:transparent;color:${T.text3};cursor:pointer;
  font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:650;
  letter-spacing:.14em;text-transform:uppercase;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  transition:background .12s ease,color .12s ease}
.nb-seg > button:last-child{border-right:0}
.nb-seg > button:hover{color:${T.text};background:var(--nb-wash)}
.nb-seg > button[aria-selected=true]{background:color-mix(in srgb,${T.text} 10%, transparent);color:${T.text};
  box-shadow:inset 0 -2px 0 ${T.accent}}

.nb-field{display:flex;align-items:center;gap:9px;height:34px;padding:0 10px;border-radius:0;
  border:1px solid var(--nb-hair);background:transparent;color:${T.text3}}
.nb-field:focus-within{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}
.nb-field input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;
  color:${T.text};font-size:14px;font-family:inherit}
.nb-field input::placeholder{color:${T.text4}}

/* ------------------------------------------------------------------- body */
.nb-body{flex:1 1 auto;display:grid;grid-template-columns:var(--nb-rail) minmax(0,1fr) var(--nb-studio);
  min-height:0;overflow:hidden}
.nb-col{min-width:0;min-height:0;display:flex;flex-direction:column}
/* The graph-paper ground belongs to the title block (chrome), not to the
   reading surface: long-form text and a transcript read better on a flat
   canvas, and the grid still sets the page's character at the top. */
.nb-body > main{background:transparent}
.nb-main-head{background-image:
  linear-gradient(var(--nb-gridline) 1px, transparent 1px),
  linear-gradient(90deg, var(--nb-gridline) 1px, transparent 1px);
  background-size:24px 24px;background-position:-1px -1px}
.nb-rail{position:relative;border-right:1px solid var(--nb-hair)}
.nb-studio{position:relative;border-left:1px solid var(--nb-hair);background:var(--nb-wash)}
.nb-fade{position:absolute;left:0;right:0;bottom:0;height:38px;pointer-events:none;
  background:linear-gradient(to top, color-mix(in srgb, ${T.text} 5%, ${T.card}), transparent)}
.nb-pane-head{display:flex;align-items:center;gap:8px;height:40px;flex:0 0 40px;padding:0 14px;
  border-bottom:1px solid var(--nb-hair)}
.nb-pane-head .nb-meta{flex:1}
.nb-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
.nb-pad{padding:12px}

/* ------------------------------------------------------------------- rail */
.nb-nbrow{display:grid;grid-template-columns:24px minmax(0,1fr);gap:12px;align-items:start;width:100%;
  text-align:left;cursor:pointer;border:0;border-left:2px solid transparent;background:transparent;
  border-radius:0;padding:10px 12px 11px 10px;color:${T.text};
  border-bottom:1px solid var(--nb-hair-soft)}
.nb-nbrow:hover{background:var(--nb-wash)}
.nb-nbrow[aria-current=true]{background:var(--nb-wash-2);border-left-color:${T.accent}}
.nb-nbtitle{font-size:14px;font-weight:600;line-height:1.32;color:${T.text2};letter-spacing:-.005em;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-nbrow[aria-current=true] .nb-nbtitle{color:${T.text}}
.nb-nbsub{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.04em;
  color:${T.text3};margin-top:4px;display:block}
.nb-avatar{width:24px;height:24px;flex:0 0 auto;display:grid;place-items:center;
  font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:600;
  letter-spacing:.04em;color:${T.text3};border:1px solid var(--nb-hair);background:transparent}
.nb-nbrow[aria-current=true] .nb-avatar{color:${T.accent};border-color:color-mix(in srgb,${T.accent} 55%, transparent)}

.nb-src{display:grid;grid-template-columns:26px minmax(0,1fr);gap:10px;width:100%;text-align:left;
  cursor:pointer;border:0;border-left:2px solid transparent;border-radius:0;
  padding:9px 12px 10px 10px;background:transparent;color:${T.text};
  border-bottom:1px solid var(--nb-hair-soft)}
.nb-src:hover{background:var(--nb-wash)}
.nb-src[data-on=true]{border-left-color:${T.accent};background:var(--nb-wash-2)}
.nb-cite{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:600;
  letter-spacing:.04em;color:${T.text3};padding-top:3px}
.nb-src[data-on=true] .nb-cite{color:${T.accent}}
.nb-src-title{font-size:13.5px;font-weight:550;line-height:1.36;color:${T.text};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-src-meta{display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap}

/* chips are labels, not pills: mono, hairline, square */
.nb-chip{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 6px;border-radius:0;
  font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:${T.text3};
  background:transparent;border:1px solid var(--nb-hair-soft);white-space:nowrap}
.nb-chip[data-tone=accent]{color:${T.accent};background:transparent;
  border-color:color-mix(in srgb,${T.accent} 50%, transparent)}
.nb-chip[data-tone=ok]{color:${T.ok};background:transparent;
  border-color:color-mix(in srgb,${T.ok} 40%, transparent)}
.nb-chip[data-tone=warn]{color:${T.warn};background:transparent;
  border-color:color-mix(in srgb,${T.warn} 42%, transparent)}
.nb-chip[data-tone=danger]{color:${T.danger};background:transparent;
  border-color:color-mix(in srgb,${T.danger} 42%, transparent)}
.nb-cite-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;
  padding-top:10px;border-top:1px solid var(--nb-hair-soft)}
.nb-cite-row > .nb-meta{color:${T.text4};flex:1 0 100%;margin-bottom:2px}
.nb-citechip{text-transform:none;letter-spacing:.02em;font-size:10.5px;height:24px;
  font-family:inherit;font-weight:550;color:${T.text2};gap:6px}
.nb-citechip b{font-family:var(--ui-font-mono,ui-monospace,monospace);color:${T.accent};font-weight:650;
  letter-spacing:.06em;font-size:10.5px}
.nb-chip[data-click=true]{cursor:pointer;min-height:32px;height:32px;padding:0 10px;font-size:10px}
.nb-chip[data-click=true]:hover{background:var(--nb-wash-2);color:${T.text};border-color:var(--nb-hair)}
.nb-chip[data-click=true][data-tone=accent]:hover{color:${T.accent}}
.nb-chip[data-click=true][aria-pressed=true]{background:color-mix(in srgb,${T.accent} 16%, transparent);color:${T.accent};
  border-color:color-mix(in srgb,${T.accent} 55%, transparent)}

/* ------------------------------------------------------- title block (main) */
.nb-main-head{padding:18px 26px 0;border-bottom:1px solid var(--nb-hair);flex:0 0 auto;position:relative;
  background:color-mix(in srgb, ${T.text} 1.5%, transparent)}
.nb-filed{display:flex;align-items:center;gap:10px;margin-bottom:12px;
  font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:600;
  letter-spacing:.2em;text-transform:uppercase;color:${T.text3}}
.nb-filed b{color:${T.text2};font-weight:600}
.nb-filed i{flex:1;height:1px;background:var(--nb-hair);display:block}
.nb-h1{font-size:30px;font-weight:700;letter-spacing:-.035em;line-height:1.06;margin:0;max-width:26ch;
  text-wrap:balance}
.nb-h1::after{content:"";display:inline-block;width:6px;height:6px;margin-left:9px;
  background:${T.accent};vertical-align:baseline;position:relative;bottom:2px}
.nb-sub{color:${T.text2};font-size:14px;line-height:1.55;margin:10px 0 0;max-width:66ch}
.nb-strip{display:flex;align-items:stretch;margin:16px 0 0;border-top:1px solid var(--nb-hair);
  border-bottom:1px solid var(--nb-hair);background:transparent;border-radius:0}
.nb-cell{flex:1;padding:10px 14px 11px;border-right:1px solid var(--nb-hair-soft);min-width:0}
.nb-cell:first-child{padding-left:0}
.nb-cell:last-child b,.nb-cell:last-child span{text-align:right}
.nb-cell:last-child{border-right:0;padding-right:0}
.nb-cell b{display:block;font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:20px;font-weight:600;
  letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}
.nb-cell span{display:block;font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10px;
  letter-spacing:.16em;text-transform:uppercase;color:${T.text3};margin-top:8px;font-weight:600}
.nb-tabs{display:flex;gap:24px;align-items:flex-end;margin:16px 0 0;position:relative;bottom:-1px}
.nb-tab{min-height:36px;padding:0 0 10px;border:0;border-bottom:2px solid transparent;border-radius:0;
  background:transparent;color:${T.text2};font-size:13.5px;font-weight:600;cursor:pointer;
  display:inline-flex;align-items:center;gap:7px;letter-spacing:.01em}
.nb-tab:hover{color:${T.text}}
.nb-tab[aria-selected=true]{color:${T.text};border-bottom-color:${T.accent}}
.nb-tab[disabled]{opacity:.45;cursor:default}

/* ------------------------------------------------------------------- chat */
.nb-chat{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-thread{flex:1;min-height:0;overflow:auto;padding:26px 26px 10px;display:flex;flex-direction:column;gap:26px}
.nb-msg{max-width:38em}
.nb-msg[data-role=assistant]{display:grid;grid-template-columns:28px minmax(0,1fr);gap:14px;align-self:flex-start}
.nb-msg[data-role=user]{align-self:flex-end;max-width:34em;border-left:2px solid ${T.accent};
  padding:2px 0 2px 14px}
.nb-msg-body{min-width:0}
.nb-msg[data-role=user] .nb-bubble{font-size:15px;line-height:1.55;color:${T.text2}}
.nb-msg[data-role=assistant] .nb-bubble{font-size:16px;line-height:1.66;color:${T.text}}
.nb-msg[data-role=assistant] .nb-avatar{width:28px;height:28px;margin-top:2px}
.nb-who{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:${T.text3};font-weight:650;margin-bottom:9px}
.nb-md p{margin:0 0 11px}
.nb-md p:last-child{margin-bottom:0}
.nb-md h2{font-size:16.5px;margin:20px 0 8px;letter-spacing:-.015em;padding-bottom:6px;
  border-bottom:1px solid var(--nb-hair-soft)}
.nb-md h3{font-size:14.5px;margin:16px 0 6px;color:${T.text2};letter-spacing:.01em}
.nb-md ul{margin:0 0 11px;padding-left:18px}
.nb-md li{margin:5px 0}
.nb-md li::marker{color:${T.accent}}
.nb-md code{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13px;
  background:var(--nb-wash-2);padding:1px 5px;border:1px solid var(--nb-hair-soft)}
.nb-md strong{font-weight:650;color:${T.text}}
.nb-md blockquote{margin:12px 0;padding:2px 0 2px 14px;border-left:2px solid ${T.accent};color:${T.text2}}
/* inline citations are plate references: superscript mono, underlined, no pill */
.nb-inline-cite{display:inline-flex;align-items:center;min-height:16px;padding:0 3px;margin:0 1px;
  border:0;background:color-mix(in srgb,${T.accent} 10%, transparent);
  font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:11px;font-weight:650;
  color:${T.accent};cursor:pointer;vertical-align:super;line-height:1;
  text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.nb-inline-cite:hover{background:color-mix(in srgb,${T.accent} 18%, transparent)}
.nb-composer{flex:0 0 auto;padding:14px 26px 18px;border-top:1px solid var(--nb-hair)}
.nb-askbox{display:flex;flex-direction:column;gap:9px;border:1px solid var(--nb-hair);border-radius:0;
  background:color-mix(in srgb, ${T.text} 2.5%, transparent);padding:11px 13px;transition:border-color .12s ease}
.nb-askbox:focus-within{border-color:color-mix(in srgb,${T.accent} 60%, transparent);
  box-shadow:3px 3px 0 color-mix(in srgb,${T.text} 8%, transparent)}
.nb-askbox textarea{width:100%;min-height:44px;max-height:150px;resize:none;border:0;outline:0;
  background:transparent;color:${T.text};font-size:16px;line-height:1.5;font-family:inherit}
.nb-askbox textarea::placeholder{color:${T.text3}}
.nb-askfoot{display:flex;align-items:center;gap:8px}
.nb-hint{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.06em;
  color:${T.text3}}

/* --------------------------------------------------------- studio (index) */
.nb-grid{display:flex;flex-direction:column;gap:0;padding:0 0 30px}
.nb-grouprow{display:flex;align-items:center;gap:10px;padding:12px 14px 6px}
.nb-grouprow span{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10px;font-weight:650;
  letter-spacing:.2em;text-transform:uppercase;color:${T.text2}}
.nb-grouprow i{flex:1;height:1px;background:var(--nb-hair-soft);display:block}
.nb-grouprow em{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:9.5px;font-style:normal;
  letter-spacing:.1em;color:${T.text4}}
.nb-card{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:11px;align-items:start;
  width:100%;min-height:52px;padding:9px 14px 10px;border:0;border-bottom:1px solid var(--nb-hair-soft);
  border-radius:0;background:transparent;cursor:pointer;text-align:left;color:${T.text};
  position:relative;transition:background .1s ease}
.nb-card:hover{background:var(--nb-wash-2)}
.nb-card:hover .nb-card-state{color:${T.accent}}
.nb-card[data-ready=true]{background:transparent}
.nb-card[data-ready=true] .nb-plate{color:${T.text2}}
.nb-card[data-busy=true]{background:color-mix(in srgb,${T.accent} 7%, transparent)}
.nb-card-main{min-width:0;display:block}
.nb-card-main > *{display:block}
.nb-plate{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10px;font-weight:600;
  letter-spacing:.06em;color:${T.text4};padding-top:3px;font-variant-numeric:tabular-nums}
.nb-card[data-ready=true] .nb-plate::before{content:"●";display:block;font-size:6px;line-height:1;
  color:${T.ok};margin-bottom:4px}
.nb-card-name{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:620;
  letter-spacing:-.005em;line-height:1.25;color:${T.text}}
.nb-card-name svg{color:${T.text4};flex:0 0 auto;margin-top:1px}
.nb-card-blurb{display:block;font-size:11.5px;line-height:1.42;color:${T.text3};margin-top:3px;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-card-state{display:flex;align-items:center;gap:6px;justify-self:end;padding-top:4px;white-space:nowrap;
  font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:${T.text3};font-weight:600}
.nb-card[data-ready=false] .nb-card-state{color:${T.text4}}
.nb-card[data-ready=false] .nb-card-state::after{content:"→";margin-left:2px;color:${T.accent}}
.nb-bar-track{height:2px;margin-top:8px;background:color-mix(in srgb,${T.text} 12%, transparent);overflow:hidden;display:block}
.nb-bar-fill{height:100%;background:${T.accent};transition:width .4s ease}
.nb-dot{width:5px;height:5px;border-radius:99px;background:${T.ok};display:inline-block;flex:0 0 auto}
.nb-card[data-ready=false] .nb-dot{background:${T.text4}}

/* ----------------------------------------------------------------- viewer */
.nb-view{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-view-head{display:flex;align-items:center;gap:12px;padding:12px 26px;border-bottom:1px solid var(--nb-hair);
  background:color-mix(in srgb, ${T.text} 1.5%, transparent)}
.nb-view-title{font-size:15px;font-weight:650;letter-spacing:-.01em}
.nb-view-body{flex:1;min-height:0;overflow:auto;padding:26px}
.nb-doc{max-width:36em;font-size:16px;line-height:1.68}
.nb-doc h1{font-size:22px;line-height:1.2;letter-spacing:-.025em;margin:0 0 14px;text-wrap:balance}
.nb-doc em{color:${T.text2}}
.nb-doc hr{border:0;border-top:1px solid var(--nb-hair);margin:22px 0}
.nb-doc h2{font-size:19px;margin:26px 0 10px;letter-spacing:-.02em;padding-bottom:8px;
  border-bottom:1px solid var(--nb-hair)}
.nb-doc h2:first-child{margin-top:0}
.nb-doc h3{font-size:15px;margin:20px 0 6px;color:${T.text2};
  font-family:var(--ui-font-mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase}
.nb-doc ul,.nb-doc ol{padding-left:20px;margin:0 0 12px}
.nb-doc li{margin:5px 0}
.nb-doc table{border-collapse:collapse;width:100%;font-size:14px;margin:14px 0}
.nb-doc th,.nb-doc td{border:1px solid var(--nb-hair-soft);padding:8px 10px;text-align:left}
.nb-doc th{background:var(--nb-wash-2);font-family:var(--ui-font-mono,ui-monospace,monospace);
  font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:650;color:${T.text2}}
.nb-doc pre{background:color-mix(in srgb, ${T.text} 5%, transparent);border:1px solid var(--nb-hair-soft);
  padding:14px;overflow:auto;font-size:13.5px}

/* -------------------------------------------------------------- stage/media */
.nb-stage{display:flex;flex-direction:column;gap:16px}
.nb-screen{position:relative;overflow:hidden;background:color-mix(in srgb, ${T.text} 6%, transparent);
  border:1px solid var(--nb-hair);aspect-ratio:16/9;display:grid;place-items:center}
.nb-screen video,.nb-screen iframe{width:100%;height:100%;border:0;display:block;background:color-mix(in srgb, ${T.text} 6%, transparent)}
.nb-screen-audio{aspect-ratio:auto;padding:20px;display:flex;flex-direction:column;gap:16px;
  place-items:stretch;width:100%;background:color-mix(in srgb, ${T.text} 4%, transparent)}
.nb-wave{display:flex;align-items:center;gap:2px;height:64px;width:100%}
.nb-wave i{flex:1 1 0;min-width:2px;background:${T.text3};opacity:.4}
.nb-wave i[data-past=true]{background:${T.accent};opacity:1}
.nb-ctrl{display:flex;align-items:center;gap:10px}
.nb-timeline{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none}
.nb-tl{display:grid;grid-template-columns:96px 1fr;gap:16px;padding:11px 0;border-top:1px solid var(--nb-hair-soft)}
.nb-tl:first-child{border-top:0}
.nb-tl-when{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:650;
  color:${T.accent};letter-spacing:.1em;text-transform:uppercase;padding-top:3px}
.nb-tl-what{font-size:15px;color:${T.text2}}

/* ---------------------------------------------------------------- mind map */
.nb-map{width:100%;height:100%;min-height:320px;display:block;cursor:grab;
  border:1px solid var(--nb-hair-soft);background:
  radial-gradient(circle at 50% 45%, color-mix(in srgb,${T.accent} 8%, transparent), transparent 60%)}
.nb-map:active{cursor:grabbing}

/* -------------------------------------------------------------- flashcards */
.nb-deck{display:flex;flex-direction:column;gap:16px;max-width:620px;margin:0 auto}
.nb-flip{perspective:1400px;cursor:pointer;border:0;background:transparent;padding:0}
.nb-flip-inner{position:relative;width:100%;min-height:300px;transition:transform .5s cubic-bezier(.2,.7,.2,1);
  transform-style:preserve-3d}
.nb-flip[data-flipped=true] .nb-flip-inner{transform:rotateY(180deg)}
.nb-face{position:absolute;inset:0;backface-visibility:hidden;border:1px solid var(--nb-hair);
  background:color-mix(in srgb, ${T.text} 4%, transparent);padding:28px;display:flex;flex-direction:column;
  justify-content:center;gap:10px;font-size:19px;line-height:1.45}
.nb-face[data-side=back]{transform:rotateY(180deg);border-left:2px solid ${T.accent};
  background:color-mix(in srgb,${T.accent} 9%, transparent)}
.nb-face .nb-meta{position:absolute;top:16px;left:20px}
.nb-face-hint{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:${T.text4};margin-top:auto}

/* -------------------------------------------------------------------- ops */
.nb-fleet{display:flex;flex-direction:column;gap:0;padding:6px 0}
.nb-frow{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:12px;
  padding:8px 14px;border:0;border-left:2px solid transparent;border-bottom:1px solid var(--nb-hair-soft);
  background:transparent;cursor:pointer;text-align:left;color:${T.text};min-height:46px}
.nb-frow:hover{background:var(--nb-wash)}
.nb-frow[aria-current=true]{border-left-color:${T.accent};background:var(--nb-wash-2)}
.nb-fname{font-size:14px;font-weight:600;line-height:1.25}
.nb-frole{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:9.5px;color:${T.text3};
  text-transform:uppercase;letter-spacing:.14em;font-weight:600}
.nb-term{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13.5px;line-height:1.55;flex:1 1 auto;
  background:color-mix(in srgb, ${T.text} 5%, transparent);color:${T.text2};
  border:1px solid var(--nb-hair);padding:14px;min-height:120px;max-height:none;overflow:auto;
  white-space:pre-wrap;word-break:break-word}
.nb-term-in{display:flex;gap:8px;align-items:center;margin-top:10px}
.nb-term-in input{flex:1;height:36px;border-radius:0;border:1px solid var(--nb-hair);
  background:transparent;color:${T.text};padding:0 12px;font-size:13.5px;
  font-family:var(--ui-font-mono,ui-monospace,monospace);outline:0}
.nb-term-in input:focus{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}

/* -------------------------------------------------------------- status bar */
.nb-status{flex:0 0 30px;height:30px;display:flex;align-items:center;gap:18px;padding:0 16px;
  border-top:1px solid var(--nb-hair);background:var(--nb-wash);
  font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;letter-spacing:.05em;
  color:${T.text3}}
.nb-status b{color:${T.text2};font-weight:600}
.nb-sdot{width:6px;height:6px;border-radius:99px;display:inline-block;margin-right:7px;vertical-align:middle}
.nb-void{display:grid;place-items:center;height:100%;padding:36px;text-align:center;color:${T.text3}}
.nb-void h3{color:${T.text};font-size:22px;margin:0 0 10px;letter-spacing:-.02em;font-weight:700}
.nb-void p{margin:0;max-width:48ch;font-size:14px;line-height:1.62}

@media (max-width:1280px){
  .nb-root{--nb-rail:268px; --nb-studio:344px}
  .nb-h1{font-size:27px}
}
@media (max-width:1100px){
  .nb-body{grid-template-columns:248px minmax(0,1fr)}
  .nb-studio{display:none}
  .nb-thread{padding:22px 20px 10px}
  .nb-main-head{padding:20px 20px 0}
  .nb-composer{padding:12px 20px 16px}
}
@media (max-width:820px){
  .nb-body{grid-template-columns:minmax(0,1fr)}
  .nb-rail{display:none}
  .nb-h1{font-size:24px}
  .nb-strip{flex-wrap:wrap}
  .nb-cell{flex:1 1 40%;border-top:1px solid var(--nb-hair-soft)}
  .nb-cell:nth-child(1),.nb-cell:nth-child(2){border-top:0}
}
`

/* --------------------------------------------------------------- helpers */

/** Element helper.
 *
 * `jsx(type, props, key)` takes the KEY third — passing a child there renders a
 * component with no text and no error, which reads as a CSS bug. `el` takes
 * children variadically and treats a lone third string as a key when the props
 * already carry children, so both call shapes are safe.
 */
const el = (tag, props, ...kids) => {
  const merged = { ...(props || {}) }
  if (kids.length === 1 && merged.children !== undefined && (typeof kids[0] === 'string' || typeof kids[0] === 'number')) {
    merged.key = kids[0]
  } else if (kids.length === 1) {
    merged.children = kids[0]
  } else if (kids.length > 1) {
    merged.children = kids
  }
  return jsxs(tag, merged)
}

const cx = (...parts) => parts.filter(Boolean).join(' ')

const nfmt = (n) => {
  const v = Number(n) || 0
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`
  return String(Math.round(v))
}

const ago = (stamp) => {
  const then = Date.parse(stamp)
  if (Number.isNaN(then)) return ''
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

const clock = (stamp) => {
  const d = new Date(Date.parse(stamp) || Date.now())
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const esc = (s) => String(s == null ? '' : s)
