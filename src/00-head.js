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
 *   studio   the twelve outputs as preview cards — each carries its own colour,
 *            a real thumbnail when the artifact exists (infographic image,
 *            document lines, audio waveform), and the state it is actually in
 *
 * The second surface is the lab: the same shell, the same status bar, and a
 * fleet deck that measures eight hosts over the audited ssh transport — a
 * terminal, service control, a file browser and VM snapshots, all of which
 * report the real exit code instead of a green tick.
 *
 * The system is deliberately NotebookLM-soft: rounded cards, pill controls,
 * quiet labels and per-output colour, all resolved through the app's theme
 * variables so the page follows dark/light and the user's accent. Media
 * stages and the terminal stay dark in both themes, like a player.
 */
import * as SDK from '@hermes/plugin-sdk'
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
   SYSTEM: "Studio" — NotebookLM-soft.
   Cards, pills and previews instead of rules and plates: every surface is a
   rounded, softly-elevated card; controls are pills; the twelve studio outputs
   each carry their own colour (--kc) and show a real thumbnail once generated.
   Values resolve through the app's theme variables so the page follows the
   user's light/dark theme and accent; media stages and the terminal pin a dark
   surface in both themes, the way a player does.
   ========================================================================== */

.nb-root{
  --nb-rail: 300px; --nb-studio: 396px;
  --nb-hair: color-mix(in srgb, ${T.text} 10%, transparent);
  --nb-hair-soft: color-mix(in srgb, ${T.text} 6%, transparent);
  --nb-wash: color-mix(in srgb, ${T.text} 4%, transparent);
  --nb-wash-2: color-mix(in srgb, ${T.text} 7.5%, transparent);
  --nb-card: ${T.card};
  --nb-shadow: 0 1px 2px rgba(8,10,18,.05), 0 14px 34px -20px rgba(8,10,18,.30);
  --nb-shadow-lift: 0 2px 6px rgba(8,10,18,.07), 0 20px 44px -18px rgba(8,10,18,.38);
  /* motion — Astryx cadence: fast for hovers, medium for entrances, standard
     curve decelerates, exit accelerates */
  --nb-ease: cubic-bezier(.24,1,.4,1);
  --nb-ease-exit: cubic-bezier(.3,0,.6,.6);
  --nb-dur-fast: .175s; --nb-dur-med: .41s; --nb-dur-slow: .975s;
  --nb-media: linear-gradient(155deg,#20243a 0%,#12151f 100%);
  display:flex; flex-direction:column; height:100%; min-height:0;
  color:${T.text}; font-size:16px; line-height:1.5;
  font-variant-numeric: tabular-nums;
  position:relative;
}
/* ambient generative field — each notebook's sigil hue bleeds into the room */
.nb-aurora{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.nb-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:.15;
  background:radial-gradient(circle,hsl(var(--nb-hue, 265) 80% 60% / .9),transparent 70%);
  width:52vmax;height:52vmax;top:-16%;left:-10%;
  animation:nb-drift 26s ease-in-out infinite alternate}
.nb-blob:nth-child(2){background:radial-gradient(circle,hsl(calc(var(--nb-hue, 265) + 70) 80% 60% / .8),transparent 70%);
  width:44vmax;height:44vmax;top:-10%;right:-8%;animation-duration:32s;animation-delay:-9s}
.nb-blob:nth-child(3){background:radial-gradient(circle,hsl(calc(var(--nb-hue, 265) + 165) 75% 58% / .7),transparent 70%);
  width:40vmax;height:40vmax;bottom:-16%;left:-6%;animation-duration:38s;animation-delay:-17s}
@keyframes nb-drift{from{transform:translate3d(-3%,-2%,0) scale(1)}to{transform:translate3d(4%,3%,0) scale(1.08)}}
.nb-bar,.nb-body,.nb-home,.nb-ops{position:relative;z-index:1}
.nb-root *{box-sizing:border-box}
.nb-root :focus-visible{outline:2px solid ${T.accent}; outline-offset:3px}
.nb-mono{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-ligatures:none}
.nb-num{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums}

/* quiet section label — small and calm, never telemetry */
.nb-meta{font-size:12px;letter-spacing:0;text-transform:none;color:${T.text3};font-weight:600}
.nb-hint{font-size:11.5px;color:${T.text3};letter-spacing:.01em;line-height:1.5}

/* ------------------------------------------------------------------ app bar */
.nb-bar{display:flex;align-items:center;gap:14px;height:56px;flex:0 0 56px;
  padding:0 18px;border-bottom:1px solid var(--nb-hair-soft)}
.nb-brand{display:flex;align-items:center;gap:11px;min-width:0}
.nb-mark{width:27px;height:27px;display:grid;place-items:center;flex:0 0 auto;border-radius:8px;
  background:color-mix(in srgb,${T.accent} 15%, transparent);color:${T.accent}}
.nb-brandname{font-size:14.5px;font-weight:700;letter-spacing:-.01em;color:${T.text}}
.nb-crumb{font-size:12.5px;color:${T.text3};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42ch}
.nb-crumb b{color:${T.text2};font-weight:600}
.nb-crumbedit{background:transparent;border:0;padding:0 8px;margin:0 -8px;font:inherit;
  color:${T.text2};font-weight:600;cursor:pointer;border-radius:8px;
  display:inline-flex;align-items:center;min-height:32px;max-width:42ch;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nb-crumbedit:hover{color:${T.text};background:var(--nb-wash-2)}
.nb-spacer{flex:1 1 auto}
.nb-actions{display:flex;align-items:center;gap:8px}

/* ---------------------------------------------------------------- controls */
.nb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:36px;padding:0 18px;border-radius:99px;cursor:pointer;
  font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;font-family:inherit;
  border:1px solid var(--nb-hair);background:var(--nb-wash);color:${T.text};
  transition:background var(--nb-dur-fast) var(--nb-ease),border-color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-btn:hover{background:var(--nb-wash-2);border-color:color-mix(in srgb,${T.text} 22%, transparent)}
.nb-btn:active{transform:translateY(1px)}
.nb-btn[disabled]{opacity:.45;cursor:not-allowed}
.nb-btn[data-variant=primary]{background:${T.accent};border-color:transparent;color:#0d0e15;font-weight:650;
  box-shadow:0 6px 18px -8px color-mix(in srgb,${T.accent} 80%, transparent)}
.nb-btn[data-variant=primary]:hover{background:color-mix(in srgb,${T.accent} 88%, ${T.text})}
.nb-btn[data-variant=primary][disabled]{background:var(--nb-wash);border-color:var(--nb-hair);color:${T.text3};box-shadow:none}
.nb-btn[data-variant=ghost]{background:transparent;border-color:transparent;color:${T.text2}}
.nb-btn[data-variant=ghost]:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-btn[data-size=sm]{min-height:32px;padding:0 12px;font-size:12.5px;border-radius:8px}
.nb-icon{width:36px;height:36px;min-height:36px;padding:0;border-radius:99px;display:grid;place-items:center;
  cursor:pointer;border:1px solid transparent;background:transparent;color:${T.text3};
  transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease),border-color var(--nb-dur-fast) var(--nb-ease)}
.nb-icon:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-icon[data-active=true]{background:color-mix(in srgb,${T.accent} 14%, transparent);color:${T.accent}}

/* segmented control — a pill track with a lifted thumb */
.nb-seg{display:inline-flex;gap:2px;padding:3px;border-radius:12px;
  border:1px solid var(--nb-hair);background:var(--nb-wash)}
.nb-seg[data-fill="true"]{display:flex;width:100%}
.nb-seg[data-fill="true"] > button{flex:1;justify-content:center}
.nb-seg > button{min-height:32px;padding:0 14px;border:0;border-radius:8px;background:transparent;
  color:${T.text3};cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;letter-spacing:0;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-seg > button:hover{color:${T.text};background:color-mix(in srgb,${T.text} 6%, transparent)}
.nb-seg > button[aria-selected=true]{background:${T.card};color:${T.text};box-shadow:var(--nb-shadow)}

.nb-field{display:flex;align-items:center;gap:9px;height:38px;padding:0 12px;border-radius:12px;
  border:1px solid var(--nb-hair);background:var(--nb-wash);color:${T.text3}}
.nb-field:focus-within{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  box-shadow:0 0 0 3px color-mix(in srgb,${T.accent} 16%, transparent)}
.nb-field input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;
  color:${T.text};font-size:14px;font-family:inherit}
.nb-field input::placeholder{color:${T.text4}}

/* ------------------------------------------------------------------- body */
/* NotebookLM's spatial model: the canvas stays dark, the three surfaces are
   floating rounded panels with real gaps between them. */
.nb-body{flex:1 1 auto;display:flex;gap:12px;min-height:0;overflow:hidden;
  padding:12px}
.nb-col{min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}
.nb-body > .nb-col{background:var(--nb-card);border:1px solid var(--nb-hair-soft);
  border-radius:24px;overflow:hidden}
.nb-rail{flex:0 0 var(--nb-rail)}
.nb-rail[data-drop="true"]{outline:2px dashed ${T.accent};outline-offset:-6px;border-radius:24px}
.nb-main-col{flex:1 1 auto}
.nb-studio{flex:0 0 var(--nb-studio)}
.nb-fade{position:absolute;left:0;right:0;bottom:0;height:44px;pointer-events:none;
  background:linear-gradient(to top, color-mix(in srgb, ${T.text} 6%, ${T.card}), transparent)}
.nb-pane-head{display:flex;align-items:center;gap:8px;height:52px;flex:0 0 52px;padding:0 18px}
.nb-pane-title{font-size:15px;font-weight:650;letter-spacing:-.01em;color:${T.text}}
.nb-pane-head .nb-meta{flex:1}
.nb-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,${T.text} 22%,transparent) transparent}
.nb-root ::selection{background:color-mix(in srgb,${T.accent} 32%,transparent)}
.nb-pad{padding:12px 14px}

