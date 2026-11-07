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
import {
  ListRow,
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  STATUSBAR_AREAS,
  SegmentedControl,
  ToggleRow,
  host
} from '@hermes/plugin-sdk'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

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
  --nb-hair: color-mix(in srgb, ${T.text} 16%, transparent);
  --nb-hair-soft: color-mix(in srgb, ${T.text} 9%, transparent);
  --nb-wash: color-mix(in srgb, ${T.text} 3.5%, transparent);
  --nb-wash-2: color-mix(in srgb, ${T.text} 6%, transparent);
  --nb-gridline: color-mix(in srgb, ${T.text} 4.5%, transparent);
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
.nb-body > main{background-image:
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
.nb-msg{max-width:70ch}
.nb-msg[data-role=assistant]{display:grid;grid-template-columns:28px minmax(0,1fr);gap:14px;align-self:flex-start}
.nb-msg[data-role=user]{align-self:flex-end;max-width:60ch;border-left:2px solid ${T.accent};
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
.nb-grid{display:flex;flex-direction:column;gap:0;padding:0 0 6px}
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
.nb-card-blurb{display:block;font-size:11px;line-height:1.38;color:${T.text3};margin-top:3px;
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
.nb-doc{max-width:72ch;font-size:16px;line-height:1.68}
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

/* ------------------------------------------------------------------ icons
 * Hand-drawn 24×24 stroke paths; one <svg> factory so every glyph shares the
 * same weight. No icon font, no remote sprite — a desktop plugin can only
 * import the SDK, react and react/jsx-runtime.
 */
const P = {
  notebook: 'M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Zm0 0v16M9 8h6M9 12h6',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5ZM8 7h7M8 10h5',
  video: 'M3 7.5A2.5 2.5 0 0 1 5.5 5h7A2.5 2.5 0 0 1 15 7.5v9A2.5 2.5 0 0 1 12.5 19h-7A2.5 2.5 0 0 1 3 16.5v-9ZM15 10l5-3v10l-5-3',
  audio: 'M4 10v4M8 6v12M12 8v8M16 4v16M20 9v6',
  mindmap: 'M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM12 9V5M12 15v4M9.6 10.4 5 8M9.6 13.6 5 16M14.4 10.4 19 8M14.4 13.6 19 16',
  study: 'M3 8l9-4 9 4-9 4-9-4Zm3 4.2V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-3.8',
  doc: 'M7 3h7l4 4v14H7V3Zm7 0v4h4M9.5 12h6M9.5 15.5h6M9.5 8.5h2',
  faq: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-2.2-9.8a2.2 2.2 0 1 1 3.1 2c-.6.3-.9.8-.9 1.4v.4M12 17h.01',
  timeline: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.2 2',
  cards: 'M8 7h11v11H8V7ZM5 17V4h11',
  slides: 'M3 4h18v11H3V4Zm9 11v5M8 20h8',
  chart: 'M4 20h16M7 16V9M12 16V5M17 16v-5',
  summary: 'M5 6h14M5 10h14M5 14h9M5 18h6',
  quiz: 'M4 5h16v14H4V5Zm3.5 7.2 2 2 3.5-3.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.8.2L20 21',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  play: 'M7 4.5v15l13-7.5-13-7.5Z',
  pause: 'M8 5v14M16 5v14',
  chevron: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4',
  sparkle: 'M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3Z',
  external: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  terminal: 'M4 5h16v14H4V5Zm3.5 5 2.5 2.5L7.5 15M13 15h4',
  server: 'M4 6h16v5H4V6Zm0 7h16v5H4v-5ZM7 8.5h.01M7 15.5h.01',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3Zm-3 9 2 2 4-4',
  copy: 'M9 9h10v10H9V9Zm-4 6H4V4h11v1',
  check: 'M5 13l4.5 4.5L19 7',
  download: 'M12 4v10M8 11l4 4 4-4M5 19h14',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7Z',
  cpu: 'M8 8h8v8H8V8Zm-3 3h3m-3 3h3m13-6h-3m3 6h-3M11 5v3m3-3v3m-3 11v-3m3 3v-3',
  link: 'M10 14a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.4 7M14 10a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L12.6 17',
  file: 'M7 3h7l4 4v14H7V3Zm7 0v4h4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c3 3.4 3 14.6 0 18M3.5 9h17M3.5 15h17',
  image: 'M4 5h16v14H4V5Zm3 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM20 15l-5-5-8 9',
  note: 'M6 3h9l4 4v14H6V3Zm3 8h7m-7 4h5',
  trash: 'M5 7h14M9 7V4h6v3m-7 0 1 13h6l1-13',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5 12 22l9-4.5',
  send: 'M4 12l16-8-6 16-3-6-7-2Z',
  keyboard: 'M3 6h18v12H3V6Zm3 3h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6.5 15h11',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  stop: 'M7 7h10v10H7V7Z'
}

function Glyph({ name, size = 16, stroke = 1.7 }) {
  const d = P[name] || P.doc
  return el('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false',
    children: el('path', { d })
  })
}

/* -------------------------------------------------------------- primitives */

function Btn({ children, icon, variant, size, onClick, disabled, title, type = 'button', ...rest }) {
  return el('button', {
    type, className: 'nb-btn', 'data-variant': variant, 'data-size': size,
    onClick, disabled, title, 'aria-label': rest['aria-label'],
    children: [icon ? jsx(Glyph, { name: icon, size: size === 'sm' ? 14 : 15 }) : null,
               children ? el('span', { children }) : null].filter(Boolean)
  })
}

function IconBtn({ icon, label, onClick, active, size = 16 }) {
  return el('button', {
    type: 'button', className: 'nb-icon', onClick, title: label, 'aria-label': label,
    'data-active': active ? 'true' : 'false',
    children: jsx(Glyph, { name: icon, size })
  })
}

/** SegmentedControl: one tab stop, arrow keys move the selection (a tablist
 *  that swallows arrow keys is a promise the widget breaks). */
function Seg({ value, onChange, options, label, fill }) {
  const refs = useRef([])
  const onKey = (e) => {
    const i = options.findIndex((o) => o.id === value)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(options[next].id)
    const node = refs.current[next]
    if (node) node.focus()
  }
  return el('div', {
    className: 'nb-seg', role: 'tablist', 'aria-label': label, onKeyDown: onKey,
    'data-fill': fill ? 'true' : 'false'
  }, options.map((o, i) => el('button', {
    type: 'button', role: 'tab', ref: (n) => { refs.current[i] = n },
    'aria-selected': o.id === value, tabIndex: o.id === value ? 0 : -1,
    onClick: () => onChange(o.id), title: o.title || o.label,
    children: [o.icon ? jsx(Glyph, { name: o.icon, size: 14 }) : null,
               el('span', { children: o.label })].filter(Boolean)
  }, o.id)))
}

function Chip({ children, tone, onClick, title, pressed }) {
  const clickable = typeof onClick === 'function'
  const props = {
    className: 'nb-chip', 'data-tone': tone, 'data-click': clickable ? 'true' : undefined,
    title, children
  }
  if (clickable) {
    props.onClick = onClick
    props.type = 'button'
    props['aria-pressed'] = pressed === undefined ? undefined : !!pressed
    return el('button', props)
  }
  return el('span', props)
}

function SearchField({ value, onChange, placeholder, label }) {
  return el('div', { className: 'nb-field' },
    jsx(Glyph, { name: 'search', size: 14 }),
    el('input', {
      value, placeholder, 'aria-label': label || placeholder,
      onChange: (e) => onChange(e.target.value), spellCheck: false
    }),
    value ? jsx(IconBtn, { icon: 'close', label: 'Clear search', size: 13, onClick: () => onChange('') }) : null
  )
}

/** Minimal modal: focus moves in, Tab cycles, Escape closes, focus returns. */
function useDialogFocus(open, onClose) {
  useEffect(() => {
    if (!open) return undefined
    const prior = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = document.querySelector('[data-nb-dialog="true"]')
      if (!root) return
      const items = Array.from(root.querySelectorAll(
        'button,[href],input,textarea,select,[tabindex]:not([tabindex="-1"])'
      )).filter((n) => !n.disabled && n.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    const t = setTimeout(() => {
      const root = document.querySelector('[data-nb-dialog="true"]')
      const target = root && (root.querySelector('[autofocus]') || root.querySelector('input,textarea,button'))
      if (target) target.focus()
    }, 30)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      if (prior && prior.focus) prior.focus()
    }
  }, [open, onClose])
}

function Dialog({ open, onClose, title, children, width = 520 }) {
  useDialogFocus(open, onClose)
  if (!open) return null
  return el('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center',
      background: 'color-mix(in srgb, #000 55%, transparent)', padding: '24px'
    },
    onClick: (e) => { if (e.target === e.currentTarget) onClose() }
  },
  el('div', {
    'data-nb-dialog': 'true', role: 'dialog', 'aria-modal': 'true',
    'aria-label': title, tabIndex: -1,
    style: {
      width: `min(${width}px, 100%)`, maxHeight: '84vh', overflow: 'auto',
      background: 'var(--ui-bg-elevated, var(--ui-bg-primary, #14151b))',
      border: `1px solid ${T.line}`, borderRadius: 0, padding: '20px',
      boxShadow: '8px 8px 0 color-mix(in srgb, currentColor 10%, transparent), 0 24px 60px rgba(0,0,0,.45)'
    }
  },
  el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' } },
    el('div', { style: { flex: 1 } },
      el('div', { style: { fontSize: '17px', fontWeight: 650, letterSpacing: '-.01em' }, children: title })),
    jsx(IconBtn, { icon: 'close', label: 'Close dialog', onClick: onClose })
  ),
  children))
}

/* ----------------------------------------------------------------- markdown
 * A small, honest renderer: headings, lists, tables, fenced code, quotes, and
 * bold/italic/code/inline-citation spans. Generated artifacts are markdown, and
 * shipping them as raw text in a "polished" viewer is the difference between a
 * product and a debug pane — but a full markdown library is not importable here.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[S\d+\]|\[[^\]]+\]\([^)]+\))/g

function inlineNodes(text, keyBase, onCite) {
  const out = []
  let last = 0
  const s = esc(text)
  let m
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index))
    const tok = m[0]
    const k = `${keyBase}-${m.index}`
    if (tok.startsWith('**')) {
      out.push(el('strong', { children: tok.slice(2, -2) }, k))
    } else if (tok.startsWith('`')) {
      out.push(el('code', { children: tok.slice(1, -1) }, k))
    } else if (tok.startsWith('*')) {
      out.push(el('em', { children: tok.slice(1, -1) }, k))
    } else if (/^\[S\d+\]$/.test(tok)) {
      const n = Number(tok.slice(2, -1))
      if (onCite) {
        out.push(el('button', {
          type: 'button', className: 'nb-inline-cite', title: `Open source S${n}`,
          'aria-label': `Citation ${n} — open the source`,
          onClick: (e) => { e.stopPropagation(); onCite(n) },
          children: tok
        }, k))
      } else out.push(el('span', { className: 'nb-inline-cite', children: tok }, k))
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      out.push(el('a', {
        href: mm[2], target: '_blank', rel: 'noreferrer', style: { color: T.accent },
        children: mm[1]
      }, k))
    }
    last = m.index + tok.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

function Markdown({ text, onCite, className }) {
  const blocks = useMemo(() => parseBlocks(String(text || '')), [text])
  return el('div', {
    className: cx('nb-md', className),
    children: blocks.map((b, i) => renderBlock(b, i, onCite))
  })
}

function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  const flushList = (ordered, items) => {
    blocks.push({ t: ordered ? 'ol' : 'ul', items })
  }
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i += 1 }
      i += 1
      blocks.push({ t: 'code', lang, text: buf.join('\n') })
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { blocks.push({ t: 'h' + h[1].length, text: h[2] }); i += 1; continue }
    if (/^>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1 }
      blocks.push({ t: 'quote', text: buf.join(' ') })
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i += 1
      }
      const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || !c))
      if (body.length) blocks.push({ t: 'table', rows: [body[0], body.slice(1)] })
      continue
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''))
        i += 1
      }
      flushList(ordered, items)
      continue
    }
    const buf = [line]
    i += 1
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,4}\s|>|\s*\||\s*([-*+]|\d+\.)\s|```)/.test(lines[i])) {
      buf.push(lines[i]); i += 1
    }
    blocks.push({ t: 'p', text: buf.join(' ') })
  }
  return blocks
}

function renderBlock(b, i, onCite) {
  const key = `b${i}`
  if (b.t === 'ul' || b.t === 'ol') {
    return el(b.t, { key }, b.items.map((it, j) =>
      el('li', { children: inlineNodes(it, key + j, onCite) }, `${key}-${j}`)))
  }
  if (b.t === 'table') {
    const [head, rows] = b.rows
    return el('table', { key },
      el('thead', { children: el('tr', { children: head.map((c, j) =>
        el('th', { children: inlineNodes(c, `${key}t${j}`, onCite) }, `${key}-th-${j}`)) }) }),
      el('tbody', { children: rows.map((r, j) =>
        el('tr', { children: r.map((c, k2) =>
          el('td', { children: inlineNodes(c, `${key}r${j}c${k2}`, onCite) }, `${key}-${j}-${k2}`)) }, `${key}-r-${j}`)) }))
  }
  if (b.t === 'code') {
    return el('pre', { key }, el('code', { children: b.text }))
  }
  const tag = b.t === 'quote' ? 'blockquote' : (b.t.length === 2 ? b.t : 'p')
  return jsx(tag, { key, children: inlineNodes(b.text, key, onCite) })
}

/* -------------------------------------------------------------- data layer
 * The page talks to its own backend namespace (`/api/plugins/hermes-notebook`)
 * through `ctx.rest`, which carries the desktop grant. Nothing here fabricates
 * state: a failed call surfaces the backend's own sentence, and the UI says so
 * instead of rendering plausible zeros.
 */
let CTX = null
const setCtx = (c) => { CTX = c }

const api = async (path, opts) => {
  if (!CTX || typeof CTX.rest !== 'function') {
    throw new Error('this page is not attached to the gateway yet — reload the window')
  }
  const out = await CTX.rest(path, opts)
  if (out && out.ok === false) throw new Error(out.error || 'the backend refused that')
  if (out && out.detail && out.ok === undefined) throw new Error(String(out.detail))
  return out
}

const qs = (obj) => Object.keys(obj)
  .filter((k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
  .map((k) => `${k}=${encodeURIComponent(obj[k])}`).join('&')

const persist = {
  get(key, dflt) {
    try { const v = CTX && CTX.storage && CTX.storage.get(key); return v === undefined || v === null ? dflt : v }
    catch { return dflt }
  },
  set(key, value) {
    try { CTX && CTX.storage && CTX.storage.set(key, value) } catch { /* storage is a nicety */ }
  }
}

/** One poll of `/state`; `nb` scopes it to a notebook. */
function useStudio(nb) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)
  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try {
      const next = await api(`/state${nb ? `?${qs({ notebook: nb })}` : ''}`)
      if (!alive.current) return next
      setData(next)
      setError('')
      return next
    } catch (e) {
      if (alive.current) setError(e.message || String(e))
      return null
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [nb])
  useEffect(() => {
    alive.current = true
    load(false)
    return () => { alive.current = false }
  }, [load])
  return { data, error, loading, reload: load, setData }
}

/* ------------------------------------------------------------------- kinds */
const KIND_ICON = {
  video_overview: 'video', audio_overview: 'audio', summary: 'summary',
  briefing_doc: 'doc', study_guide: 'study', faq: 'faq', timeline: 'timeline',
  mind_map: 'mindmap', flashcards: 'cards', quiz: 'quiz', slides: 'slides',
  infographic: 'chart'
}

const SRC_ICON = {
  url: 'globe', youtube: 'video', file: 'file', text: 'note', image: 'image',
  pdf: 'file', note: 'note', audio: 'audio'
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'docs', label: 'Docs' },
  { id: 'study', label: 'Study' },
  { id: 'media', label: 'Media' },
  { id: 'visual', label: 'Visual' }
]

/** Latest generation per kind — what "ready" means on a studio card. */
function latestByKind(artifacts) {
  const map = {}
  for (const a of artifacts || []) {
    if (!map[a.kind]) map[a.kind] = a
  }
  return map
}

/* ------------------------------------------------------------------ shell */

function App() {
  const [mode, setMode] = useState(() => persist.get('mode', 'studio'))
  const [nb, setNb] = useState(() => persist.get('notebook', ''))
  const studio = useStudio(nb)
  const [picked, setPicked] = useState(null)       // artifact run selected in the viewer
  const [tab, setTab] = useState('chat')
  const [busy, setBusy] = useState({})             // kind -> startedAt (ms)
  const [toast, setToast] = useState('')
  const [askOpen, setAskOpen] = useState(0)        // bump to focus the composer
  const [addSource, setAddSource] = useState(false)
  const [newNb, setNewNb] = useState(false)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [opsStats, setOpsStats] = useState(null)

  const say = useCallback((msg) => {
    setNote(msg)
    const t = setTimeout(() => setNote(''), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { persist.set('mode', mode) }, [mode])
  useEffect(() => { persist.set('notebook', nb) }, [nb])

  const data = studio.data
  const notebook = data && data.notebook
  const kinds = (data && data.kinds) || []

  // the first notebook in the list is the default when nothing is stored
  useEffect(() => {
    if (!nb && data && data.notebooks && data.notebooks.length) setNb(data.notebooks[0].id)
  }, [data, nb])

  // A studio card can be opened by name from outside the page (palette command,
  // or `?open=mind_map` in the preview harness) — consumed once.
  useEffect(() => {
    if (!notebook) return
    const want = persist.get('__open', '')
    if (!want) return
    const hit = (notebook.artifacts || []).find((a) => a.kind === want)
    if (hit) { setPicked(hit); setTab('view') }
    persist.set('__open', '')
  }, [notebook])

  const generate = useCallback(async (kind) => {
    if (!notebook) return
    setBusy((b) => ({ ...b, [kind]: Date.now() }))
    try {
      await api('/generate', {
        method: 'POST',
        body: { notebook: notebook.id, kind, length: 'short' },
        timeoutMs: 240000
      })
      await studio.reload(true)
      const fresh = await studio.reload(true)
      const target = fresh && fresh.notebook && fresh.notebook.artifacts
        ? fresh.notebook.artifacts.find((a) => a.kind === kind) : null
      if (target) { setPicked(target); setTab('view') }
      say(`${kind.replace(/_/g, ' ')} ready`)
    } catch (e) {
      say(`${kind.replace(/_/g, ' ')} failed: ${e.message || e}`)
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[kind]; return n })
    }
  }, [notebook, studio, say])

  const ops = mode === 'ops'

  return el('div', { className: 'nb-root', 'data-mode': mode, 'data-plugin': ID },
    el('style', { dangerouslySetInnerHTML: { __html: CSS } }),
    el('header', { className: 'nb-bar' },
      el('div', { className: 'nb-brand' },
        el('span', { className: 'nb-mark' }, jsx(Glyph, { name: 'notebook', size: 15 })),
        el('span', { className: 'nb-brandname', children: 'Notebook' }),
        el('span', { className: 'nb-crumb' },
          ops
            ? el('b', { children: 'Lab Ops' })
            : el('span', null, '/ ', el('b', { children: notebook ? notebook.title : 'no notebook' })))
      ),
      el('div', { className: 'nb-spacer' }),
      jsx(Seg, {
        label: 'Surface', value: mode, onChange: (v) => setMode(v),
        options: [
          { id: 'studio', label: 'Studio', icon: 'notebook' },
          { id: 'ops', label: 'Lab Ops', icon: 'server' }
        ]
      }),
      el('div', { className: 'nb-actions' },
        ops ? null : jsx(Btn, {
          icon: 'plus', variant: 'primary', onClick: () => setAddSource(true),
          disabled: !notebook, children: 'Add source'
        }))
    ),

    ops
      ? jsx(OpsDeck, { onSay: say, onStats: setOpsStats })
      : el('div', { className: 'nb-body' },
          jsx(Rail, {
            data, nb, setNb, q, setQ, filter, setFilter,
            onNewNotebook: () => setNewNb(true), onAddSource: () => setAddSource(true),
            loading: studio.loading, error: studio.error, reload: studio.reload
          }),
          jsx(Main, {
            notebook, kinds, tab, setTab, picked, setPicked, busy, generate,
            onAsk: () => setAskOpen((n) => n + 1), askOpen, onSay: say,
            reload: studio.reload, modelReady: data && data.model_ready,
            error: studio.error, loading: studio.loading, onAddSource: () => setAddSource(true)
          }),
          jsx(StudioPanel, {
            kinds, notebook, busy, generate, filter, setFilter, picked, setPicked,
            onOpen: (art) => { setPicked(art); setTab('view') }
          })
        ),

    jsx(StatusBar, { mode, notebook, data, note, opsStats }),

    jsx(AddSourceDialog, {
      open: addSource, onClose: () => setAddSource(false), notebook,
      onDone: async (msg) => { setAddSource(false); await studio.reload(true); if (msg) say(msg) }
    }),
    jsx(NewNotebookDialog, {
      open: newNb, onClose: () => setNewNb(false),
      onDone: async (id) => { setNewNb(false); if (id) { setNb(id); setPicked(null) } }
    })
  )
}

/* -------------------------------------------------------------------- rail */

function Rail({ data, nb, setNb, q, setQ, filter, setFilter, onNewNotebook, onAddSource, loading, error, reload }) {
  const notebooks = (data && data.notebooks) || []
  const notebook = data && data.notebook
  const sources = (notebook && notebook.sources) || []
  const labels = (notebook && notebook.labels) || []

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return sources.filter((s) => {
      if (filter !== 'all' && !(s.labels || []).some((l) => l.toLowerCase().includes(filter))) return false
      if (!needle) return true
      return (s.title + ' ' + (s.origin || '') + ' ' + (s.labels || []).join(' '))
        .toLowerCase().includes(needle)
    })
  }, [sources, q, filter])

  return el('aside', { className: 'nb-col nb-rail', 'aria-label': 'Notebooks and sources' },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-meta', children: `Notebooks · ${notebooks.length}` }),
      jsx(IconBtn, { icon: 'plus', label: 'New notebook', onClick: onNewNotebook })
    ),
    el('div', { className: 'nb-scroll', style: { flex: '0 1 auto', maxHeight: '38%' } },
      el('div', { className: 'nb-pad', style: { paddingTop: '8px' } },
        loading && !notebooks.length
          ? el('div', { className: 'nb-hint', style: { padding: '8px' }, children: 'reading notebooks…' })
          : notebooks.length === 0
            ? el('div', { className: 'nb-hint', style: { padding: '8px', lineHeight: 1.5 } },
                'No notebooks yet. Create one, then add sources — every answer and artifact is derived from them.')
            : notebooks.map((item, i) =>
                el('button', {
                  type: 'button', className: 'nb-nbrow', 'aria-current': item.id === nb ? 'true' : 'false',
                  onClick: () => setNb(item.id), title: item.description || item.title,
                  children: [
                    el('span', { className: 'nb-avatar', children: roman(i + 1) }),
                    el('span', { style: { minWidth: 0, flex: 1 } },
                      el('span', { className: 'nb-nbtitle', children: item.title }),
                      el('span', { className: 'nb-nbsub' },
                        `${item.sources} source${item.sources === 1 ? '' : 's'} · ${item.artifacts} artifact${item.artifacts === 1 ? '' : 's'}`))
                  ]
                }, item.id))
      )
    ),

    el('div', { className: 'nb-pane-head', style: { borderTop: `1px solid ${T.lineSoft}` } },
      el('span', { className: 'nb-meta', children: `Sources · ${sources.length}` }),
      jsx(IconBtn, { icon: 'refresh', label: 'Refresh sources', onClick: () => reload(true) })
    ),
    el('div', { className: 'nb-pad', style: { paddingBottom: '6px' } },
      jsx(SearchField, { value: q, onChange: setQ, placeholder: 'Search sources', label: 'Search sources' })
    ),
    el('div', {
      className: 'nb-pad',
      style: { display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: 0, paddingBottom: '10px' },
      role: 'group', 'aria-label': 'Filter sources by label'
    },
    labels.slice(0, 6).map((l) =>
      jsx(Chip, {
        key: l.label, tone: filter === l.label.toLowerCase() ? 'accent' : undefined,
        pressed: filter === l.label.toLowerCase(),
        onClick: () => setFilter(filter === l.label.toLowerCase() ? 'all' : l.label.toLowerCase()),
        title: `${l.count} source${l.count === 1 ? '' : 's'} labelled ${l.label}`,
        children: `${l.label} ${l.count}`
      }))
    ),

    el('div', { className: 'nb-scroll', 'aria-label': 'Source list' },
      el('div', { className: 'nb-pad', style: { paddingTop: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
        error
          ? el('div', { className: 'nb-hint', style: { padding: '10px', color: T.danger }, children: error })
          : shown.length === 0
            ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '24px 8px' } },
                el('div', null,
                  el('h3', { style: { fontSize: '15px' }, children: sources.length ? 'Nothing matches' : 'No sources yet' }),
                  el('p', { style: { fontSize: '13.5px' }, children: sources.length
                    ? 'Clear the filter or the search to see every source.'
                    : 'Add a file, a URL or pasted text and it becomes citable.' })))
            : shown.map((s) =>
                el('button', {
                  type: 'button', className: 'nb-src', 'data-on': pickedCite === s.n ? 'true' : 'false',
                  onClick: () => setPickedCite(s.n),
                  title: s.summary || s.origin || s.title,
                  children: [
                    el('span', { className: 'nb-cite', children: `S${s.n}` }),
                    el('span', { style: { minWidth: 0, flex: 1 } },
                      el('span', { className: 'nb-src-title', children: s.title }),
                      el('span', { className: 'nb-src-meta' },
                        el('span', { className: 'nb-chip', children: `${s.kind} · ${nfmt(s.chars)}` }),
                        (s.labels || []).slice(0, 2).map((l) => el('span', { className: 'nb-chip', children: l }, l))
                      ))
                  ]
                }, s.id))
      )
    ),
    el('div', { style: { borderTop: `1px solid ${T.lineSoft}`, padding: '10px' } },
      jsx(Btn, { icon: 'plus', variant: 'ghost', onClick: onAddSource, disabled: !notebook, children: 'Add source' })
    )
  )
}

/* An index, not an avatar row: I, II, III … (atelier-zero's Roman-numeral walk). */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const roman = (n) => ROMAN[n - 1] || String(n)

// citation focus is shared state: a [S3] click in the answer highlights S3 here
let pickedCite = 0
const setPickedCite = (n) => { pickedCite = n }

/* -------------------------------------------------------------------- main */