/* ------------------------------------------------------------------- rail */
.nb-nbrow{display:flex;align-items:center;gap:12px;width:100%;
  text-align:left;cursor:pointer;border:0;border-radius:12px;background:transparent;
  padding:9px 10px;color:${T.text};transition:background var(--nb-dur-fast) var(--nb-ease)}
.nb-nbrow:hover{background:var(--nb-wash-2)}
.nb-nbrow[aria-current=true]{background:color-mix(in srgb,${T.accent} 11%, transparent)}
.nb-nbtitle{font-size:13.5px;font-weight:600;line-height:1.32;color:${T.text2};letter-spacing:-.005em;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-nbrow[aria-current=true] .nb-nbtitle{color:${T.text}}
.nb-nbsub{font-size:11.5px;color:${T.text3};margin-top:2px;display:block}
.nb-avatar{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;border-radius:12px;
  background:var(--nb-wash-2);color:${T.text2};font-size:13px;font-weight:700}
.nb-nbrow[aria-current=true] .nb-avatar{background:color-mix(in srgb,${T.accent} 20%, transparent);color:${T.accent}}

.nb-src{display:flex;align-items:center;gap:4px;width:100%;border-radius:12px;
  padding:5px 8px 5px 5px;position:relative;transition:background var(--nb-dur-fast) var(--nb-ease)}
.nb-src:hover{background:var(--nb-wash-2)}
.nb-src[data-on=true]{background:color-mix(in srgb,${T.accent} 10%, transparent)}
.nb-src[data-off=true]{opacity:.55}
.nb-src-open{flex:1;min-width:0;display:grid;grid-template-columns:36px minmax(0,1fr);gap:11px;
  align-items:center;text-align:left;background:transparent;border:0;padding:4px;border-radius:12px;
  color:${T.text};cursor:pointer;font-family:inherit}
.nb-src-ico{position:relative;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;
  background:var(--nb-wash-2);color:${T.text2};flex:0 0 auto}
.nb-src[data-on=true] .nb-src-ico{background:color-mix(in srgb,${T.accent} 18%, transparent);color:${T.accent}}
/* the citation number rides the icon's corner, like a source badge */
.nb-cite{position:absolute;right:-6px;bottom:-6px;min-width:18px;height:18px;padding:0 5px;
  border-radius:99px;display:grid;place-items:center;background:${T.accent};color:#0d0e15;
  font-size:10px;font-weight:700;
  box-shadow:0 1px 4px rgba(8,10,18,.4)}
.nb-src-title{font-size:13px;font-weight:600;line-height:1.35;color:${T.text};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-src-meta{display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap}
/* NotebookLM's per-source checkbox: a rounded box at the row's right edge */
.nb-srccheck{width:32px;height:32px;flex:0 0 auto;border-radius:8px;cursor:pointer;
  border:1.5px solid var(--nb-hair);background:transparent;color:#0d0e15;
  display:grid;place-items:center;padding:0;transition:all var(--nb-dur-fast) var(--nb-ease)}
.nb-srccheck:hover{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}
.nb-srccheck[aria-checked=true]{background:${T.accent};border-color:${T.accent}}
.nb-selall{display:flex;align-items:center;gap:9px;padding:2px 6px}
.nb-selall .nb-srccheck{width:32px;height:32px;border-radius:8px}
.nb-src-del{position:absolute;right:44px;top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity var(--nb-dur-fast) var(--nb-ease)}
.nb-src:hover .nb-src-del,.nb-src-del:focus-visible{opacity:1}
.nb-srcgroup{display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  padding:9px 10px;border:0;border-radius:12px;background:transparent;color:${T.text3};
  font-size:12px;font-weight:650;letter-spacing:.01em;cursor:pointer;font-family:inherit}
.nb-srcgroup:hover{background:var(--nb-wash-2);color:${T.text2}}
.nb-srcgroup svg{transition:transform var(--nb-dur-fast) var(--nb-ease)}
.nb-srcgroup[data-closed=true] svg{transform:rotate(-90deg)}
.nb-srcgroup em{margin-left:auto;font-style:normal;font-weight:500;color:${T.text4};font-size:11px}
.nb-srcgroup-list{display:flex;flex-direction:column;gap:2px;padding-left:14px}

/* the web-research box inside the sources panel */
.nb-finder{margin:0 14px 10px;border-radius:16px;border:1px solid var(--nb-hair-soft);
  background:var(--nb-wash);padding:10px}
.nb-finder-row{display:flex;align-items:center;gap:8px}
.nb-finder-row input{flex:1;min-width:0;height:34px;border:0;outline:0;background:transparent;
  color:${T.text};font-size:13px;font-family:inherit}
.nb-finder-row input::placeholder{color:${T.text4}}
.nb-finder-go{width:32px;height:32px;flex:0 0 auto;border-radius:99px;border:0;cursor:pointer;
  background:${T.accent};color:#0d0e15;display:grid;place-items:center;padding:0}
.nb-addsrc{width:100%;justify-content:flex-start}
.nb-paneltog{flex:0 0 44px;display:flex;flex-direction:column;align-items:center;
  gap:10px;padding-top:16px}
.nb-finder-go[disabled]{opacity:.45;cursor:not-allowed}
.nb-fcand[disabled]{cursor:default}
.nb-fcand[disabled]:not([data-added=true]){opacity:.55}
.nb-fcand{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
  padding:9px 10px;border-radius:12px;border:0;background:transparent;color:${T.text};
  cursor:pointer;font-family:inherit}
.nb-fcand:hover{background:var(--nb-wash-2)}
.nb-fcand-main{flex:1;min-width:0}
.nb-fcand-title{display:block;font-size:12.5px;font-weight:600;line-height:1.35;color:${T.text};
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-fcand-sub{display:block;font-size:11px;color:${T.text3};margin-top:2px;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-fcand-add{width:28px;height:28px;flex:0 0 auto;border-radius:99px;cursor:pointer;
  border:1.5px solid var(--nb-hair);background:transparent;color:${T.text2};
  display:grid;place-items:center;padding:0}
.nb-fcand-add:hover{border-color:${T.accent};color:${T.accent}}
.nb-fcand-add[data-added=true]{background:color-mix(in srgb,${T.ok} 15%, transparent);
  border-color:color-mix(in srgb,${T.ok} 50%, transparent);color:${T.ok};cursor:default}

/* chips are soft pills; clickable ones are full 32px targets */
.nb-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:99px;
  font-size:11px;font-weight:600;letter-spacing:.01em;color:${T.text3};
  background:var(--nb-wash-2);border:1px solid transparent;white-space:nowrap;font-family:inherit}
.nb-chip[data-tone=accent]{color:${T.accent};background:color-mix(in srgb,${T.accent} 13%, transparent)}
.nb-chip[data-tone=ok]{color:${T.ok};background:color-mix(in srgb,${T.ok} 13%, transparent)}
.nb-chip[data-tone=warn]{color:${T.warn};background:color-mix(in srgb,${T.warn} 14%, transparent)}
.nb-chip[data-tone=danger]{color:${T.danger};background:color-mix(in srgb,${T.danger} 13%, transparent)}
.nb-citechip{height:32px;min-height:32px;padding:0 7px 0 9px;border-radius:99px;gap:7px;
  background:var(--nb-card);border-color:var(--nb-hair);color:${T.text2};font-size:12px;font-weight:500}
.nb-citechip:hover{border-color:color-mix(in srgb,${T.accent} 50%, transparent)}
.nb-citechip b{font-family:var(--ui-font-mono,ui-monospace,monospace);color:${T.accent};font-weight:700;
  font-size:10.5px;background:color-mix(in srgb,${T.accent} 14%, transparent);border-radius:99px;
  padding:3px 7px;flex:0 0 auto}
.nb-citechip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:300px}
.nb-chip[data-click=true]{cursor:pointer;min-height:32px;height:32px;padding:0 13px;font-size:12px;
  background:var(--nb-card);border-color:var(--nb-hair)}
.nb-chip[data-click=true]:hover{background:var(--nb-wash-2);color:${T.text};
  border-color:color-mix(in srgb,${T.text} 20%, transparent)}
.nb-chip[data-click=true][aria-pressed=true]{background:color-mix(in srgb,${T.accent} 14%, transparent);
  color:${T.accent};border-color:color-mix(in srgb,${T.accent} 45%, transparent)}

/* discover candidates — the "find for me" picker inside the add-source sheet */
.nb-cand-list{display:flex;flex-direction:column;gap:8px;max-height:308px;overflow:auto;padding:2px}
.nb-cand{display:flex;gap:11px;align-items:flex-start;width:100%;text-align:left;
  padding:11px 12px;border-radius:12px;border:1px solid var(--nb-hair-soft);
  background:var(--nb-card);cursor:pointer;font-family:inherit;color:inherit}
.nb-cand:hover{border-color:color-mix(in srgb,${T.text} 20%, transparent);background:var(--nb-wash-2)}
.nb-cand[data-on=true]{border-color:color-mix(in srgb,${T.accent} 45%, transparent);
  background:color-mix(in srgb,${T.accent} 8%, transparent)}
.nb-cand-check{width:20px;height:20px;flex:0 0 auto;margin-top:2px;border-radius:7px;
  border:1.5px solid var(--nb-hair);display:grid;place-items:center;color:#0d0e15}
.nb-cand[data-on=true] .nb-cand-check{background:${T.accent};border-color:${T.accent}}
.nb-cand-title{display:block;font-size:13.5px;font-weight:600;line-height:1.35;color:${T.text}}
.nb-cand-sub{display:flex;gap:7px;align-items:flex-start;margin-top:5px;font-size:12px;
  color:${T.text3};line-height:1.5}
.nb-cand-sub .nb-chip{flex:0 0 auto;margin-top:1px}
.nb-cand-sub > span:last-child{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;min-width:0}

/* ------------------------------------------------------- title block (main) */
.nb-main-head{padding:24px 30px 0;border-bottom:1px solid var(--nb-hair-soft);flex:0 0 auto;position:relative}
.nb-hero{display:flex;align-items:flex-start;gap:16px;margin-bottom:16px}
.nb-hero-emoji{width:52px;height:52px;flex:0 0 auto;display:grid;place-items:center;font-size:30px;
  border-radius:16px;background:var(--nb-wash-2);border:1px solid var(--nb-hair-soft)}
.nb-hero-main{min-width:0;flex:1}
.nb-hero-main .nb-h1{margin-bottom:6px}
.nb-h1{font-size:27px;font-weight:700;letter-spacing:-.025em;line-height:1.15;margin:0;max-width:30ch;
  text-wrap:balance}
.nb-sub{color:${T.text2};font-size:14px;line-height:1.55;margin:0;max-width:70ch}
.nb-hero-side{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding-top:6px}
/* ops host-measurement strip (Lab Ops only) */
.nb-strip{display:flex;align-items:stretch;gap:8px;margin:14px 0 0;flex-wrap:wrap}
.nb-cell{flex:1;min-width:90px;padding:10px 14px 11px;border-radius:12px;
  border:1px solid var(--nb-hair-soft);background:var(--nb-wash)}
.nb-cell b{display:block;font-size:17px;font-weight:650;letter-spacing:-.02em;
  line-height:1.1;font-variant-numeric:tabular-nums}
.nb-cell span{display:block;font-size:11px;color:${T.text3};margin-top:6px;font-weight:600}
.nb-tabs{display:flex;gap:4px;align-items:flex-end;margin:16px 0 0;position:relative;bottom:-1px}
.nb-tab{min-height:38px;padding:0 14px 11px;border:0;border-bottom:2px solid transparent;
  border-radius:10px 10px 0 0;background:transparent;color:${T.text2};font-size:13.5px;
  font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;letter-spacing:0;
  font-family:inherit;transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease)}
.nb-tab:hover{color:${T.text};background:var(--nb-wash)}
.nb-tab[aria-selected=true]{color:${T.text};border-bottom-color:${T.accent};background:var(--nb-wash)}
.nb-tab[disabled]{opacity:.45;cursor:default}

/* ------------------------------------------------------------------- chat */
.nb-chat{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-chatscroll{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.nb-hl{background:color-mix(in srgb, ${T.accent} 30%, transparent);color:inherit;border-radius:4px;padding:0 2px}
.nb-latest{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:20;display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:999px;border:1px solid var(--nb-line,#2a2d3d);background:var(--nb-card,#14161f);color:var(--nb-text2,#c6c9d8);font-size:12.5px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35);transition:transform var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-latest:hover{transform:translateX(-50%) translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.45)}
.nb-thread{flex:1;min-height:0;overflow:auto;padding:28px 28px 12px;display:flex;flex-direction:column;gap:24px}
.nb-msg{max-width:72ch;animation:nb-msg-in var(--nb-dur-fast) var(--nb-ease) both}
@keyframes nb-msg-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
/* generative marks breathe — a slow 1.5% drift so sigils feel alive, not pasted */
.nb-hero-emoji svg,.nb-nbcard-emoji svg,.nb-feature-emoji svg{animation:nb-sigil-float 9s ease-in-out infinite}
@keyframes nb-sigil-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-2px) rotate(1.2deg)}}
/* home cards arrive in a stagger — the directory assembles itself */
.nb-nbcard-wrap,.nb-feature{animation:nb-card-in var(--nb-dur-med) var(--nb-ease) both}
@keyframes nb-card-in{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}
/* sigil inscription — ribbons draw themselves in sequence, nodes pop after */
.nb-sigil-draw path{stroke-dasharray:1;stroke-dashoffset:1;animation:nb-draw .9s cubic-bezier(.45,.05,.3,1) forwards}
.nb-sigil-draw path:nth-child(2){animation-delay:.18s}
.nb-sigil-draw path:nth-child(3){animation-delay:.36s}
.nb-sigil-draw circle{opacity:0;animation:nb-pop .45s cubic-bezier(.2,.9,.3,1.4) forwards}
.nb-sigil-draw circle:nth-child(4){animation-delay:.75s}
.nb-sigil-draw circle:nth-child(5){animation-delay:.9s}
@keyframes nb-draw{to{stroke-dashoffset:0}}
@keyframes nb-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.nb-sigil-draw{transform-origin:center;animation:nb-sigil-settle 1.1s var(--nb-ease) both}
@keyframes nb-sigil-settle{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){
  .nb-msg,.nb-nbcard-wrap,.nb-feature,.nb-hero-emoji svg,.nb-nbcard-emoji svg,.nb-feature-emoji svg,.nb-blob,.nb-sigil-draw{animation:none!important}
  .nb-sigil-draw path{stroke-dashoffset:0!important}
  .nb-sigil-draw circle{opacity:1!important;transform:none!important}
}
.nb-msg[data-role=assistant]{display:grid;grid-template-columns:30px minmax(0,1fr);gap:14px;align-self:flex-start}
.nb-msg[data-role=user]{align-self:flex-end;max-width:62ch}
.nb-msg-body{min-width:0}
.nb-msg[data-role=user] .nb-bubble{background:var(--nb-wash-2);border:1px solid var(--nb-hair-soft);
  border-radius:16px;padding:11px 17px;font-size:15px;line-height:1.55;color:${T.text}}
.nb-msg[data-role=assistant] .nb-bubble{font-size:16px;line-height:1.66;color:${T.text}}
.nb-msg[data-role=assistant] .nb-avatar{width:30px;height:30px;margin-top:2px}
.nb-avatar{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;border-radius:12px;
  background:var(--nb-wash-2);color:${T.text2};font-size:13px;font-weight:700}
.nb-nbrow[aria-current=true] .nb-avatar{background:color-mix(in srgb,${T.accent} 20%, transparent);color:${T.accent}}
.nb-msg .nb-avatar{width:30px;height:30px;border-radius:99px;
  background:color-mix(in srgb,${T.accent} 16%, transparent);color:${T.accent};font-size:11px;letter-spacing:.02em}
.nb-who{font-size:11.5px;letter-spacing:.02em;color:${T.text3};font-weight:600;margin-bottom:8px}
.nb-msg[data-role=user] .nb-who{color:${T.text4}}
.nb-md p{margin:0 0 11px}
.nb-md p:last-child{margin-bottom:0}
.nb-md h2{font-size:17px;margin:20px 0 8px;letter-spacing:-.015em}
.nb-md h3{font-size:15px;margin:16px 0 6px;color:${T.text2};font-weight:700}
.nb-md ul{margin:0 0 11px;padding-left:20px}
.nb-md li{margin:5px 0}
.nb-md li::marker{color:${T.accent}}
.nb-md code{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:12.5px;
  background:var(--nb-wash-2);padding:1.5px 6px;border-radius:6px}
.nb-md strong{font-weight:650;color:${T.text}}
.nb-md blockquote{margin:12px 0;padding:10px 16px;border-radius:12px;color:${T.text2};
  background:var(--nb-wash);border-left:3px solid color-mix(in srgb,${T.accent} 55%, transparent)}
/* inline citations are quiet accent pills with the source number */
.nb-inline-cite{display:inline-flex;align-items:center;min-height:20px;padding:0 8px;margin:0 2px;
  border-radius:99px;border:1px solid color-mix(in srgb,${T.accent} 30%, transparent);
  background:color-mix(in srgb,${T.accent} 10%, transparent);
  font-size:11px;font-weight:700;letter-spacing:.01em;
  color:${T.accent};cursor:pointer;vertical-align:1px;line-height:1}
.nb-inline-cite:hover{background:color-mix(in srgb,${T.accent} 20%, transparent)}
.nb-composer{flex:0 0 auto;padding:14px 30px 20px}
.nb-askbox{display:flex;flex-direction:column;gap:10px;border:1px solid var(--nb-hair);
  border-radius:26px;background:var(--nb-card);padding:14px 16px;box-shadow:var(--nb-shadow);
  transition:border-color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-askbox:focus-within{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  box-shadow:0 0 0 4px color-mix(in srgb,${T.accent} 15%, transparent), var(--nb-shadow)}
.nb-askbox textarea{width:100%;min-height:44px;max-height:150px;resize:none;border:0;outline:0;
  background:transparent;color:${T.text};font-size:15px;line-height:1.5;font-family:inherit}
.nb-askbox textarea::placeholder{color:${T.text3}}
.nb-askfoot{display:flex;align-items:center;gap:8px}
.nb-sendbtn{width:38px;height:38px;flex:0 0 auto;border-radius:99px;border:0;cursor:pointer;
  background:${T.accent};color:#0d0e15;display:grid;place-items:center;padding:0;
  transition:opacity var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-sendbtn:hover{transform:scale(1.05)}
.nb-sendbtn[disabled]{opacity:.4;cursor:not-allowed;transform:none}
.nb-disclaimer{font-size:11px;color:${T.text3};text-align:center;margin-top:9px}

/* ------------------------------------------------- overview + suggestions */
.nb-overview{border:1px solid var(--nb-hair-soft);border-radius:16px;background:var(--nb-card);
  padding:18px 20px;display:grid;gap:10px}
.nb-overview-head{display:flex;align-items:center;gap:8px}
.nb-overview-head .nb-meta{flex:1}
.nb-overview-body{font-size:14.5px;line-height:1.66;color:${T.text2}}
.nb-overview-body .nb-md strong{color:${T.text}}
.nb-suggest-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.nb-suggest{display:flex;flex-direction:column;justify-content:space-between;gap:10px;
  min-height:104px;text-align:left;padding:14px;border-radius:16px;cursor:pointer;
  border:1px solid var(--nb-hair-soft);background:var(--nb-card);color:${T.text};
  font-family:inherit;font-size:13px;line-height:1.45;transition:border-color var(--nb-dur-fast) var(--nb-ease),
  background var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-suggest:hover{border-color:color-mix(in srgb,${T.accent} 45%, transparent);
  background:var(--nb-wash-2);transform:translateY(-1px)}
.nb-suggest-q{font-weight:550}
.nb-suggest-go{color:${T.text4};display:flex;justify-content:flex-end}
.nb-gaprow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.nb-gaprow .nb-chip[data-click=true]{border-style:dashed}
.nb-thrrow{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
  padding:10px 12px;border-radius:12px;cursor:pointer;font-family:inherit;
  border:1px solid transparent;background:transparent;color:${T.text}}
.nb-thrrow:hover{background:var(--nb-wash)}
.nb-thrrow.is-current{border-color:color-mix(in srgb,${T.accent} 40%, transparent);
  background:color-mix(in srgb,${T.accent} 8%, transparent)}
.nb-thrwrap{display:flex;align-items:center;gap:4px}
.nb-thrwrap .nb-thrrow{flex:1;min-width:0}
.nb-thrwrap .nb-icon{opacity:0;transition:opacity var(--nb-dur-fast) var(--nb-ease)}
.nb-thrwrap:hover .nb-icon,.nb-thrwrap:focus-within .nb-icon{opacity:1}
.nb-emgrid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.nb-em{aspect-ratio:1;border-radius:8px;border:1px solid var(--nb-hair-soft);
  background:var(--nb-card);font-size:17px;cursor:pointer;display:grid;place-items:center;
  transition:border-color var(--nb-dur-fast) var(--nb-ease),background var(--nb-dur-fast) var(--nb-ease)}
.nb-em:hover{border-color:color-mix(in srgb,${T.accent} 45%, transparent)}
.nb-em.is-on{border-color:${T.accent};background:color-mix(in srgb,${T.accent} 12%, transparent)}

/* --------------------------------------------------------- studio (index) */
.nb-grid{display:flex;flex-direction:column;gap:10px;padding:12px 14px 26px}
/* the generator bento: compact 2-col pills, each tinted by its kind colour */
.nb-gen-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}

/* each output pill carries its own colour (--kc) */
.nb-card{--kc:${T.accent};
  display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;
  border:1px solid var(--nb-hair-soft);border-radius:16px;
  background:var(--nb-card);cursor:pointer;text-align:left;color:${T.text};
  transition:background var(--nb-dur-fast) var(--nb-ease),border-color var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease),
    box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-card:hover{background:var(--nb-wash-2);border-color:color-mix(in srgb,var(--kc) 42%, var(--nb-hair));
  transform:translateY(-1px);
  box-shadow:0 8px 26px -10px color-mix(in srgb,var(--kc) 45%, transparent)}
.nb-card[data-ready=true]{border-color:color-mix(in srgb,var(--kc) 30%, var(--nb-hair-soft))}
.nb-card[data-busy=true]{border-color:color-mix(in srgb,var(--kc) 50%, transparent);
  background:color-mix(in srgb,var(--kc) 6%, var(--nb-card))}
.nb-card-ico{width:32px;height:32px;flex:0 0 auto;border-radius:8px;display:grid;place-items:center;
  background:color-mix(in srgb,var(--kc) 14%, transparent);color:var(--kc)}
.nb-card[data-kind=video_overview],.nb-art[data-kind=video_overview]{--kc:#81c995}
.nb-card[data-kind=audio_overview],.nb-art[data-kind=audio_overview]{--kc:#a8c7fa}
.nb-card[data-kind=summary],.nb-art[data-kind=summary]{--kc:#aecbfa}
.nb-card[data-kind=briefing_doc],.nb-art[data-kind=briefing_doc]{--kc:#f28b82}
.nb-card[data-kind=study_guide],.nb-art[data-kind=study_guide]{--kc:#81c995}
.nb-card[data-kind=faq],.nb-art[data-kind=faq]{--kc:#fde293}
.nb-card[data-kind=timeline],.nb-art[data-kind=timeline]{--kc:#c58af9}
.nb-card[data-kind=mind_map],.nb-art[data-kind=mind_map]{--kc:#c58af9}
.nb-card[data-kind=flashcards],.nb-art[data-kind=flashcards]{--kc:#fde293}
.nb-card[data-kind=quiz],.nb-art[data-kind=quiz]{--kc:#c58af9}
.nb-card[data-kind=slides],.nb-art[data-kind=slides]{--kc:#f28b82}
.nb-card[data-kind=infographic],.nb-art[data-kind=infographic]{--kc:#fde293}
.nb-card-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
.nb-card-name{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;
  letter-spacing:0;line-height:1.25;color:${T.text}}
.nb-card-name svg{color:var(--kc);flex:0 0 auto}
.nb-card-blurb{display:block;font-size:11px;line-height:1.4;color:${T.text3};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-card-foot{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:5px}
.nb-card-state{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
  font-size:10.5px;font-weight:600;color:${T.text3}}
.nb-card[data-ready=true] .nb-card-state{color:${T.ok};background:color-mix(in srgb,${T.ok} 13%, transparent)}
.nb-card[data-busy=true] .nb-card-state{color:var(--kc);background:color-mix(in srgb,var(--kc) 13%, transparent)}
.nb-dot{width:6px;height:6px;border-radius:99px;background:${T.text4};display:inline-block;flex:0 0 auto}
.nb-card[data-ready=true] .nb-dot{background:${T.ok}}
.nb-card[data-busy=true] .nb-dot{background:var(--kc);animation:nb-pulse 1.2s ease-in-out infinite}
.nb-bar-track{height:4px;margin-top:2px;background:var(--nb-wash-2);border-radius:99px;overflow:hidden;display:block;flex:1;max-width:120px}
.nb-bar-fill{height:100%;background:var(--kc);border-radius:99px;transition:width var(--nb-dur-med) var(--nb-ease)}
@keyframes nb-pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* the generated-artifacts list: tinted icon tile + title + meta */
.nb-artlist{display:flex;flex-direction:column;gap:4px}
.nb-art{display:flex;align-items:center;gap:11px;width:100%;text-align:left;
  padding:8px 10px;border-radius:12px;border:0;background:transparent;color:${T.text};
  cursor:pointer;font-family:inherit;transition:background var(--nb-dur-fast) var(--nb-ease)}
.nb-art:hover{background:var(--nb-wash-2)}
.nb-art-ico{width:40px;height:40px;flex:0 0 auto;border-radius:12px;position:relative;overflow:hidden;
  display:grid;place-items:center;
  background:color-mix(in srgb,var(--kc) 13%, transparent);
  color:color-mix(in srgb,var(--kc) 70%, ${T.text});
  border:1px solid color-mix(in srgb,var(--kc) 22%, transparent)}
.nb-art-ico svg{opacity:.9}
.nb-art-main{flex:1;min-width:0}
.nb-art-title{display:block;font-size:13px;font-weight:600;line-height:1.3;color:${T.text};
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-art-sub{display:block;font-size:11px;color:${T.text3};margin-top:2px;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-artrow{position:relative}
.nb-art-del{position:absolute;right:8px;top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity var(--nb-dur-fast) var(--nb-ease)}
.nb-artrow:hover .nb-art-del,.nb-art-del:focus-visible{opacity:1}
.nb-artrow:hover .nb-art{padding-right:36px}

/* thumb content inside the artifact icon tile */
.nb-art-ico .nb-thumb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nb-art-ico .nb-thumb-wave{display:flex;align-items:center;gap:1.5px;height:70%;width:80%}
.nb-art-ico .nb-thumb-wave i{flex:1 1 0;min-width:1.5px;border-radius:99px;background:var(--kc);opacity:.8}

/* ----------------------------------------------------------------- viewer */
.nb-view{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-view-head{display:flex;align-items:center;gap:12px;padding:12px 24px;
  border-bottom:1px solid var(--nb-hair-soft)}
.nb-view-title{font-size:15.5px;font-weight:650;letter-spacing:-.01em}
.nb-view-body{flex:1;min-height:0;overflow:auto;padding:26px}
.nb-doc{max-width:70ch;font-size:15.5px;line-height:1.68}
.nb-doc h1{font-size:23px;line-height:1.2;letter-spacing:-.025em;margin:0 0 14px;text-wrap:balance}
.nb-doc em{color:${T.text2}}
.nb-doc hr{border:0;border-top:1px solid var(--nb-hair-soft);margin:22px 0}
.nb-doc h2{font-size:19px;margin:26px 0 10px;letter-spacing:-.02em}
.nb-doc h2:first-child{margin-top:0}
.nb-doc h3{font-size:15px;margin:20px 0 6px;color:${T.text2};font-weight:700}
.nb-doc ul,.nb-doc ol{padding-left:22px;margin:0 0 12px}
.nb-doc li{margin:5px 0}
.nb-doc table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px;margin:14px 0;
  border:1px solid var(--nb-hair-soft);border-radius:12px;overflow:hidden}
.nb-doc th,.nb-doc td{border-bottom:1px solid var(--nb-hair-soft);padding:9px 12px;text-align:left}
.nb-doc td+td,.nb-doc th+th{border-left:1px solid var(--nb-hair-soft)}
.nb-doc tr:last-child td{border-bottom:0}
.nb-doc th{background:var(--nb-wash-2);font-size:11px;letter-spacing:.05em;text-transform:uppercase;
  font-weight:700;color:${T.text2}}
.nb-doc pre{background:var(--nb-wash);border:1px solid var(--nb-hair-soft);border-radius:12px;
  padding:14px;overflow:auto;font-size:13px}

/* -------------------------------------------------------------- stage/media */
.nb-stage{display:flex;flex-direction:column;gap:16px}
.nb-screen{position:relative;overflow:hidden;border-radius:16px;border:1px solid var(--nb-hair);
  background:var(--nb-media);aspect-ratio:16/9;display:grid;place-items:center;box-shadow:var(--nb-shadow)}
.nb-screen video,.nb-screen iframe{width:100%;height:100%;border:0;display:block;background:#000}
.nb-screen-audio{aspect-ratio:auto;padding:22px;display:flex;flex-direction:column;gap:16px;
  place-items:stretch;width:100%}
.nb-wave{display:flex;align-items:center;gap:2.5px;height:72px;width:100%}
.nb-wave i{flex:1 1 0;min-width:2px;height:100%;border-radius:99px;background:rgba(235,238,245,.42)}
.nb-wave i[data-past=true]{background:${T.accent};opacity:1}
.nb-ctrl{display:flex;align-items:center;gap:10px}
.nb-timeline{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none;position:relative}
.nb-timeline::before{content:'';position:absolute;left:7px;top:10px;bottom:10px;width:2px;
  border-radius:2px;background:var(--nb-hair-soft)}
.nb-tl{display:grid;grid-template-columns:110px 1fr;gap:16px;padding:13px 0 13px 24px;
  border-top:1px solid var(--nb-hair-soft);position:relative}
.nb-tl:first-child{border-top:0}
.nb-tl::before{content:'';position:absolute;left:2px;top:20px;width:11px;height:11px;border-radius:99px;
  background:${T.accent};box-shadow:0 0 0 3px color-mix(in srgb,${T.accent} 18%, transparent)}
.nb-tl-when{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:700;
  color:${T.accent};letter-spacing:.06em;text-transform:uppercase;padding-top:3px}
.nb-tl-what{font-size:15px;color:${T.text2}}

/* ---------------------------------------------------------------- mind map */
.nb-map{width:100%;height:100%;min-height:340px;display:block;cursor:grab;border-radius:16px;
  border:1px solid var(--nb-hair-soft);
  background:radial-gradient(circle at 50% 45%, color-mix(in srgb,${T.accent} 9%, transparent), transparent 62%), var(--nb-card)}
.nb-map:active{cursor:grabbing}

/* -------------------------------------------------------------- flashcards */
.nb-deck{display:flex;flex-direction:column;gap:16px;max-width:640px;margin:0 auto;width:100%}
.nb-flip{perspective:1400px;cursor:pointer;border:0;background:transparent;padding:0;width:100%}
.nb-flip-inner{position:relative;width:100%;min-height:310px;transition:transform .5s cubic-bezier(.2,.7,.2,1);
  transform-style:preserve-3d}
.nb-flip[data-flipped=true] .nb-flip-inner{transform:rotateY(180deg)}
.nb-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;
  border:1px solid var(--nb-hair);background:var(--nb-card);box-shadow:var(--nb-shadow);
  padding:30px;display:flex;flex-direction:column;justify-content:center;gap:12px;
  font-size:19px;line-height:1.5}
.nb-face[data-side=back]{transform:rotateY(180deg);border-color:color-mix(in srgb,${T.accent} 45%, transparent);
  background:linear-gradient(160deg, color-mix(in srgb,${T.accent} 14%, var(--nb-card)), var(--nb-card))}
.nb-face .nb-meta{position:absolute;top:17px;left:22px}
.nb-face-hint{font-size:11.5px;color:${T.text4};margin-top:auto;letter-spacing:.02em}

/* -------------------------------------------------------------------- ops */
.nb-fleet{display:flex;flex-direction:column;gap:8px;padding:8px 0}
.nb-frow{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:12px;
  padding:11px 14px;border:1px solid var(--nb-hair-soft);border-radius:12px;background:var(--nb-card);
  cursor:pointer;text-align:left;color:${T.text};min-height:54px;
  transition:border-color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-frow:hover{border-color:color-mix(in srgb,${T.text} 20%, transparent);box-shadow:var(--nb-shadow)}
.nb-frow[aria-current=true]{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  background:color-mix(in srgb,${T.accent} 9%, var(--nb-card))}
.nb-fname{font-size:14px;font-weight:600;line-height:1.25}
.nb-frole{font-size:10.5px;color:${T.text3};text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.nb-term{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13px;line-height:1.55;flex:1 1 auto;
  background:#101320;color:#c9cede;border-radius:16px;padding:16px;min-height:130px;max-height:none;overflow:auto;
  white-space:pre-wrap;word-break:break-word;border:1px solid rgba(255,255,255,.09);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.nb-term-in{display:flex;gap:8px;align-items:center;margin-top:10px}
.nb-term-in input{flex:1;height:38px;border-radius:12px;border:1px solid var(--nb-hair);
  background:var(--nb-wash);color:${T.text};padding:0 13px;font-size:13.5px;
  font-family:var(--ui-font-mono,ui-monospace,monospace);outline:0}
.nb-term-in input:focus{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}

/* -------------------------------------------------------------- status bar */
.nb-status{flex:0 0 32px;height:32px;display:flex;align-items:center;gap:18px;padding:0 18px;
  border-top:1px solid var(--nb-hair-soft);background:transparent;
  font-size:11.5px;color:${T.text3}}
.nb-status b{color:${T.text2};font-weight:600}
.nb-sdot{width:8px;height:8px;border-radius:99px;display:inline-block;margin-right:8px;vertical-align:middle}
.nb-void{display:grid;place-items:center;height:100%;padding:40px;text-align:center;color:${T.text3}}
.nb-void h3{color:${T.text};font-size:21px;margin:0 0 10px;letter-spacing:-.02em;font-weight:700}
.nb-void p{margin:0;max-width:48ch;font-size:14px;line-height:1.62}

/* ------------------------------------------------------------ home (directory) */
.nb-home{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-home-scroll{flex:1;min-height:0;overflow:auto;padding:26px 30px 30px;overscroll-behavior:contain}
.nb-home-head{display:flex;align-items:flex-end;gap:16px;margin-bottom:24px;flex-wrap:wrap}
.nb-home-title{font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1.2}
.nb-home-sub{font-size:13.5px;color:${T.text2};margin:5px 0 0}
.nb-home-search{width:260px;margin-left:auto}
.nb-feature-row{display:flex;gap:14px;overflow-x:auto;padding:2px 2px 12px;margin-bottom:26px;
  scrollbar-width:thin}
.nb-feature{flex:0 0 290px;height:170px;border-radius:16px;padding:18px;position:relative;
  overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;
  text-align:left;cursor:pointer;color:${T.text};font-family:inherit;
  border:1px solid var(--nb-hair-soft);
  background:linear-gradient(135deg, color-mix(in srgb,var(--kc) 30%, var(--nb-card)), var(--nb-card) 72%);
  transition:transform var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-feature:hover{transform:translateY(-2px);box-shadow:var(--nb-shadow-lift)}
.nb-feature::after{content:'';position:absolute;right:-46px;bottom:-58px;width:190px;height:190px;
  border-radius:99px;background:color-mix(in srgb,var(--kc) 22%, transparent);pointer-events:none}
.nb-feature-emoji{font-size:30px;line-height:1}
.nb-feature-title{font-size:15.5px;font-weight:650;line-height:1.3;max-width:24ch;position:relative}
.nb-feature-meta{font-size:11.5px;color:${T.text3};position:relative}
.nb-home-sec{display:flex;align-items:center;gap:12px;margin:0 0 14px}
.nb-home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:13px;
  align-content:start}
.nb-nbcard-wrap{position:relative;height:170px}
.nb-nbcard{height:100%;position:relative;border-radius:16px;padding:16px;display:flex;
  flex-direction:column;justify-content:space-between;text-align:left;cursor:pointer;
  color:${T.text};font-family:inherit;
  border:1px solid var(--nb-hair-soft);background:var(--nb-card);
  transition:border-color var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-nbcard:hover{border-color:color-mix(in srgb,${T.accent} 42%, var(--nb-hair));
  transform:translateY(-2px);box-shadow:var(--nb-shadow-lift)}
.nb-nbcard-emoji{font-size:32px;line-height:1}
.nb-nbcard-del{position:absolute;top:9px;right:7px}
.nb-nbcard-ren{position:absolute;top:9px;right:32px}
.nb-nbcard-title{font-size:14.5px;font-weight:650;line-height:1.35;padding-right:28px}
.nb-nbcard-meta{font-size:11.5px;color:${T.text3};margin-top:8px}

/* generator options popover + citation hover card + data table */
.nb-gen{position:relative}
.nb-gen-cfg{position:absolute;top:4px;right:4px;width:32px;height:32px;opacity:0;
  transition:opacity var(--nb-dur-fast) var(--nb-ease)}
.nb-gen:hover .nb-gen-cfg,.nb-gen-cfg[data-active="true"]{opacity:1}
.nb-genpop{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:30;
  background:${T.card};border:1px solid ${T.line};border-radius:16px;
  box-shadow:var(--nb-shadow-lift);padding:12px;display:grid;gap:12px}
.nb-genopt-label{font-size:11px;font-weight:600;color:${T.text3};margin-bottom:6px;
  text-transform:uppercase;letter-spacing:.06em}
.nb-genopt .nb-seg{width:100%}
.nb-genopt .nb-seg button{flex:1;justify-content:center}
.nb-genopt-text{width:100%;height:32px;padding:0 10px;border-radius:8px;font-size:13px;
  border:1px solid ${T.line};background:${T.inset};color:${T.text};outline:none}
.nb-genopt-text:focus{border-color:color-mix(in srgb,${T.accent} 55%,transparent)}

.nb-citepop{position:fixed;z-index:80;width:320px;max-width:calc(100vw - 32px);
  background:${T.card};border:1px solid ${T.line};border-radius:16px;
  box-shadow:var(--nb-shadow-lift);padding:12px 14px;pointer-events:none}
.nb-citepop-head{display:flex;align-items:center;gap:8px;font-size:12.5px;
  color:${T.text3};margin-bottom:6px;flex-wrap:wrap}
.nb-citepop-head b{color:${T.accent};font-weight:700}
.nb-citepop-body{font-size:13px;line-height:1.55;color:${T.text2};
  display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}

.nb-scope-check{flex:none;width:18px;height:18px;border-radius:6px;
  border:1.5px solid ${T.line};display:grid;place-items:center;font-size:11px;
  color:#fff;transition:all var(--nb-dur-fast) var(--nb-ease)}
.nb-scope-check.on{background:${T.accent};border-color:${T.accent}}

.nb-search-hit{display:block;width:100%;text-align:left;background:transparent;
  border:1px solid ${T.line};border-radius:12px;padding:10px 12px;cursor:pointer;
  color:${T.text};font:inherit;transition:border-color var(--nb-dur-fast) var(--nb-ease),background var(--nb-dur-fast) var(--nb-ease)}
.nb-search-hit:hover{border-color:color-mix(in srgb,${T.accent} 45%,transparent);
  background:color-mix(in srgb,${T.accent} 6%,transparent)}
.nb-search-hit-head{display:flex;align-items:center;gap:8px;font-size:13.5px;
  margin-bottom:4px}
.nb-search-hit-head b{font-weight:600;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.nb-search-hit-snip{font-size:13px;line-height:1.5;color:${T.text3};
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nb-search-hit mark{background:color-mix(in srgb,${T.accent} 30%,transparent);
  color:${T.text};border-radius:3px;padding:0 1px}

.nb-dt-wrap{overflow:auto;border:1px solid ${T.line};border-radius:16px;
  background:${T.card}}
.nb-dt{border-collapse:collapse;width:100%;font-size:13px;min-width:520px}
.nb-dt th{position:sticky;top:0;background:${T.inset};text-align:left;
  font-weight:650;font-size:12px;color:${T.text2};padding:10px 14px;
  border-bottom:1px solid ${T.line};cursor:pointer;user-select:none;white-space:nowrap}
.nb-dt th:hover{color:${T.text}}
.nb-dt-arrow{color:${T.accent};margin-left:5px;font-size:11px}
.nb-dt td{padding:9px 14px;border-bottom:1px solid ${T.lineSoft};color:${T.text2}}
.nb-dt tbody tr:last-child td{border-bottom:0}
.nb-dt tbody tr:hover td{background:color-mix(in srgb,${T.accent} 4%,transparent)}

@media (max-width:1280px){
  .nb-root{--nb-rail:250px; --nb-studio:320px}
  .nb-body{padding:10px;gap:10px}
  .nb-h1{font-size:24px}
}
@media (max-width:1100px){
  .nb-studio{display:none}
  .nb-thread{padding:22px 20px 12px}
  .nb-main-head{padding:20px 20px 0}
  .nb-composer{padding:12px 20px 16px}
  .nb-home-scroll{padding:20px 18px 24px}
}
@media (max-width:820px){
  .nb-rail{display:none}
  .nb-h1{font-size:21px}
  .nb-body{padding:8px;gap:8px}
  .nb-suggest-grid{grid-template-columns:1fr}
}

/* study — a session, not a deck viewer: one card at a time, keyboard first */
.nb-study{display:flex;flex-direction:column;gap:16px;padding:26px 30px 40px;max-width:980px;margin:0 auto;min-height:0}
.nb-study-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
.nb-study-title{font-size:21px;font-weight:650;letter-spacing:-.01em;color:${T.text}}
.nb-study-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.nb-study-actions{display:flex;gap:8px;align-items:center}
.nb-study-progress{display:flex;align-items:center;gap:12px}
.nb-study-bar{flex:1;height:4px;border-radius:99px;background:var(--nb-hair-soft);overflow:hidden}
.nb-study-bar i{display:block;height:100%;background:${T.accent};border-radius:99px;transition:width .25s ease}
.nb-study-card{border:1px solid var(--nb-hair);border-radius:20px;background:var(--nb-card);
  padding:28px 30px 24px;min-height:210px;display:flex;flex-direction:column;gap:16px;
  box-shadow:var(--nb-shadow)}
.nb-study-card[data-phase="new"]{border-color:color-mix(in srgb,${T.accent} 40%, var(--nb-hair))}
.nb-study-q{font-size:22px;line-height:1.4;font-weight:600;color:${T.text};max-width:62ch}
.nb-study-choices{display:grid;gap:8px;max-width:62ch}
.nb-study-choice{padding:10px 14px;border-radius:11px;border:1px solid var(--nb-hair-soft);
  background:var(--nb-card-deep, transparent);color:${T.text2};font-size:14.5px}
.nb-study-choice[data-right="true"]{border-color:${T.ok};background:color-mix(in srgb,${T.ok} 14%, transparent);color:${T.text}}
.nb-study-a{display:flex;flex-direction:column;gap:8px;font-size:16px;line-height:1.55;color:${T.text};
  padding-top:14px;border-top:1px solid var(--nb-hair-soft)}
.nb-study-a-label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${T.text4}}
.nb-study-reveal{display:flex;align-items:center;gap:12px;margin-top:auto}
.nb-study-ratings{display:flex;gap:8px;flex-wrap:wrap;min-height:44px;align-items:center}
.nb-study-rate{flex:1 1 150px;display:flex;flex-direction:column;gap:2px;align-items:flex-start;
  padding:10px 14px;border-radius:12px;border:1px solid var(--nb-hair);background:var(--nb-card);
  color:${T.text};cursor:pointer;font-size:14px}
.nb-study-rate span{font-size:11.5px;color:${T.text3}}
.nb-study-rate:hover{background:var(--nb-card-hover, color-mix(in srgb,#fff 4%, transparent))}
.nb-study-src{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:0;
  border:0;background:none;color:${T.accent};font-size:12.5px;text-decoration:underline;
  text-underline-offset:3px;cursor:pointer}
.nb-study-empty{display:grid;justify-items:center;gap:10px;padding:64px 20px;text-align:center;
  color:${T.text3};border:1px dashed var(--nb-hair-soft);border-radius:18px}
@media (max-width:820px){ .nb-study{padding:18px 16px 32px} .nb-study-q{font-size:19px} }
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