function Main({ notebook, kinds, tab, setTab, picked, setPicked, busy, generate, onAsk,
                askOpen, onSay, reload, modelReady, error, loading, onAddSource }) {
  const [peek, setPeek] = useState(null)
  const sources = (notebook && notebook.sources) || []

  if (loading && !notebook) {
    return el('main', { className: 'nb-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Opening the notebook' }),
          el('p', { children: 'Reading sources and artifacts from the plugin store…' }))))
  }
  if (error && !notebook) {
    return el('main', { className: 'nb-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'The notebook backend did not answer' }),
          el('p', { children: error }),
          el('div', { style: { marginTop: '14px' } },
            jsx(Btn, { icon: 'refresh', onClick: () => reload(false), children: 'Try again' })
          )
        )
      )
    )
  }
  if (!notebook) {
    return el('main', { className: 'nb-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Start a notebook' }),
          el('p', { children: 'A notebook is a set of sources. Everything the studio makes — answers, a podcast, a mind map, slides — is derived from those sources and cites them by number.' }),
          el('div', { style: { marginTop: '16px' } },
            jsx(Btn, { variant: 'primary', icon: 'plus', onClick: onAddSource, children: 'Add your first source' })
          )
        )
      )
    )
  }

  const viewName = picked ? picked.label : ''
  const art = picked
  const stats = notebook.stats || {}

  return el('main', { className: 'nb-col' },
    el('div', { className: 'nb-main-head' },
      el('div', { className: 'nb-filed' },
        el('b', { children: 'Notebook' }),
        el('span', { className: 'nb-mono', children: notebook.id }),
        el('i', { 'aria-hidden': 'true' }),
        el('span', { children: modelReady ? 'grounded · every line cites a source' : 'model offline' })),
      el('h1', { className: 'nb-h1', children: notebook.title }),
      notebook.description ? el('p', { className: 'nb-sub', children: notebook.description })
        : el('p', { className: 'nb-sub', children: 'Answers are generated only from the sources on the left; each citation opens the source it came from.' }),
      el('div', { className: 'nb-strip', role: 'group', 'aria-label': 'Notebook totals' },
        el('div', { className: 'nb-cell' }, el('b', { children: stats.sources || 0 }), el('span', { children: 'sources' })),
        el('div', { className: 'nb-cell' }, el('b', { children: nfmt(stats.chars) }), el('span', { children: 'chars indexed' })),
        el('div', { className: 'nb-cell' }, el('b', { children: stats.labels || 0 }), el('span', { children: 'labels' })),
        el('div', { className: 'nb-cell' }, el('b', { children: stats.artifacts || 0 }), el('span', { children: 'artifacts' })),
        el('div', { className: 'nb-cell' },
          el('b', { style: { color: modelReady ? T.ok : T.warn }, children: modelReady ? 'ready' : 'offline' }),
          el('span', { children: 'model' }))
      ),
      el('div', { className: 'nb-tabs', role: 'tablist', 'aria-label': 'Notebook views' },
        el('button', {
          type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'chat',
          onClick: () => setTab('chat'), children: [jsx(Glyph, { name: 'faq', size: 15 }), 'Chat']
        }),
        el('button', {
          type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'view',
          onClick: () => setTab('view'), disabled: !picked,
          children: [jsx(Glyph, { name: picked ? (KIND_ICON[picked.kind] || 'doc') : 'doc', size: 15 }),
                     viewName || 'Viewer']
        }),
        peek ? el('button', {
          type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'peek',
          onClick: () => setTab('peek'),
          children: [jsx(Glyph, { name: 'book', size: 15 }), `S${peek.n} · ${peek.title}`]
        }) : null
      )
    ),

    tab === 'peek' && peek
      ? jsx(SourcePeek, { source: peek, notebook, onClose: () => { setPeek(null); setTab('chat') } })
      : tab === 'view' && picked
        ? jsx(Viewer, { artifact: picked, notebook, onSearch: () => {}, onCite: (n) => {
            const src = sources.find((s) => s.n === n)
            if (src) { setPeek(src); setTab('peek') }
          } })
        : jsx(Chat, {
            notebook, askOpen, onSay, modelReady,
            onCite: (n) => {
              const src = sources.find((s) => s.n === n)
              if (src) { setPeek(src); setTab('peek') }
            },
            onOpenSource: (s) => { setPeek(s); setTab('peek') }
          })
  )
}

/* ------------------------------------------------------------------- chat */

const SUGGEST = [
  'Summarise the strongest claim in the sources, with citations.',
  'Where do the sources disagree?',
  'What is missing that I should go and find?'
]

function Chat({ notebook, askOpen, onSay, modelReady, onCite, onOpenSource }) {
  const [msgs, setMsgs] = useState(() => (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` })))
  const [text, setText] = useState('')
  const [pending, setPending] = useState(null)
  const threadRef = useRef(null)
  const boxRef = useRef(null)

  useEffect(() => {
    const stored = (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }))
    setMsgs(stored)
  }, [notebook.id, notebook.thread && notebook.thread.length])

  useEffect(() => { if (askOpen) { const n = boxRef.current; if (n) n.focus() } }, [askOpen])

  useEffect(() => {
    const node = threadRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [msgs.length, pending && pending.since])

  const send = async (question) => {
    const q = (question || text).trim()
    if (!q || pending) return
    setText('')
    setMsgs((m) => [...m, { role: 'user', content: q, k: `u${Date.now()}` }])
    const started = Date.now()
    setPending({ since: started, q })
    const tick = setInterval(() => setPending((p) => (p ? { ...p, now: Date.now() } : p)), 500)
    try {
      const out = await api('/ask', {
        method: 'POST',
        body: { notebook: notebook.id, question: q, thread: 'default' },
        timeoutMs: 180000
      })
      setMsgs((m) => [...m, {
        role: 'assistant', content: out.answer, k: `a${Date.now()}`,
        citations: out.citations || [], seconds: out.seconds,
        meta: `${out.chunks_used || 0} of ${out.total_chunks || 0} passages`
      }])
    } catch (e) {
      setMsgs((m) => [...m, {
        role: 'assistant', content: `**That question did not get an answer.**\n\n${e.message || e}`,
        k: `e${Date.now()}`, error: true
      }])
      if (onSay) onSay(e.message || 'ask failed')
    } finally {
      clearInterval(tick)
      setPending(null)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const elapsed = pending ? Math.round(((pending.now || Date.now()) - pending.since) / 1000) : 0

  return el('div', { className: 'nb-chat' },
    el('div', { className: 'nb-thread', ref: threadRef, role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' },
      msgs.length === 0 && !pending
        ? el('div', { style: { margin: 'auto', textAlign: 'center', maxWidth: '54ch' } },
            el('div', { style: { display: 'grid', placeItems: 'center', gap: '10px' } },
              el('span', { className: 'nb-mark', style: { width: '38px', height: '38px' } },
                jsx(Glyph, { name: 'sparkle', size: 19 })),
              el('div', { style: { fontSize: '20px', fontWeight: 650, letterSpacing: '-.015em' }, children: 'Ask the sources' }),
              el('div', {
                style: { color: T.text3, fontSize: '14.5px', lineHeight: 1.6 },
                children: 'Every answer is built from this notebook and cites the source it came from. If the sources do not cover it, the answer says so.'
              })))
        : null,
      msgs.map((m) => jsx(Msg, { msg: m, onCite, onOpenSource }, m.k)),
      pending
        ? el('div', { className: 'nb-msg', 'data-role': 'assistant' },
            el('span', { className: 'nb-avatar', children: 'HN' }),
            el('div', { className: 'nb-msg-body' },
              el('div', { className: 'nb-who', children: 'Reading sources' }),
              el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: T.text3, fontSize: '14.5px' } },
                el('span', { className: 'nb-dot', style: { background: T.accent, boxShadow: `0 0 8px ${T.accent}` } }),
                `retrieving passages · ${elapsed}s`)))
        : null
    ),

    el('div', { className: 'nb-composer' },
      msgs.length === 0 && !pending
        ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' } },
            SUGGEST.map((s) => jsx(Chip, {
              key: s, onClick: () => { setText(s); const n = boxRef.current; if (n) n.focus() },
              title: 'Use this question', children: s
            })))
        : null,
      el('div', { className: 'nb-askbox' },
        el('textarea', {
          ref: boxRef, value: text, onChange: (e) => setText(e.target.value), onKeyDown: onKey,
          placeholder: 'Ask anything — the answer cites the source it came from',
          'aria-label': 'Ask the notebook',
          rows: 2
        }),
        el('div', { className: 'nb-askfoot' },
          el('span', { className: 'nb-hint' },
            modelReady ? '⏎ send · ⇧⏎ newline' : 'model offline — enable the plugin and restart the gateway'),
          el('span', { style: { flex: 1 } }),
          jsx(Btn, {
            variant: 'primary', icon: 'send', onClick: () => send(), disabled: !text.trim() || !!pending,
            children: pending ? 'Asking…' : 'Send'
          }))
      )
    )
  )
}

function Msg({ msg, onCite }) {
  const isUser = msg.role === 'user'
  return el('div', { className: 'nb-msg', 'data-role': isUser ? 'user' : 'assistant' },
    isUser ? null : el('span', { className: 'nb-avatar', children: 'HN' }),
    el('div', { className: 'nb-msg-body' },
      isUser
        ? el('div', { className: 'nb-bubble' },
            el('div', { className: 'nb-who', children: 'You' }),
            el('div', { children: msg.content }))
        : el('div', null,
            el('div', { className: 'nb-who' },
              'Hermes Notebook',
              msg.meta ? el('span', { style: { marginLeft: '8px', color: T.text4, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }, children: `· ${msg.meta}` }) : null),
            el('div', { className: 'nb-bubble' },
              jsx(Markdown, { text: msg.content, onCite })),
            (msg.citations || []).length
              ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }, role: 'list', 'aria-label': 'Citations' },
                  msg.citations.map((c) => el('button', {
                    key: `${c.n}-${c.title}`, type: 'button', className: 'nb-chip nb-citechip',
                    onClick: () => onCite && onCite(c.n),
                    title: c.origin || c.title,
                    'aria-label': `Citation ${c.n} — ${c.title}`,
                    children: [el('b', { children: `S${c.n}` }), el('span', { children: c.title })]
                  })))
              : null))
  )
}

/* ---------------------------------------------------------------- peek */

function SourcePeek({ source, notebook, onClose }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    setText('')
    api(`/source_text?${qs({ notebook: notebook.id, id: source.id, chars: 24000 })}`)
      .then((out) => { if (live) setText(out.text || '') })
      .catch((e) => { if (live) setErr(e.message || String(e)) })
    return () => { live = false }
  }, [source.id, notebook.id])
  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: `S${source.n}` }),
      el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { className: 'nb-view-title', children: source.title }),
        el('div', { style: { fontSize: '12.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
          children: `${source.kind} · ${nfmt(source.chars)} chars · ${source.origin || 'stored text'}` })),
      source.origin && source.origin.startsWith('http')
        ? jsx(IconBtn, { icon: 'external', label: 'Open the original', onClick: () => host.openLink ? host.openLink(source.origin) : window.open(source.origin, '_blank') })
        : null,
      jsx(IconBtn, { icon: 'close', label: 'Close source', onClick: onClose })
    ),
    el('div', { className: 'nb-view-body' },
      err
        ? el('div', { style: { color: T.danger }, children: err })
        : text
          ? el('pre', {
              className: 'nb-mono',
              style: { whiteSpace: 'pre-wrap', fontSize: '14.5px', lineHeight: 1.7, color: T.text2, margin: 0 },
              children: text
            })
          : el('div', { className: 'nb-hint', children: 'reading…' }))
  )
}

/* --------------------------------------------------------------- studio panel */

function StudioPanel({ kinds, notebook, busy, generate, filter, setFilter, picked, onOpen }) {
  const ready = latestByKind(notebook ? notebook.artifacts : [])
  const shown = kinds.filter((k) => filter === 'all' || k.group === filter)
  const scrollRef = useRef(null)
  const [canScroll, setCanScroll] = useState(false)

  // A grid taller than the panel is fine, but a row sliced at the panel edge
  // with no affordance reads as broken: measure, then show the fade.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return undefined
    const check = () => setCanScroll(node.scrollHeight > node.clientHeight + 2)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    if (ro) ro.observe(node)
    node.addEventListener('scroll', check, { passive: true })
    return () => { if (ro) ro.disconnect(); node.removeEventListener('scroll', check) }
  }, [shown.length])

  // The index is grouped like a table of contents: a section rule, then its
  // plates. The backend's kind order interleaves groups (media, docs, study,
  // docs…), so bucket first and walk the groups in a fixed reading order —
  // a run-length scan would emit a header every time the group changed.
  const buckets = new Map()
  for (const k of shown) {
    const g = k.group || 'other'
    if (!buckets.has(g)) buckets.set(g, [])
    buckets.get(g).push(k)
  }
  const groupOrder = GROUP_ORDER.filter((g) => buckets.has(g))
    .concat([...buckets.keys()].filter((g) => !GROUP_ORDER.includes(g)))
  let plate = 0
  const rows = []
  for (const g of groupOrder) {
    const list = buckets.get(g)
    if (filter === 'all') {
      const readyHere = list.filter((x) => ready[x.id]).length
      rows.push(el('div', { className: 'nb-grouprow', key: `g-${g}` },
        el('span', { children: GROUP_LABEL[g] || 'Outputs' }),
        el('i', { 'aria-hidden': 'true' }),
        el('em', { children: `${readyHere}/${list.length}` })))
    }
    for (const k of list) {
      plate += 1
      rows.push(jsx(StudioCard, {
        key: k.id, kind: k, art: ready[k.id], started: busy[k.id],
        plate: String(plate).padStart(2, '0'),
        onOpen: () => { const a = ready[k.id]; if (a) onOpen(a); else generate(k.id) },
        onRegenerate: () => generate(k.id)
      }))
    }
  }

  return el('aside', { className: 'nb-col nb-studio', 'aria-label': 'Studio outputs' },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-meta', children: 'Studio index' }),
      el('span', {
        className: 'nb-chip',
        'data-tone': Object.keys(ready).length ? 'ok' : undefined,
        children: `${Object.keys(ready).length}/${kinds.length} ready`
      })
    ),
    el('div', { className: 'nb-pad', style: { paddingBottom: 0 } },
      jsx(Seg, {
        label: 'Filter studio outputs', value: filter, onChange: setFilter, fill: true,
        options: FILTERS.map((f) => ({
          id: f.id,
          label: f.id === 'all' ? 'All' : f.label,
          title: `${f.label} outputs`
        }))
      })
    ),
    el('div', { className: 'nb-scroll', ref: scrollRef, 'data-scrollable': canScroll ? 'true' : 'false' },
      el('div', { className: 'nb-grid' }, rows)
    ),
    canScroll ? jsx('div', { className: 'nb-fade', 'aria-hidden': 'true' }) : null
  )
}

const GROUP_ORDER = ['docs', 'study', 'media', 'visual']
const GROUP_LABEL = {
  docs: 'Documents', study: 'Study', media: 'Media', visual: 'Visual', other: 'Other'
}

function StudioCard({ kind, art, started, plate, onOpen, onRegenerate }) {
  const [, force] = useState(0)
  useEffect(() => {
    if (!started) return undefined
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [started])
  const secs = started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : 0
  const state = started ? `writing · ${secs}s` : art ? `ready · ${ago(art.modified)}` : 'Generate'
  return el('button', {
    type: 'button', className: 'nb-card',
    'data-ready': art ? 'true' : 'false', 'data-busy': started ? 'true' : 'false',
    onClick: started ? undefined : onOpen,
    'aria-label': `${kind.label} — ${state}. ${art ? 'Open it' : 'Generate it'}`,
    title: art ? `${kind.label} · ${art.primary}` : `Generate ${kind.label}`,
    children: [
      el('span', { className: 'nb-plate', children: plate }),
      el('span', { className: 'nb-card-main' },
        el('span', { className: 'nb-card-name' },
          jsx(Glyph, { name: KIND_ICON[kind.id] || 'doc', size: 13 }),
          el('span', { children: kind.label })),
        el('span', { className: 'nb-card-blurb', children: kind.blurb }),
        started
          ? el('span', { className: 'nb-bar-track' },
              el('span', {
                className: 'nb-bar-fill',
                style: { width: `${Math.min(96, 12 + secs * 2.2)}%`, opacity: 0.9 }
              }))
          : null),
      el('span', { className: 'nb-card-state' },
        el('span', {
          className: 'nb-dot',
          style: { background: started ? T.accent : art ? T.ok : undefined }
        }),
        started ? `${secs}s` : art ? ago(art.modified) : 'generate')
    ]
  })
}

/* -------------------------------------------------------------- status bar */

function StatusBar({ mode, notebook, data, note, opsStats }) {
  const ready = data && data.model_ready
  const ops = mode === 'ops'
  return el('footer', { className: 'nb-status', role: 'contentinfo' },
    ops
      ? el('span', null,
          jsx('span', {
            className: 'nb-sdot',
            style: { background: opsStats && opsStats.down ? T.warn : T.ok }
          }),
          opsStats
            ? `${opsStats.hosts} hosts · ${opsStats.patched} patched · ${opsStats.exposed} fix available · ${opsStats.down} unreachable`
            : 'measuring the fleet…')
      : el('span', null,
          jsx('span', { className: 'nb-sdot', style: { background: ready ? T.ok : T.warn } }),
          ready ? 'grounded · model ready' : 'model offline — enable the plugin'),
    !ops && notebook
      ? el('span', null, jsx('b', { children: notebook.stats.sources }), ' sources · ',
          jsx('b', { children: nfmt(notebook.stats.chars) }), ' chars · ',
          jsx('b', { children: notebook.stats.labels }), ' labels')
      : null,
    !ops && notebook && notebook.stats.unlabeled
      ? jsx('span', {
          style: { color: T.warn },
          children: `${notebook.stats.unlabeled} source${notebook.stats.unlabeled === 1 ? '' : 's'} unlabeled — press “label” on the rail`
        })
      : null,
    note ? jsx('span', { style: { color: T.accent }, children: note }) : null,
    el('span', { style: { flex: 1 } }),
    jsx('span', { className: 'nb-mono', style: { fontSize: '11.5px' },
      children: ops ? 'ssh · audited transport' : (notebook ? notebook.id : 'no notebook') }),
    data && !ops ? jsx('span', { className: 'nb-mono', style: { fontSize: '11.5px' },
      children: `synced ${clock(data.generated_at)}` }) : null
  )
}

/* ---------------------------------------------------------------- dialogs */

const SOURCE_MODES = [
  { id: 'url', label: 'Web URL', icon: 'link' },
  { id: 'path', label: 'File path', icon: 'file' },
  { id: 'text', label: 'Paste text', icon: 'note' }
]

function AddSourceDialog({ open, onClose, notebook, onDone }) {
  const [mode, setMode] = useState('url')
  const [value, setValue] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!value.trim() || busy) return
    setBusy(true); setErr('')
    try {
      const body = { notebook: notebook.id, [mode]: value.trim() }
      if (title.trim()) body.title = title.trim()
      const out = await api('/source', { method: 'POST', body, timeoutMs: 120000 })
      setValue(''); setTitle('')
      await onDone(out.source && out.source.title ? `added ${out.source.title}` : 'source added')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }
  return jsx(Dialog, {
    open, onClose, title: 'Add a source',
    children: el('div', null,
      el('p', { style: { margin: '0 0 14px', color: T.text3, fontSize: '14.5px', lineHeight: 1.55 },
        children: 'A source is anything the notebook can cite: a URL, a file on this machine, or text you paste. It is extracted, labelled and indexed on the way in.' }),
      jsx(Seg, { label: 'Source kind', value: mode, onChange: setMode, options: SOURCE_MODES }),
      el('div', { style: { marginTop: '14px', display: 'grid', gap: '10px' } },
        mode === 'text'
          ? el('textarea', {
              className: 'nb-mono', value, onChange: (e) => setValue(e.target.value), autoFocus: true,
              placeholder: 'Paste notes, a transcript, a spec…', 'aria-label': 'Pasted source text',
              style: {
                minHeight: '160px', borderRadius: '10px', border: `1px solid ${T.line}`,
                background: T.cardDeep, color: T.text, padding: '12px', fontSize: '14px',
                lineHeight: 1.55, resize: 'vertical', outline: 'none'
              }
            })
          : el('div', { className: 'nb-field', style: { height: '40px' } },
              jsx(Glyph, { name: mode === 'url' ? 'link' : 'file', size: 14 }),
              el('input', {
                value, onChange: (e) => setValue(e.target.value), autoFocus: true,
                onKeyDown: (e) => { if (e.key === 'Enter') submit() },
                placeholder: mode === 'url' ? 'https://… or a YouTube link' : '/home/you/doc.pdf',
                'aria-label': mode === 'url' ? 'Source URL' : 'File path'
              })),
        el('div', { className: 'nb-field', style: { height: '40px' } },
          jsx(Glyph, { name: 'note', size: 14 }),
          el('input', {
            value: title, onChange: (e) => setTitle(e.target.value),
            placeholder: 'Title (optional — derived when left blank)',
            'aria-label': 'Source title'
          }))
      ),
      err ? el('div', { style: { marginTop: '12px', color: T.danger, fontSize: '14px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
        jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, {
          variant: 'primary', icon: 'plus', onClick: submit, disabled: busy || !value.trim(),
          children: busy ? 'Ingesting…' : 'Add source'
        }))
    )
  })
}

function NewNotebookDialog({ open, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async () => {
    if (!title.trim() || busy) return
    setBusy(true); setErr('')
    try {
      const out = await api('/notebook', { method: 'POST', body: { title: title.trim(), description: desc.trim() } })
      setTitle(''); setDesc('')
      await onDone(out.id)
    } catch (e) {
      setErr(e.message || String(e))
    } finally { setBusy(false) }
  }
  return jsx(Dialog, {
    open, onClose, title: 'New notebook',
    children: el('div', null,
      el('div', { style: { display: 'grid', gap: '10px' } },
        el('div', { className: 'nb-field', style: { height: '40px' } },
          jsx(Glyph, { name: 'book', size: 14 }),
          el('input', {
            value: title, onChange: (e) => setTitle(e.target.value), autoFocus: true,
            placeholder: 'What is this notebook about?', 'aria-label': 'Notebook title',
            onKeyDown: (e) => { if (e.key === 'Enter') submit() }
          })),
        el('textarea', {
          value: desc, onChange: (e) => setDesc(e.target.value),
          placeholder: 'One line of context (optional) — it steers the labels and the studio copy.',
          'aria-label': 'Notebook description',
          style: {
            minHeight: '80px', borderRadius: '10px', border: `1px solid ${T.line}`,
            background: T.cardDeep, color: T.text, padding: '12px', fontSize: '14.5px',
            lineHeight: 1.5, resize: 'vertical', outline: 'none'
          }
        })),
      err ? el('div', { style: { marginTop: '12px', color: T.danger, fontSize: '14px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
        jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, { variant: 'primary', icon: 'check', onClick: submit, disabled: busy || !title.trim(),
          children: busy ? 'Creating…' : 'Create notebook' }))
    )
  })
}

/* ------------------------------------------------------------------ viewers
 * One file loader, one switch. Media goes through base64 → blob because a
 * renderer cannot attach the desktop grant to <video src>; the route it calls
 * is the same one that serves the bytes.
 */
function useFile(notebookId, name) {
  const [st, setSt] = useState({ loading: !!name, text: '', json: null, url: '', mime: '', error: '' })
  useEffect(() => {
    if (!name) { setSt({ loading: false, text: '', json: null, url: '', mime: '', error: '' }); return undefined }
    let live = true
    let made = ''
    setSt({ loading: true, text: '', json: null, url: '', mime: '', error: '' })
    api(`/artifact?${qs({ notebook: notebookId, name, b64: 1 })}`, { timeoutMs: 90000 })
      .then((out) => {
        if (!live) return
        const raw = atob(out.b64 || '')
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
        const isText = (out.mime || '').startsWith('text/') || /^(md|txt|json|csv)$/.test(out.ext)
        if (isText) {
          const text = new TextDecoder().decode(bytes)
          let json = null
          if (out.ext === 'json') { try { json = JSON.parse(text) } catch { json = null } }
          setSt({ loading: false, text, json, url: '', mime: out.mime, error: '' })
        } else {
          made = URL.createObjectURL(new Blob([bytes], { type: out.mime || 'application/octet-stream' }))
          setSt({ loading: false, text: '', json: null, url: made, mime: out.mime, bytes: out.bytes, error: '' })
        }
      })
      .catch((e) => { if (live) setSt({ loading: false, text: '', json: null, url: '', mime: '', error: e.message || String(e) }) })
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [notebookId, name])
  return st
}

function Viewer({ artifact, notebook, onCite }) {
  const files = artifact.files || []
  const jsonName = (files.find((f) => f.ext === 'json') || {}).name || ''
  const txtName = (files.find((f) => f.ext === 'txt') || {}).name || ''
  const primary = useFile(notebook.id, artifact.primary)
  const asJson = useFile(notebook.id, jsonName)
  const asTxt = useFile(notebook.id, txtName)
  const [regen, setRegen] = useState(false)

  const downloading = (url, name) => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = name || 'artifact'
    document.body.appendChild(a); a.click(); a.remove()
  }

  let body
  if (primary.error) body = el('div', { className: 'nb-view-body', style: { color: T.danger }, children: primary.error })
  else if (primary.loading) body = el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-hint', children: 'loading artifact…' }))
  else if (artifact.kind === 'video_overview') {
    body = jsx(VideoView, { src: primary.url, json: asJson.json, text: asTxt.text })
  } else if (artifact.kind === 'audio_overview') {
    body = jsx(AudioView, { src: primary.url, json: asJson.json, text: asTxt.text })
  } else if (artifact.kind === 'mind_map') {
    body = jsx(MindMapView, { data: asJson.json, text: primary.text })
  } else if (artifact.kind === 'flashcards') {
    body = jsx(FlashcardsView, { data: asJson.json, text: primary.text, key: artifact.key })
  } else if (artifact.kind === 'quiz') {
    body = jsx(QuizView, { data: asJson.json, text: primary.text })
  } else if (artifact.kind === 'slides') {
    body = jsx(SlidesView, { data: asJson.json, text: primary.text, htmlUrl: primary.url && artifact.ext === 'html' ? primary.url : '' })
  } else if (artifact.kind === 'infographic') {
    body = jsx(InfographicView, { src: primary.url, data: asJson.json })
  } else if (artifact.kind === 'timeline') {
    body = jsx(TimelineView, { text: primary.text, onCite })
  } else {
    body = el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-doc' }, jsx(Markdown, { text: primary.text, onCite })))
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: artifact.label }),
      el('div', { style: { flex: 1, minWidth: 0 } },
        el('div', { className: 'nb-view-title', children: (asJson.json && (asJson.json.title || asJson.json.topic)) || prettyFile(artifact.primary) }),
        el('div', { style: { fontSize: '12.5px', color: T.text4 },
          children: `${artifact.files.length} file${artifact.files.length === 1 ? '' : 's'} · ${Math.max(1, Math.round(artifact.bytes / 1024))} KB · ${ago(artifact.modified)}` })),
      jsx(IconBtn, {
        icon: 'download', label: `Download ${artifact.label}`,
        onClick: () => downloading(primary.url, artifact.primary)
      }),
      jsx(IconBtn, {
        icon: 'refresh', label: `Regenerate ${artifact.label}`, active: regen,
        onClick: () => setRegen(true)
      })
    ),
    body
  )
}

const prettyFile = (name) => {
  const stem = String(name || '').replace(/\.[a-z0-9]+$/i, '')
  return stem.replace(/^\d{8}-\d{6}-/, '').replace(/_/g, ' ')
}

/* --------------------------------------------------------------- video */

function VideoView({ src, json, text }) {
  const segs = (json && (json.segments || json.beats || json.scenes)) || []
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', { className: 'nb-screen' },
        src
          ? el('video', { src, controls: true, playsInline: true, preload: 'metadata' })
          : el('div', { className: 'nb-hint', children: 'the video file did not load' })),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { className: 'nb-chip', 'data-tone': 'ok', children: 'mp4 · h264' }),
        json && json.title ? el('span', { style: { fontSize: '15px', fontWeight: 600 }, children: json.title }) : null,
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-hint', children: segs.length ? `${segs.length} beats` : 'narrated slideshow' })),
      segs.length
        ? el('ol', { className: 'nb-timeline', 'aria-label': 'Video chapters' },
            segs.map((s, i) => el('li', { className: 'nb-tl', key: `s${i}` },
              el('span', { className: 'nb-tl-when', children: `BEAT ${i + 1}` }),
              el('span', { className: 'nb-tl-what' },
                el('b', { children: s.headline || s.title || s.label || '' }),
                s.sub || s.subline ? el('span', { style: { color: T.text3 }, children: ` — ${s.sub || s.subline}` }) : null,
                s.text || s.narration
                  ? el('span', { style: { display: 'block', color: T.text3, marginTop: '3px', fontSize: '14px' }, children: s.text || s.narration })
                  : null))))
        : (text ? el('pre', { className: 'nb-mono', style: { whiteSpace: 'pre-wrap', color: T.text3, fontSize: '13.5px' }, children: text }) : null))
  )
}

/* --------------------------------------------------------------- audio */

function AudioView({ src, json, text }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)

  const lines = useMemo(() => {
    const out = []
    for (const raw of String(text || '').split('\n')) {
      let l = raw.trim()
      if (!l) continue
      if (/^#\s/.test(l)) { out.push({ who: '', text: l.replace(/^#\s*/, ''), head: true }); continue }
      if (/^[_*]{1,2}[^_*].*[_*]{1,2}$/.test(l) && l.length < 160) {
        out.push({ who: '', text: l.replace(/^[_*]+|[_*]+$/g, ''), meta: true })
        continue
      }
      // "**Host A:** text" and "Host A: text" both appear in the transcript file
      l = l.replace(/\*\*/g, '')
      const m = /^\[?\s*(host\s*[ab]|speaker\s*\d+)\s*\]?\s*[:—-]\s*(.*)$/i.exec(l)
      if (m) {
        const who = /b|2/i.test(m[1]) ? 'B' : 'A'
        out.push({ who, text: m[2] })
        continue
      }
      if (out.length) out.push({ who: out[out.length - 1].who, text: l })
    }
    return out
  }, [text])

  const bars = useMemo(() => {
    const n = 64
    const seedText = (json && json.title) || String(text || '').slice(0, 80) || 'overview'
    let x = 0
    for (let i = 0; i < seedText.length; i += 1) x = (x * 31 + seedText.charCodeAt(i)) % 100000
    const out = []
    for (let i = 0; i < n; i += 1) {
      x = (x * 1103515245 + 12345) % 2147483648
      const base = 0.22 + Math.abs(Math.sin(i / 5)) * 0.5
      out.push(Math.max(0.14, Math.min(1, base + (x % 100) / 260)))
    }
    return out
  }, [text, json])

  const progress = dur ? t / dur : 0

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', { className: 'nb-screen nb-screen-audio', style: { aspectRatio: 'auto' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          el('span', { className: 'nb-chip', 'data-tone': 'accent', children: 'TWO HOSTS' }),
          el('span', { style: { fontSize: '16px', fontWeight: 620, color: '#eee' },
            children: (json && json.title) || 'Audio Overview' }),
          el('span', { style: { flex: 1 } }),
          el('span', { className: 'nb-mono', style: { fontSize: '12.5px', color: '#9aa0b5' },
            children: `${fmtTime(t)} / ${dur ? fmtTime(dur) : '—'}` })),
        el('div', {
          className: 'nb-wave', role: 'img',
          'aria-label': `waveform, ${Math.round(progress * 100)} percent played`,
          onClick: (e) => {
            const box = e.currentTarget.getBoundingClientRect()
            const frac = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
            const el2 = audioRef.current
            if (el2 && dur) { el2.currentTime = frac * dur; setT(el2.currentTime) }
          },
          style: { cursor: 'pointer' }
        }, bars.map((h, i) => jsx('i', {
          key: `b${i}`,
          style: { height: `${Math.round(h * 100)}%` },
          'data-past': i / bars.length <= progress ? 'true' : 'false'
        }))),
        el('div', { className: 'nb-ctrl' },
          el('button', {
            type: 'button', className: 'nb-icon', 'aria-label': playing ? 'Pause' : 'Play',
            onClick: () => {
              const a = audioRef.current
              if (!a) return
              if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
            },
            style: { background: 'rgba(255,255,255,.1)', width: '40px', height: '40px' },
            children: jsx(Glyph, { name: playing ? 'pause' : 'play', size: 16 })
          }),
          el('input', {
            type: 'range', min: 0, max: 100, value: Math.round(progress * 100),
            'aria-label': 'Scrub audio', style: { flex: 1, accentColor: T.accent },
            onChange: (e) => {
              const a = audioRef.current
              if (a && dur) { a.currentTime = (Number(e.target.value) / 100) * dur }
            }
          }),
          el('span', { className: 'nb-chip', children: '1.0×' })),
        el('audio', {
          ref: audioRef, src: src || undefined, preload: 'metadata',
          onTimeUpdate: (e) => setT(e.currentTarget.currentTime),
          onLoadedMetadata: (e) => setDur(e.currentTarget.duration || 0),
          onEnded: () => setPlaying(false),
          style: { display: 'none' }
        })),
      lines.length
        ? el('div', { className: 'nb-doc', style: { maxWidth: '100%' } },
            el('div', { className: 'nb-meta', style: { marginBottom: '10px' }, children: 'Transcript' }),
            lines.map((l, i) => jsx(TranscriptLine, { line: l, first: i === 0 }, `l${i}`)))
        : null)
  )
}

function TranscriptLine({ line, first }) {
  if (line.head) {
    return jsx('div', {
      style: { fontSize: '17px', fontWeight: 650, letterSpacing: '-.01em', margin: '0 0 6px' },
      children: line.text
    })
  }
  if (line.meta) {
    return jsx('div', {
      style: { fontSize: '12.5px', color: T.text4, marginBottom: '10px' },
      children: line.text
    })
  }
  return el('div', {
    style: {
      display: 'grid', gridTemplateColumns: '26px 1fr', gap: '10px',
      padding: '7px 0', borderTop: first ? 'none' : `1px solid ${T.lineSoft}`
    }
  },
  jsx('span', {
    style: {
      fontSize: '11.5px', fontWeight: 700, letterSpacing: '.04em',
      color: line.who === 'B' ? T.purple : T.accent,
      fontFamily: 'var(--ui-font-mono, ui-monospace, monospace)'
    },
    children: line.who || '·'
  }),
  jsx('span', { style: { fontSize: '15px', lineHeight: 1.55, color: T.text2 }, children: line.text }))
}

const fmtTime = (s) => {
  const v = Math.max(0, Math.round(Number(s) || 0))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

/* --------------------------------------------------------------- mind map */

function MindMapView({ data, text }) {
  const tree = useMemo(() => (data && data.children ? data : parseMindMapMd(text)), [data, text])
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef(null)
  const { nodes, width, height } = useMemo(() => layoutTree(tree), [tree])

  if (!nodes.length) {
    return el('div', { className: 'nb-view-body' },
      jsx('div', { className: 'nb-hint', children: 'no mind map structure in this artifact' }))
  }

  const nodeEls = nodes.map((n, i) => jsx('g', { key: `n${i}`, children: [
    n.parent >= 0
      ? jsx('path', {
          d: curve(nodes[n.parent], n),
          fill: 'none',
          stroke: `color-mix(in srgb, ${T.accent} ${n.depth === 1 ? 52 : 34}%, transparent)`,
          strokeWidth: n.depth === 1 ? 1.8 : 1.3
        })
      : null,
    jsx('rect', {
      x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: 9,
      fill: n.depth === 0
        ? `color-mix(in srgb, ${T.accent} 24%, transparent)`
        : n.depth === 1
          ? `color-mix(in srgb, ${T.accent} 9%, var(--ui-bg-primary, #101116))`
          : 'var(--ui-bg-primary, #101116)',
      stroke: `color-mix(in srgb, ${T.accent} ${n.depth === 0 ? 62 : n.depth === 1 ? 34 : 20}%, transparent)`
    }),
    jsx('text', {
      x: n.x, y: n.y + (n.depth === 0 ? 5 : 4), textAnchor: 'middle',
      fill: n.depth === 0 ? T.text : n.depth === 1 ? T.text : T.text2,
      fontSize: n.depth === 0 ? 18 : n.depth === 1 ? 16 : 14.5,
      fontWeight: n.depth <= 1 ? 660 : 500,
      children: n.label
    }),
    n.detail ? jsx('title', { children: `${n.label} — ${n.detail}` }) : null
  ].filter(Boolean) }))

  const canvas = jsx('svg', {
    className: 'nb-map', viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `Mind map: ${(tree && tree.label) || 'root'} with ${nodes.length} nodes`,
    preserveAspectRatio: 'xMidYMid meet',
    onWheel: (e) => {
      e.preventDefault()
      setZoom((z) => Math.min(2.4, Math.max(0.55, z - e.deltaY * 0.0012)))
    },
    onPointerDown: (e) => {
      drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e) => {
      if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
    },
    onPointerUp: () => { drag.current = null },
    onPointerCancel: () => { drag.current = null },
    children: el('g', {
      transform: `translate(${pan.x} ${pan.y}) translate(${width / 2} ${height / 2}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`
    }, nodeEls)
  })

  const toolbar = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' } },
    jsx('span', { className: 'nb-hint', children: `${nodes.length} nodes · drag to pan · scroll to zoom · hover a node for its detail` }),
    el('span', { style: { flex: 1 } }),
    jsx(Btn, {
      size: 'sm', icon: 'grid', children: 'Reset view',
      onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }) }
    }))

  return el('div', { className: 'nb-view-body', style: { padding: '12px', display: 'flex', flexDirection: 'column' } },
    toolbar,
    el('div', { style: { flex: 1, minHeight: '340px' } }, canvas))
}

function curve(a, b) {
  const mx = (a.x + b.x) / 2
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`
}

function layoutTree(tree) {
  const nodes = []
  if (!tree) return { nodes, width: 900, height: 560 }

  const labelOf = (n) => String(n.label || n.title || 'node')
  const measure = (label, depth) => {
    const fs = depth === 0 ? 18 : depth === 1 ? 16 : 14.5
    const w = Math.min(232, 26 + label.length * fs * 0.58)
    return { w, h: depth === 0 ? 44 : 34 }
  }

  // depth-first with a leaf cursor: leaves get one slot each, parents centre on
  // their children — the layout a mind map is actually read with.
  let cursor = 0
  const rowH = 38
  const walk = (node, depth, parent) => {
    const kids = (node.children || []).filter((c) => c && typeof c === 'object').slice(0, 8)
    const index = nodes.length
    nodes.push({ label: '', detail: node.detail || '', depth, parent, x: 0, y: 0, w: 0, h: 0 })
    let y
    if (!kids.length) {
      y = cursor * rowH
      cursor += 1
    } else {
      const ys = kids.map((c) => walk(c, depth + 1, index))
      y = (ys[0] + ys[ys.length - 1]) / 2
    }
    const label = labelOf(node)
    const { w, h } = measure(label, depth)
    nodes[index] = { ...nodes[index], label, x: 0, y, w, h }
    return y
  }
  walk(tree, 0, -1)

  // x per depth = running maximum width of the previous column + a gap
  const byDepth = []
  for (const n of nodes) {
    byDepth[n.depth] = Math.max(byDepth[n.depth] || 0, n.w)
  }
  const gap = 58
  const pad = 34
  const xs = []
  let x = pad
  for (let d = 0; d < byDepth.length; d += 1) {
    xs[d] = x + byDepth[d] / 2
    x += byDepth[d] + gap
  }
  for (const n of nodes) n.x = xs[n.depth]

  const width = Math.max(420, x - gap + pad)
  const height = Math.max(240, (Math.max(cursor, 1) - 1) * rowH + 64)
  for (const n of nodes) n.y += 30
  return { nodes, width, height }
}

function parseMindMapMd(text) {
  // the .md render writes "- label — detail" with 2-space depth
  const lines = String(text || '').split('\n')
  const root = { label: 'Mind map', children: [] }
  const stack = [{ node: root, depth: -1 }]
  for (const line of lines) {
    const m = /^(\s*)-\s+(.*)$/.exec(line)
    if (!m) continue
    const depth = Math.floor(m[1].length / 2)
    const [label, detail] = m[2].split(' — ')
    const node = { label: label.trim(), detail: (detail || '').trim(), children: [] }
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const parent = stack.length ? stack[stack.length - 1].node : root
    parent.children.push(node)
    stack.push({ node, depth })
  }
  return root.children.length ? root : null
}

/* ------------------------------------------------------------ flashcards */

function FlashcardsView({ data, text }) {
  const cards = (data && data.cards) || []
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(() => persist.get('known:cards', {}) || {})

  useEffect(() => { setI(0); setFlipped(false) }, [cards.length])
  if (!cards.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const card = cards[Math.min(i, cards.length - 1)]
  const mark = (val) => {
    const next = { ...known, [i]: val }
    setKnown(next); persist.set('known:cards', next)
    setFlipped(false)
    setI((n) => Math.min(cards.length - 1, n + 1))
  }
  const knownCount = Object.values(known).filter(Boolean).length

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-deck' },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        jsx('span', { className: 'nb-chip', 'data-tone': Object.keys(known).length ? 'ok' : undefined,
          children: `${knownCount} known` }),
        jsx('span', { className: 'nb-hint', children: `card ${i + 1} of ${cards.length}` }),
        el('span', { style: { flex: 1 } }),
        jsx(Btn, {
          size: 'sm', icon: 'refresh', children: 'Restart',
          onClick: () => { setI(0); setFlipped(false); setKnown({}); persist.set('known:cards', {}) }
        })),
      jsx('button', {
        type: 'button', className: 'nb-flip', 'data-flipped': flipped ? 'true' : 'false',
        onClick: () => setFlipped((f) => !f),
        'aria-label': flipped ? 'Show the question again' : 'Show the answer',
        children: el('div', { className: 'nb-flip-inner' },
          el('div', { className: 'nb-face', 'data-side': 'front' },
            jsx('span', { className: 'nb-meta', children: 'question' }),
            jsx('span', { children: card.front }),
            jsx('span', { className: 'nb-face-hint', children: 'click the card — or press “Show answer” — to flip' })),
          el('div', { className: 'nb-face', 'data-side': 'back' },
            jsx('span', { className: 'nb-meta', children: 'answer' }),
            jsx('span', { children: card.back }),
            card.source ? jsx('span', { style: { fontSize: '13px', color: T.text3, marginTop: 'auto' }, children: card.source }) : null))
      }),
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' } },
        jsx(Btn, {
          icon: 'arrowLeft', disabled: i === 0, children: 'Prev',
          onClick: () => { setFlipped(false); setI((n) => Math.max(0, n - 1)) }
        }),
        flipped
          ? jsx(Btn, { icon: 'close', onClick: () => mark(false), children: 'Again' })
          : jsx(Btn, {
              variant: 'primary', icon: 'refresh', children: 'Show answer',
              onClick: () => setFlipped(true)
            }),
        flipped
          ? jsx(Btn, { variant: 'primary', icon: 'check', onClick: () => mark(true), children: 'Got it' })
          : null,
        jsx(Btn, {
          icon: 'arrowRight', disabled: i === cards.length - 1, children: 'Next',
          onClick: () => { setFlipped(false); setI((n) => Math.min(cards.length - 1, n + 1)) }
        })),
      el('div', { className: 'nb-bar-track', style: { maxWidth: '100%' } },
        el('div', { className: 'nb-bar-fill', style: { width: `${((i + 1) / cards.length) * 100}%` } })))
  )
}

/* ------------------------------------------------------------------ quiz */

function QuizView({ data, text }) {
  const questions = (data && (data.questions || data.items)) || []
  const [picked, setPicked] = useState({})
  if (!questions.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const score = questions.reduce((acc, q, i) => {
    const chosen = picked[i]
    if (chosen === undefined) return acc
    return acc + (normAnswer(chosen) === normAnswer(q.answer) ? 1 : 0)
  }, 0)
  const answered = Object.keys(picked).length
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { maxWidth: '76ch' } },
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' } },
        el('span', { className: 'nb-chip', 'data-tone': answered === questions.length ? 'ok' : 'accent',
          children: `${answered}/${questions.length} answered` }),
        answered ? el('span', { className: 'nb-chip', children: `${score} correct` }) : null,
        el('span', { style: { flex: 1 } }),
        answered ? jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => setPicked({}), children: 'Reset' }) : null),
      questions.map((q, qi) => {
        const chosen = picked[qi]
        const done = chosen !== undefined
        const right = done && normAnswer(chosen) === normAnswer(q.answer)
        return el('div', {
          key: `q${qi}`,
          style: { border: `1px solid ${T.line}`, borderRadius: '12px', padding: '14px', marginBottom: '10px', background: T.card }
        },
        el('div', { style: { display: 'flex', gap: '10px', alignItems: 'baseline' } },
          el('span', { className: 'nb-mono', style: { color: T.text4, fontSize: '12.5px' }, children: String(qi + 1).padStart(2, '0') }),
          el('span', { style: { fontSize: '15.5px', fontWeight: 600, lineHeight: 1.45 }, children: q.question })),
        el('div', { style: { display: 'grid', gap: '6px', marginTop: '10px' }, role: 'group', 'aria-label': `Choices for question ${qi + 1}` },
          (q.choices && q.choices.length ? q.choices : [q.answer]).map((c, ci) => {
            const isChosen = chosen === c
            const isRight = normAnswer(c) === normAnswer(q.answer)
            const tone = !done ? T.card : isRight ? `color-mix(in srgb, ${T.ok} 16%, transparent)` : isChosen ? `color-mix(in srgb, ${T.danger} 14%, transparent)` : T.card
            return el('button', {
              type: 'button', disabled: done, onClick: () => setPicked((p) => ({ ...p, [qi]: c })),
              'aria-pressed': isChosen,
              style: {
                minHeight: '38px', textAlign: 'left', padding: '8px 12px', borderRadius: '9px',
                border: `1px solid ${isChosen || (done && isRight) ? T.line : T.lineSoft}`,
                background: tone, color: T.text, fontSize: '14.5px', cursor: done ? 'default' : 'pointer'
              },
              children: c
            }, `c${ci}`)
          })),
        done
          ? el('div', { style: { marginTop: '10px', fontSize: '14px', color: right ? T.ok : T.warn } },
              el('b', { children: right ? 'Correct. ' : `Not quite — ${q.answer}. ` }),
              q.explanation ? el('span', { style: { color: T.text2 }, children: q.explanation }) : null)
          : null)
      }))
  )
}

const normAnswer = (s) => String(s == null ? '' : s).trim().toLowerCase()
  .replace(/^[a-d][).]\s*/, '').replace(/[^a-z0-9 ]/g, '').trim()

/* ---------------------------------------------------------------- slides */

function SlidesView({ data, htmlUrl }) {
  const deck = data || {}
  const slides = deck.slides || []
  const [i, setI] = useState(0)
  const go = useCallback((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { go(1); }
      else if (e.key === 'ArrowLeft') { go(-1) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])

  if (!slides.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-hint', children: 'this deck has no slides in its json — open the html file' }))
  }
  const s = slides[i]
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', {
        className: 'nb-screen', role: 'group', 'aria-label': `Slide ${i + 1} of ${slides.length}`,
        style: { aspectRatio: '16/9', padding: '34px 40px', placeItems: 'stretch',
          background: `linear-gradient(150deg, color-mix(in srgb, ${T.accent} 18%, #0a0b10), #08090d)`,
          cursor: 'pointer', display: 'flex', flexDirection: 'column' },
        onClick: (e) => {
          const box = e.currentTarget.getBoundingClientRect()
          go((e.clientX - box.left) / box.width > 0.5 ? 1 : -1)
        }
      },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('span', { style: { fontSize: '11.5px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#9aa0b5', fontWeight: 700 },
          children: deck.title || 'Deck' }),
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-mono', style: { fontSize: '12px', color: '#9aa0b5' }, children: `${i + 1}/${slides.length}` })),
      el('div', { style: { fontSize: '30px', fontWeight: 680, letterSpacing: '-.02em', color: '#f2f3f8', margin: '18px 0 14px', lineHeight: 1.15 }, children: s.title }),
      el('ul', { style: { margin: 0, paddingLeft: '20px', color: '#d6d8e6', fontSize: '17px', lineHeight: 1.6, display: 'grid', gap: '9px' } },
        (s.bullets || []).map((b, bi) => el('li', { children: b }, `b${bi}`))),
      s.note ? el('div', { style: { marginTop: 'auto', fontSize: '13px', color: '#8b90a3', fontStyle: 'italic' }, children: s.note }) : null),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        jsx(Btn, { icon: 'arrowLeft', onClick: () => go(-1), disabled: i === 0, children: 'Back' }),
        jsx(Btn, { icon: 'arrowRight', onClick: () => go(1), disabled: i === slides.length - 1, children: 'Next' }),
        el('span', { style: { flex: 1 } }),
        el('div', { style: { display: 'flex', gap: '4px' }, role: 'tablist', 'aria-label': 'Slides' },
          slides.map((_, si) => el('button', {
            key: `d${si}`, type: 'button', role: 'tab', 'aria-selected': si === i,
            'aria-label': `Slide ${si + 1}`, onClick: () => setI(si),
            style: {
              width: '22px', height: '22px', border: 0, background: 'transparent', cursor: 'pointer',
              padding: 0, display: 'grid', placeItems: 'center'
            },
            children: el('span', {
              style: {
                width: '8px', height: '8px', borderRadius: '99px',
                background: si === i ? T.accent : `color-mix(in srgb, ${T.text} 22%, transparent)`
              }
            })
          }, `dot${si}`))))
  ))
}

/* ----------------------------------------------------------- infographic */

function InfographicView({ src, data }) {
  const [zoom, setZoom] = useState(1)
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', {
        style: {
          border: `1px solid ${T.line}`, borderRadius: '14px', overflow: 'auto',
          background: '#08090d', maxHeight: '62vh'
        }
      },
      src
        ? el('img', {
            src, alt: (data && data.title) || 'infographic',
            style: { display: 'block', width: `${Math.round(zoom * 100)}%`, height: 'auto' }
          })
        : el('div', { className: 'nb-hint', style: { padding: '20px' }, children: 'the image did not load' })),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        jsx(Btn, { size: 'sm', onClick: () => setZoom((z) => Math.max(0.5, z - 0.15)), children: '−' }),
        jsx(Btn, { size: 'sm', onClick: () => setZoom((z) => Math.min(2, z + 0.15)), children: '+' }),
        el('span', { className: 'nb-hint', children: `${Math.round(zoom * 100)}%` }),
        el('span', { style: { flex: 1 } }),
        data && data.takeaway ? el('span', { className: 'nb-chip', 'data-tone': 'accent', children: data.takeaway }) : null))
  )
}

/* ------------------------------------------------------------- timeline */

function TimelineView({ text, onCite }) {
  const rows = useMemo(() => {
    const out = []
    for (const line of String(text || '').split('\n')) {
      const m = /^\s*[-*]\s*(?:\*\*)?([0-9]{3,4}[^—\-:\*]*|[A-Z][a-z]{2,8}\.?\s+[0-9]{1,2},?\s+[0-9]{4})(?:\*\*)?\s*[—\-:]\s*(.+)$/.exec(line)
      if (m) out.push({ when: m[1].trim().replace(/\*\*/g, ''), what: m[2].trim() })
    }
    return out
  }, [text])
  if (rows.length < 3) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { maxWidth: '72ch' } },
      el('ol', { className: 'nb-timeline', 'aria-label': 'Timeline' },
        rows.map((r, i) => el('li', { className: 'nb-tl', key: `t${i}` },
          el('span', { className: 'nb-tl-when', children: r.when }),
          el('span', { className: 'nb-tl-what', children: jsx(Markdown, { text: r.what, onCite }) })))))
  )
}

/* -------------------------------------------------------------------- ops
 * The lab deck. Same shell as the studio, different subject: eight machines
 * measured over the audited ssh transport, with a terminal, service control, a
 * file browser and VM snapshots. Every number is what the host reported at
 * `measured_at`; a host that cannot be reached says so and offers no controls.
 */
const OPS_TABS = [
  { id: 'services', label: 'Services', icon: 'server' },
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'snapshots', label: 'Snapshots', icon: 'camera' },
  { id: 'audit', label: 'Audit', icon: 'shield' }
]

function OpsDeck({ onSay, onStats }) {
  const [state, setState] = useState({ loading: true, hosts: [], error: '', measured_at: '' })
  const [sel, setSel] = useState('local')
  const [tab, setTab] = useState('services')

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const out = await api('/ops/fleet', { timeoutMs: 120000 })
      setState({ loading: false, hosts: out.hosts || [], error: '', measured_at: out.measured_at || '' })
    } catch (e) {
      setState({ loading: false, hosts: [], error: e.message || String(e), measured_at: '' })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const hosts = state.hosts
  useEffect(() => {
    if (onStats && hosts.length) {
      onStats({
        hosts: hosts.length,
        patched: hosts.filter((h) => h.patch_state === 'patched').length,
        exposed: hosts.filter((h) => h.patch_state === 'vulnerable').length,
        down: hosts.filter((h) => h.reachable === false).length,
        measured_at: state.measured_at
      })
    }
  }, [hosts, onStats, state.measured_at])
  const host = hosts.find((h) => h.id === sel) || hosts[0] || null
  useEffect(() => { if (hosts.length && !hosts.some((h) => h.id === sel)) setSel(hosts[0].id) }, [hosts, sel])

  const patched = hosts.filter((h) => h.patch_state === 'patched').length
  const vulnerable = hosts.filter((h) => h.patch_state === 'vulnerable').length
  const down = hosts.filter((h) => h.reachable === false).length

  return el('div', {
    className: 'nb-body', role: 'main', 'aria-label': 'Lab operations',
    style: {
      gridTemplateColumns: '330px minmax(0,1fr)',
      background: 'transparent'
    }
  },
  el('aside', { className: 'nb-col', style: { borderRight: `1px solid ${T.line}`, background: `color-mix(in srgb, ${T.text} 2%, transparent)` } },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-meta', children: `Fleet · ${hosts.length}` }),
      jsx(IconBtn, { icon: 'refresh', label: 'Re-measure the fleet', onClick: load })),
    el('div', { className: 'nb-pad', style: { paddingBottom: '8px' } },
      state.error
        ? el('div', { style: { color: T.danger, fontSize: '13.5px', lineHeight: 1.5 }, children: state.error })
        : el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
            jsx(Chip, { tone: 'ok', children: `${patched} patched` }),
            vulnerable ? jsx(Chip, { tone: 'warn', children: `${vulnerable} fix available` }) : null,
            down ? jsx(Chip, { tone: 'danger', children: `${down} unreachable` }) : null,
            state.loading ? jsx(Chip, { children: 'measuring…' }) : null)),
    el('div', { className: 'nb-scroll' },
      el('div', { className: 'nb-fleet', role: 'list' },
        hosts.map((h) => el('button', {
          key: h.id,
          type: 'button', className: 'nb-frow', role: 'listitem',
          'aria-current': host && h.id === host.id ? 'true' : 'false',
          onClick: () => setSel(h.id), title: h.error || `${h.name} · ${h.dial || ''}`
        },
        jsx('span', {
          className: 'nb-sdot',
          style: {
            background: h.reachable ? (h.patch_state === 'patched' ? T.ok : T.warn) : T.danger,
            boxShadow: h.reachable ? `0 0 6px ${h.patch_state === 'patched' ? T.ok : T.warn}` : 'none',
            margin: 0
          }
        }),
        el('span', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
          el('span', { style: { display: 'flex', alignItems: 'baseline', gap: '7px', minWidth: 0 } },
            jsx('span', { className: 'nb-fname', children: h.name }),
            jsx('span', { className: 'nb-frole', children: h.role })),
          jsx('span', {
            className: 'nb-mono',
            style: { fontSize: '11.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
            children: h.reachable
              ? `${(h.kernel || '').replace(/-generic$/, '')} · ${Math.round((h.mem || {}).pct || 0)}% mem`
              : (h.error || 'no route').replace(/^ssh: /, '')
          })),
        jsx('span', {
          className: 'nb-chip',
          'data-tone': h.reachable ? (h.patch_state === 'patched' ? 'ok' : 'warn') : 'danger',
          children: h.reachable ? (h.patch_state === 'patched' ? 'patched' : 'fix avail') : 'no route'
        })
        )),
        !hosts.length && !state.loading
          ? el('div', { className: 'nb-hint', style: { padding: '12px' }, children: 'no hosts in the inventory' })
          : null
      )),
    el('div', { style: { borderTop: `1px solid ${T.lineSoft}`, padding: '10px 14px' } },
      el('div', { className: 'nb-hint', style: { lineHeight: 1.5 },
        children: state.measured_at ? `measured ${clock(state.measured_at)} · ssh, audited` : 'ssh · audited transport' }))
  ),

  el('section', { className: 'nb-col', 'aria-label': 'Selected host' },
    host
      ? jsx(HostView, { host, tab, setTab, onSay, key: host.id })
      : el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: state.loading ? 'Measuring the fleet' : 'No host selected' }),
          el('p', { children: state.loading
            ? 'Probing eight hosts over ssh — kernel, memory, disk, failed units, patch posture.'
            : 'Pick a machine on the left. Controls appear only for hosts that answer.' })))
  )
  )
}

function HostView({ host, tab, setTab, onSay }) {
  const ok = host.reachable
  return el('div', { className: 'nb-col', style: { minHeight: 0 } },
    el('div', { className: 'nb-main-head' },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('h1', { className: 'nb-h1', children: host.name }),
        el('span', { className: 'nb-chip', children: host.role }),
        ok
          ? el('span', { className: 'nb-chip', 'data-tone': host.patch_state === 'patched' ? 'ok' : 'warn',
              children: host.patch_state === 'patched' ? 'kernel patched' : `upgrade to ${host.kernel_fix || 'fix'}` })
          : el('span', { className: 'nb-chip', 'data-tone': 'danger', children: 'unreachable' }),
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-mono', style: { fontSize: '12px', color: T.text4 }, children: host.dial || '' })),
      ok
        ? el('p', { className: 'nb-sub', children: `${host.os || ''} · kernel ${host.kernel || '?'} · up ${fmtUptime(host.uptime_s)} · ${host.cores || '?'} cores · load ${(host.load || []).map((n) => Number(n).toFixed(2)).join(' / ')}` })
        : el('p', { className: 'nb-sub', style: { color: T.danger }, children: host.error || 'this host did not answer' }),
      ok
        ? el('div', { className: 'nb-strip', role: 'group', 'aria-label': 'Host measurements' },
            el('div', { className: 'nb-cell' }, el('b', { children: `${Math.round((host.mem || {}).pct || 0)}%` }), el('span', { children: 'memory' })),
            el('div', { className: 'nb-cell' }, el('b', { children: `${Math.round((host.disk || {}).pct || 0)}%` }), el('span', { children: 'disk' })),
            el('div', { className: 'nb-cell' }, el('b', { children: host.containers_up || 0 }), el('span', { children: 'containers' })),
            el('div', { className: 'nb-cell' }, el('b', { style: { color: host.failed_units ? T.danger : T.ok }, children: host.failed_units || 0 }), el('span', { children: 'failed units' })),
            el('div', { className: 'nb-cell' }, el('b', { children: `${host.measured_ms || 0}ms` }), el('span', { children: 'probe' })))
        : null,
      el('div', { className: 'nb-tabs', role: 'tablist', 'aria-label': 'Host tools' },
        OPS_TABS.map((t) => el('button', {
          key: t.id, type: 'button', role: 'tab', className: 'nb-tab',
          'aria-selected': tab === t.id, onClick: () => setTab(t.id),
          disabled: !ok,
          children: [jsx(Glyph, { name: t.icon, size: 15 }), t.label]
        }, t.id)))
    ),
    ok
      ? (tab === 'services' ? jsx(ServicesTab, { host, onSay })
        : tab === 'terminal' ? jsx(TerminalTab, { host, onSay })
          : tab === 'files' ? jsx(FilesTab, { host })
            : tab === 'snapshots' ? jsx(SnapshotsTab, { host, onSay })
              : jsx(AuditTab, { onSay }))
      : el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'No route to this machine' }),
          el('p', { children: 'The probe failed, so there is nothing honest to show and no action to offer. Fixing reachability is the only next step.' })))
  )
}

const fmtUptime = (s) => {
  const v = Number(s) || 0
  const d = Math.floor(v / 86400)
  const h = Math.floor((v % 86400) / 3600)
  if (d) return `${d}d ${h}h`
  return `${h}h ${Math.floor((v % 3600) / 60)}m`
}

/* --------------------------------------------------------------- services */

function ServicesTab({ host, onSay }) {
  const [state, setState] = useState({ loading: true, units: [], failed: 0, error: '' })
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const out = await api(`/ops/services?${qs({ host: host.id })}`, { timeoutMs: 45000 })
      setState({ loading: false, units: out.units || [], failed: out.failed || 0, error: '' })
    } catch (e) {
      setState({ loading: false, units: [], failed: 0, error: e.message || String(e) })
    }
  }, [host.id])
  useEffect(() => { load() }, [load])

  const op = async (unit, verb) => {
    setBusy(unit)
    setResult(null)
    try {
      const out = await api('/ops/service', {
        method: 'POST',
        body: { host: host.id, unit, op: verb, confirm: verb === 'stop' || verb === 'mask' ? unit : '' },
        timeoutMs: 60000
      })
      setResult({ unit, verb, ...(out.result || {}) })
      await load()
    } catch (e) {
      setResult({ unit, verb, ok: false, err: e.message || String(e) })
      if (onSay) onSay(`${verb} ${unit}: ${e.message || e}`)
    } finally { setBusy('') }
  }

  const units = state.units.filter((u) => !q.trim() || u.unit.toLowerCase().includes(q.toLowerCase()))

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-meta', children: `${state.units.length} units` }),
      state.failed ? el('span', { className: 'nb-chip', 'data-tone': 'danger', children: `${state.failed} failed` }) : null,
      el('span', { style: { flex: 1 } }),
      el('div', { style: { width: '220px' } },
        jsx(SearchField, { value: q, onChange: setQ, placeholder: 'Filter units', label: 'Filter systemd units' })),
      jsx(IconBtn, { icon: 'refresh', label: 'Reload units', onClick: load })),
    result
      ? el('div', { className: 'nb-pad', style: { borderBottom: `1px solid ${T.lineSoft}` } },
          el('div', { className: 'nb-mono', style: { fontSize: '12.5px', color: result.ok ? T.ok : T.danger, whiteSpace: 'pre-wrap' },
            children: `${result.verb} ${result.unit} → ${result.ok ? 'ok' : 'failed'} (exit ${result.code ?? '?'})\n${(result.out || result.err || '').trim().slice(0, 400)}` }))
      : null,
    el('div', { className: 'nb-scroll' },
      state.error
        ? el('div', { className: 'nb-pad', style: { color: T.danger }, children: state.error })
        : state.loading
          ? el('div', { className: 'nb-pad', children: el('span', { className: 'nb-hint', children: 'asking systemd…' }) })
          : el('div', { className: 'nb-pad', style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
              units.slice(0, 120).map((u) => el('div', {
                key: u.unit,
                style: {
                  display: 'grid', gridTemplateColumns: '10px 1fr 84px 96px', gap: '10px',
                  alignItems: 'center', padding: '7px 8px', borderRadius: '8px',
                  borderTop: `1px solid ${T.lineSoft}`
                }
              },
              el('span', { className: 'nb-sdot', style: { margin: 0, background: u.failed ? T.danger : u.active === 'active' ? T.ok : T.text4 } }),
              el('span', { style: { minWidth: 0 } },
                el('span', { style: { display: 'block', fontSize: '14px', fontWeight: 550, color: T.text }, children: u.unit }),
                el('span', { style: { display: 'block', fontSize: '12.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: u.description })),
              el('span', { className: 'nb-chip', 'data-tone': u.failed ? 'danger' : u.active === 'active' ? 'ok' : undefined,
                children: u.active }),
              jsx(Btn, {
                size: 'sm', variant: 'ghost', disabled: busy === u.unit,
                onClick: () => op(u.unit, 'restart'),
                children: busy === u.unit ? '…' : 'Restart'
              })))
            ))
  )
}

/* --------------------------------------------------------------- terminal */

function TerminalTab({ host, onSay }) {
  const [lines, setLines] = useState([])
  const [cmd, setCmd] = useState('')
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)
  useEffect(() => {
    const n = boxRef.current
    if (n) n.scrollTop = n.scrollHeight
  }, [lines.length])

  const run = async () => {
    const c = cmd.trim()
    if (!c || busy) return
    setBusy(true)
    setCmd('')
    setLines((l) => [...l, { kind: 'cmd', text: c, at: Date.now() }])
    try {
      const out = await api('/ops/exec', {
        method: 'POST', body: { host: host.id, cmd: c }, timeoutMs: 90000
      })
      const r = out.result || {}
      setLines((l) => [...l, {
        kind: 'out', ok: !!r.ok, code: r.code, ms: r.ms,
        text: (r.out || '') + (r.err ? `\n${r.err}` : ''), at: Date.now()
      }])
    } catch (e) {
      setLines((l) => [...l, { kind: 'out', ok: false, text: e.message || String(e), at: Date.now() }])
      if (onSay) onSay(e.message || 'exec failed')
    } finally { setBusy(false) }
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-body', style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
      el('div', { className: 'nb-term', ref: boxRef, role: 'log', 'aria-live': 'polite', 'aria-label': 'Command output' },
        lines.length === 0
          ? el('span', { style: { color: '#6f7488' }, children: `# ${host.name} — commands run over ssh, every call lands in the audit log\n# try: uptime; df -h / ; docker ps --format '{{.Names}}\\t{{.Status}}'` })
          : lines.map((l, i) => l.kind === 'cmd'
            ? el('div', { key: `c${i}`, style: { marginTop: i ? '10px' : 0, color: '#8fd4a8' }, children: `❯ ${l.text}` })
            : el('div', { key: `o${i}`, style: { color: l.ok ? '#d6d8e6' : '#ff8b8b', whiteSpace: 'pre-wrap' } },
                l.text || '(no output)',
                el('span', { style: { color: '#6f7488' }, children: `\n[exit ${l.code === undefined ? '?' : l.code}${l.ms ? ` · ${l.ms}ms` : ''}]` }))))
      ,
      el('div', { className: 'nb-term-in' },
        el('span', { className: 'nb-mono', style: { color: T.accent, fontSize: '14px' }, children: '❯' }),
        el('input', {
          value: cmd, onChange: (e) => setCmd(e.target.value), spellCheck: false,
          onKeyDown: (e) => { if (e.key === 'Enter') run() },
          placeholder: `run a command on ${host.name}`, 'aria-label': 'Command to run'
        }),
        jsx(Btn, { variant: 'primary', icon: 'bolt', onClick: run, disabled: busy || !cmd.trim(),
          children: busy ? 'Running…' : 'Run' })),
      el('div', { className: 'nb-hint', style: { lineHeight: 1.5 },
        children: 'Every command runs over ssh on that host. The output and exit code above are the real ones, and each call is appended to the audit log.' }))
  )
}

/* ------------------------------------------------------------------ files */

function FilesTab({ host }) {
  const [path, setPath] = useState('/home')
  const [state, setState] = useState({ loading: true, entries: [], parent: '/', error: '' })
  const [open, setOpen] = useState(null)

  const load = useCallback(async (p) => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const out = await api(`/ops/files?${qs({ host: host.id, path: p })}`, { timeoutMs: 45000 })
      setState({ loading: false, entries: out.entries || [], parent: out.parent || '/', error: '' })
      setPath(out.path || p)
    } catch (e) {
      setState({ loading: false, entries: [], parent: '/', error: e.message || String(e) })
    }
  }, [host.id])
  useEffect(() => { load(path) }, [load])

  const readFile = async (name) => {
    const full = path.endsWith('/') ? path + name : `${path}/${name}`
    try {
      const out = await api(`/ops/file?${qs({ host: host.id, path: full, bytes: 60000 })}`, { timeoutMs: 45000 })
      setOpen({ name, text: out.text || '', size: out.size, truncated: out.truncated })
    } catch (e) { setOpen({ name, text: e.message || String(e), error: true }) }
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      jsx(IconBtn, { icon: 'arrowLeft', label: 'Parent directory', onClick: () => load(state.parent) }),
      el('div', { className: 'nb-field', style: { flex: 1, height: '32px' } },
        jsx(Glyph, { name: 'folder', size: 13 }),
        el('input', {
          value: path, onChange: (e) => setPath(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter') load(path) },
          'aria-label': 'Directory path', spellCheck: false
        })),
      jsx(IconBtn, { icon: 'refresh', label: 'Reload directory', onClick: () => load(path) })),
    el('div', { className: 'nb-scroll' },
      state.error
        ? el('div', { className: 'nb-pad', style: { color: T.danger }, children: state.error })
        : el('div', { className: 'nb-pad' },
            el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } },
              state.entries.map((e) => el('button', {
                type: 'button',
                onClick: () => (e.dir ? load(path.endsWith('/') ? path + e.name : `${path}/${e.name}`) : readFile(e.name)),
                style: {
                  display: 'grid', gridTemplateColumns: '18px 1fr 76px 96px', gap: '10px',
                  alignItems: 'center', minHeight: '30px', padding: '4px 8px', borderRadius: '7px',
                  border: 0, background: 'transparent', color: T.text, cursor: 'pointer', textAlign: 'left',
                  fontSize: '14px'
                },
                children: [
                  el('span', { style: { color: e.dir ? T.accent : T.text4, display: 'grid', placeItems: 'center' } },
                    jsx(Glyph, { name: e.dir ? 'folder' : 'file', size: 13 })),
                  el('span', { style: { color: e.dir ? T.text : T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: e.name }),
                  el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4, textAlign: 'right' },
                    children: e.dir ? 'dir' : nfmt(e.size) }),
                  el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4, textAlign: 'right' },
                    children: e.mtime ? ago(new Date(e.mtime * 1000).toISOString()) : '' })
                ]
              }, e.name))))
    ),
    open
      ? el('div', { style: { borderTop: `1px solid ${T.line}`, padding: '12px 16px', maxHeight: '38%', overflow: 'auto' } },
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
            el('span', { className: 'nb-chip', 'data-tone': open.error ? 'danger' : undefined, children: open.name }),
            open.size ? el('span', { className: 'nb-hint', children: `${nfmt(open.size)} bytes${open.truncated ? ' · truncated' : ''}` }) : null,
            el('span', { style: { flex: 1 } }),
            jsx(IconBtn, { icon: 'close', label: 'Close file', onClick: () => setOpen(null) })),
          el('pre', { className: 'nb-mono', style: { whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.55, color: T.text2, margin: 0 },
            children: open.text }))
      : null
  )
}

/* -------------------------------------------------------------- snapshots */

function SnapshotsTab({ host, onSay }) {
  const [vmid, setVmid] = useState('100')
  const [state, setState] = useState({ loading: false, list: [], raw: '', error: '' })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const out = await api(`/ops/snapshots?${qs({ host: host.id, vmid })}`, { timeoutMs: 60000 })
      setState({ loading: false, list: out.snapshots || [], raw: out.raw || '', error: out.ok ? '' : (out.raw || 'qm refused') })
    } catch (e) {
      setState({ loading: false, list: [], raw: '', error: e.message || String(e) })
    }
  }, [host.id, vmid])

  const create = async () => {
    setBusy(true)
    try {
      const out = await api('/ops/snapshot', { method: 'POST', body: { host: host.id, vmid, name }, timeoutMs: 200000 })
      if (onSay) onSay(`snapshot ${out.label} ${out.ok ? 'created' : 'failed'}`)
      await load()
    } catch (e) {
      if (onSay) onSay(e.message || 'snapshot failed')
      setState((s) => ({ ...s, error: e.message || String(e) }))
    } finally { setBusy(false) }
  }

  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-meta', children: 'VMID' }),
      el('div', { className: 'nb-field', style: { width: '110px', height: '32px' } },
        el('input', { value: vmid, onChange: (e) => setVmid(e.target.value.replace(/\D/g, '')), 'aria-label': 'VM id' })),
      jsx(Btn, { size: 'sm', icon: 'refresh', onClick: load, children: 'List' }),
      el('div', { style: { flex: 1 } }),
      el('div', { className: 'nb-field', style: { width: '200px', height: '32px' } },
        el('input', { value: name, onChange: (e) => setName(e.target.value), placeholder: 'snapshot name', 'aria-label': 'Snapshot name' })),
      jsx(Btn, { size: 'sm', variant: 'primary', icon: 'camera', onClick: create, disabled: busy,
        children: busy ? 'Snapshotting…' : 'Create' })),
    el('div', { className: 'nb-scroll' },
      state.error
        ? el('div', { className: 'nb-pad', style: { color: T.danger, fontSize: '13.5px' }, children: state.error })
        : el('div', { className: 'nb-pad' },
            state.loading
              ? el('span', { className: 'nb-hint', children: 'asking qm…' })
              : state.list.length
                ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                    state.list.map((s) => el('div', {
                      key: s,
                      style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: `1px solid ${T.lineSoft}`, borderRadius: '9px', background: T.card }
                    },
                    jsx(Glyph, { name: 'camera', size: 14 }),
                    el('span', { style: { fontSize: '14.5px', fontWeight: 560 }, children: s }),
                    el('span', { style: { flex: 1 } }),
                    el('span', { className: 'nb-chip', children: `vm ${vmid}` }))))
                : el('div', { className: 'nb-hint', children: 'no snapshots for this VM — name one above and create it' })),
            state.raw ? el('pre', { className: 'nb-mono', style: { marginTop: '12px', fontSize: '12px', color: T.text4, whiteSpace: 'pre-wrap' }, children: state.raw }) : null)
  )
}

/* ------------------------------------------------------------------ audit */

function AuditTab({ onSay }) {
  const [state, setState] = useState({ loading: true, entries: [], error: '' })
  const load = useCallback(async () => {
    try {
      const out = await api('/ops/audit?limit=40', { timeoutMs: 30000 })
      setState({ loading: false, entries: out.entries || [], error: '' })
    } catch (e) { setState({ loading: false, entries: [], error: e.message || String(e) }) }
  }, [])
  useEffect(() => { load() }, [load])
  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-meta', children: 'Action log' }),
      el('span', { className: 'nb-chip', children: `${state.entries.length} entries` }),
      el('span', { style: { flex: 1 } }),
      jsx(IconBtn, { icon: 'refresh', label: 'Reload the audit log', onClick: load })),
    el('div', { className: 'nb-scroll' },
      state.error ? el('div', { className: 'nb-pad', style: { color: T.danger }, children: state.error })
        : el('div', { className: 'nb-pad', style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            state.entries.map((e, i) => el('div', {
              key: `e${i}`,
              style: { border: `1px solid ${T.lineSoft}`, borderRadius: '9px', padding: '9px 11px', background: T.card }
            },
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
              el('span', { className: 'nb-chip', 'data-tone': e.ok ? 'ok' : 'danger', children: e.ok ? 'ok' : 'failed' }),
              el('span', { className: 'nb-chip', children: e.action }),
              el('span', { className: 'nb-chip', children: e.host }),
              el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4 }, children: e.at }),
              el('span', { style: { flex: 1 } }),
              el('span', { className: 'nb-mono', style: { fontSize: '11.5px', color: T.text4 }, children: `exit ${e.code ?? '?'} · ${e.ms || 0}ms` })),
            el('div', { className: 'nb-mono', style: { marginTop: '6px', fontSize: '12.5px', color: T.text2, whiteSpace: 'pre-wrap', maxHeight: '90px', overflow: 'hidden' },
              children: `$ ${e.cmd || e.target}\n${(e.out || e.err || '').slice(0, 500)}` })))))
  )
}

/* ------------------------------------------------------------------ surface
 * One route, one nav row, one status chip, three palette commands, a settings
 * page built from the app's own primitives, and a transcript directive so the
 * agent can hand the studio a notebook (`::notebook{name="…"}`).
 *
 * The registration is deliberately defensive: the SDK has shipped two
 * generations of this call. `ctx.register({id, area, data, render})` is the
 * current one; a host that only has `contribution(area, payload)` still gets
 * every area, and each area is isolated so one renamed hook cannot take the
 * page down with it.
 */
function contribute(ctx, id, area, payload) {
  try {
    if (typeof ctx.register === 'function') {
      const out = ctx.register({ id, area, data: payload, render: payload.render })
      return out
    }
    if (typeof ctx.contribution === 'function') return ctx.contribution(area, payload)
  } catch (e) {
    try { console.warn(`[${ID}] area ${area} failed:`, e && e.message ? e.message : e) } catch { /* noop */ }
  }
  return undefined
}

function StatusChip() {
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    let live = true
    api('/state').then((d) => {
      if (!live) return
      const nb = d.notebook
      setCounts(nb ? { sources: nb.stats.sources, artifacts: nb.stats.artifacts } : null)
    }).catch(() => { if (live) setCounts(null) })
    return () => { live = false }
  }, [])
  return el('button', {
    type: 'button',
    title: counts ? `${counts.sources} sources · ${counts.artifacts} artifacts` : 'Hermes Notebook',
    'aria-label': 'Open Hermes Notebook',
    onClick: () => host.navigate(ROUTE),
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '5px', minHeight: '24px',
      padding: '0 6px', border: 0, background: 'transparent', cursor: 'pointer',
      color: 'var(--ui-text-tertiary)', fontSize: '11.5px',
      fontFamily: 'var(--ui-font-mono, ui-monospace, monospace)'
    },
    children: [
      el('span', {
        style: {
          width: '6px', height: '6px', borderRadius: '99px',
          background: counts ? 'var(--ui-success, #3fb950)' : 'var(--ui-text-quaternary)'
        }
      }),
      counts ? `nb ${counts.sources}/${counts.artifacts}` : 'notebook'
    ]
  })
}

/** Settings → Plugins: the app's ListRow / ToggleRow / SegmentedControl, not
 *  hand-rolled chrome that reads foreign next to the rest of Settings. */
function SettingsPage() {
  const [surface, setSurface] = useState(() => persist.get('mode', 'studio'))
  const [chip, setChip] = useState(() => persist.get('statusChip', true))
  const [state, setState] = useState(null)

  useEffect(() => {
    api('/health').then(setState).catch(() => setState(null))
  }, [])

  const rows = []
  if (ListRow) {
    rows.push(jsx(ListRow, {
      key: 'surface',
      title: 'Default surface',
      description: 'Which half of the plugin opens first: the research studio, or the lab deck.',
      action: SegmentedControl
        ? jsx(SegmentedControl, {
            value: surface,
            onChange: (v) => { setSurface(v); persist.set('mode', v) },
            items: [{ value: 'studio', label: 'Studio' }, { value: 'ops', label: 'Lab Ops' }]
          })
        : null
    }))
  }
  if (ToggleRow) {
    rows.push(jsx(ToggleRow, {
      key: 'chip',
      label: 'Status-bar chip',
      description: 'Show the active notebook’s source and artifact counts in the status bar.',
      checked: chip,
      onChange: (on) => { setChip(on); persist.set('statusChip', on) }
    }))
  }
  if (ListRow) {
    rows.push(jsx(ListRow, {
      key: 'data',
      title: 'Notebook store',
      description: state && state.data_root
        ? el('span', { className: 'nb-mono', style: { fontSize: '12px' }, children: state.data_root })
        : 'backend not reachable from this window',
      hint: state && state.model_ready
        ? 'model bound — answers and artifacts run through your provider'
        : 'the agent half is not registered in this process (enable the plugin, restart the gateway)'
    }))
    rows.push(jsx(ListRow, {
      key: 'kinds',
      title: 'Studio outputs',
      description: (state && state.kinds ? state.kinds : KINDS_FALLBACK)
        .map((k) => String(k).replace(/_/g, ' ')).join(' · ')
    }))
  }
  return el('div', { style: { display: 'flex', flexDirection: 'column' } }, rows)
}

const KINDS_FALLBACK = ['video_overview', 'audio_overview', 'summary', 'briefing_doc',
  'study_guide', 'faq', 'timeline', 'mind_map', 'flashcards', 'quiz', 'slides', 'infographic']

/** The agent can write `::notebook{name="Fusion 2026"}` in a reply. */
function NotebookDirective({ attrs }) {
  const name = String((attrs && (attrs.name || attrs.notebook)) || '').slice(0, 120)
  if (!name) return null
  return el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0',
      padding: '10px 12px', borderRadius: '10px',
      border: `1px solid ${T.line}`, background: T.card
    }
  },
  el('span', { className: 'nb-mark', style: { width: '24px', height: '24px' } }, jsx(Glyph, { name: 'notebook', size: 13 })),
  el('div', { style: { minWidth: 0, flex: 1 } },
    el('div', { style: { fontSize: '14px', fontWeight: 600 }, children: name }),
    el('div', { style: { fontSize: '12.5px', color: T.text3 }, children: 'notebook · open the studio' })),
  el('button', {
    type: 'button', className: 'nb-btn', 'data-size': 'sm',
    onClick: () => host.navigate(ROUTE),
    children: 'Open'
  }))
}

const plugin = {
  id: ID,
  name: 'Notebook',
  description: 'Ground sources into cited answers and study artifacts, and drive the lab fleet from the same window.',
  // On by default: the page is the product. A user's explicit toggle still wins.
  defaultEnabled: true,
  register(ctx) {
    setCtx(ctx)

    const shells = [
      ['route', ROUTES_AREA, { path: ROUTE }, () => jsx(App, {})],
      ['nav', SIDEBAR_NAV_AREA, { path: ROUTE, label: 'Notebook', codicon: 'notebook' }, undefined],
      ['status', STATUSBAR_AREAS ? STATUSBAR_AREAS.right : 'statusBar.right',
        { order: 118 }, () => jsx(StatusChip, {})],
      ['palette-studio', PALETTE_AREA, {
        id: 'notebook.open', label: 'Notebook: open the studio', keywords: ['notebook', 'studio', 'sources', 'research'],
        run: () => host.navigate(ROUTE)
      }, undefined],
      ['palette-ops', PALETTE_AREA, {
        id: 'notebook.ops', label: 'Notebook: open the lab deck', keywords: ['lab', 'fleet', 'ops', 'homelab', 'servers'],
        run: () => host.navigate(`${ROUTE}?surface=ops`)
      }, undefined],
      ['palette-ask', PALETTE_AREA, {
        id: 'notebook.ask', label: 'Notebook: ask the active notebook', keywords: ['ask', 'notebook', 'citation', 'grounded'],
        run: () => {
          host.navigate(ROUTE)
          if (host.composer && host.composer.setDraft) {
            host.composer.setDraft(null, 'Ask my active Hermes notebook a question grounded in its sources')
          }
        }
      }, undefined]
    ]

    for (const [id, area, data, render] of shells) {
      contribute(ctx, id, area, render ? { ...data, render } : data)
    }

    // transcript directive: the agent hands the studio a notebook
    contribute(ctx, 'directive', 'transcript.directives', {
      name: 'notebook',
      render: ({ attrs }) => jsx(NotebookDirective, { attrs })
    })

    // settings page (optional API — never let it take the page down)
    try {
      if (typeof ctx.registerSettingsPage === 'function') {
        ctx.registerSettingsPage({
          id: 'notebook.settings',
          title: 'Notebook',
          description: 'Sources, studio outputs and the lab deck.',
          render: () => jsx(SettingsPage, {})
        })
      }
    } catch (e) {
      try { console.warn('[hermes-notebook] settings page not registered:', e) } catch { /* noop */ }
    }
  }
}

export default plugin

// Named exports are for the preview harness and the gates; the app only reads
// the default export.
export { App, StudioPanel, Viewer, OpsDeck, Rail, Markdown, KIND_ICON, CSS }
