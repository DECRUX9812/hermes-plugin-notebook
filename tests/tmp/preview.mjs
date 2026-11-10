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

/* Quiet ink.
 *
 * The theme's tertiary/quaternary are 58% and 42% of the base ink. Measured on
 * the real page that is 5.98:1 / 3.63:1 in the dark skin and 4.31:1 / 3.57:1 in
 * a light one — the quaternary fails WCAG AA everywhere, and the tertiary fails
 * on a light canvas. These two tokens print at 11.5–12.5px, so they take the AA
 * floor rather than the theme's staircase: 72% and 68% of the primary ink clear
 * 4.5:1 on every surface this page paints in both skins (canvas, panel, card,
 * wash) and stay visibly quieter than the secondary. The host's own
 * --ui-text-tertiary remains available where a surface needs its exact value.
 */
const T = {
  text: 'var(--nb-ink, #F1F3F4)',
  text2: 'var(--nb-ink2, #9AA0A6)',
  text3: 'color-mix(in srgb, var(--nb-ink, #F1F3F4) 74%, transparent)',
  text4: 'color-mix(in srgb, var(--nb-ink, #F1F3F4) 66%, transparent)',
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
  --nb-rail: 268px; --nb-studio: 420px;
  /* NotebookLM's palette, per skin. The host never sets a color-scheme, so the
     page publishes data-skin (measured from the host's own canvas) and these
     two blocks are the only place a colour is decided. */
  --nb-canvas:#0B0C0E; --nb-panel:#16171A; --nb-edge:rgba(255,255,255,.08);
  --nb-tile:#202124; --nb-tile-hi:#2A2B2E; --nb-ink:#F1F3F4; --nb-ink2:#9AA0A6;
  --nb-inset:#0F1012;
  --nb-hair: color-mix(in srgb, ${T.text} 10%, transparent);
  --nb-hair-soft: color-mix(in srgb, ${T.text} 6%, transparent);
  --nb-wash: color-mix(in srgb, ${T.text} 4%, transparent);
  --nb-wash-2: color-mix(in srgb, ${T.text} 7.5%, transparent);
  --nb-card: ${T.card};
  --nb-cite-bg:#2D2E33; --nb-cite-ink:#8AB4F8;
  --nb-shadow: 0 1px 2px rgba(8,10,18,.05), 0 14px 34px -20px rgba(8,10,18,.30);
  --nb-shadow-lift: 0 2px 6px rgba(8,10,18,.07), 0 20px 44px -18px rgba(8,10,18,.38);
  /* motion — Astryx cadence: fast for hovers, medium for entrances, standard
     curve decelerates, exit accelerates */
  --nb-ease: cubic-bezier(.24,1,.4,1);
  --nb-ease-exit: cubic-bezier(.3,0,.6,.6);
  --nb-dur-fast: .175s; --nb-dur-med: .41s; --nb-dur-slow: .975s;
  /* radius — one semantic scale instead of ad-hoc pixels: detail 8, element 12,
     box 16, panel 24, pill. A control's radius says how big it is. */
  --nb-r-in: 8px; --nb-r-el: 12px; --nb-r-box: 16px; --nb-r-panel: 24px; --nb-r-pill: 99px;
  /* type — the chrome scale. Every rendered size must be one of these steps;
     an 11px label beside an 11.5px one is a bug, and tests/design.test.mjs
     fails the build on any size that is not on this list. Headings are set
     in place because each surface owns exactly one of them. */
  --nb-fs-meta: 11.5px;   /* counts, timestamps, chips */
  --nb-fs-label: 12.5px;  /* card names, chips with actions, buttons */
  --nb-fs-ui: 13px;       /* pane titles, inputs, tabs */
  --nb-fs-body: 14px;     /* the base UI size */
  --nb-fs-read: 15px;     /* prose and document body */
  --nb-fs-title: 16px;    /* hero-side titles, card headings */
  --nb-fs-display: 26px;  /* the one page title */
  /* space — a 4px grid, named by intent so padding is a decision, not a number */
  --nb-sp-1: 4px; --nb-sp-2: 6px; --nb-sp-3: 8px; --nb-sp-4: 12px;
  --nb-sp-5: 16px; --nb-sp-6: 20px; --nb-sp-7: 24px; --nb-sp-8: 32px;
  --nb-media: linear-gradient(155deg,#20243a 0%,#12151f 100%);
  display:flex; flex-direction:column; height:100%; min-height:0;
  background:var(--nb-canvas); color:${T.text}; font-size:16px; line-height:1.5;
  font-variant-numeric: tabular-nums;
  position:relative;
}
.nb-root[data-skin=light]{
  --nb-canvas:#F8F5EE; --nb-panel:#FFFFFF; --nb-edge:#E8E2D8;
  --nb-tile:#F3EEE4; --nb-tile-hi:#EBE4D8; --nb-ink:#1F1F1F; --nb-ink2:#5F6368;
  --nb-inset:#FBF8F2;
  /* Everything derived, rebuilt on light ink. Without these the card faces and
     washes stay night-coloured while the text turns dark — the "1.02:1" bug the
     design pass reports: black ink on a black tile. */
  --nb-card:#F3EEE4;
  --nb-cite-bg:#E8F0FE; --nb-cite-ink:#1967D2;
  --nb-hair:rgba(31,31,31,.10); --nb-hair-soft:rgba(31,31,31,.06);
  --nb-wash:rgba(31,31,31,.04); --nb-wash-2:rgba(31,31,31,.075);
  --nb-shadow:0 1px 2px rgba(24,24,27,.05), 0 14px 34px -20px rgba(24,24,27,.22);
  /* The few rules still written against the host's own tokens are scoped to
     this subtree, so they follow the notebook rather than the app shell. */
  --ui-bg-secondary:#F3EEE4; --ui-bg-tertiary:#EDE6D9;
  --ui-stroke-secondary:rgba(31,31,31,.10); --ui-stroke-tertiary:rgba(31,31,31,.06);
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
/* Form controls do NOT inherit the page font from the UA sheet: a <button> gets
 * Arial 13.333px and a <span> inside it inherits that, which is how "Video
 * Overview" ended up set in Arial while its neighbours were in Inter. One rule
 * at the root stops the whole family of bugs rather than one class at a time. */
.nb-root button,.nb-root input,.nb-root select,.nb-root textarea{
  font-family:inherit;font-feature-settings:inherit;font-variant-numeric:inherit}
.nb-root :focus-visible{outline:2px solid ${T.accent}; outline-offset:3px}
.nb-mono{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-ligatures:none}
.nb-num{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums}

/* quiet section label — small and calm, never telemetry */
.nb-meta{font-size:12.5px;letter-spacing:0;text-transform:none;color:${T.text3};font-weight:600}
.nb-hint{font-size:11.5px;color:${T.text3};letter-spacing:.01em;line-height:1.5}

/* ------------------------------------------------------------------ app bar */
.nb-bar{display:flex;align-items:center;gap:14px;height:56px;flex:0 0 56px;
  padding:0 18px;border-bottom:1px solid var(--nb-hair-soft)}
.nb-brand{display:flex;align-items:center;gap:11px;min-width:0}
.nb-mark{width:27px;height:27px;display:grid;place-items:center;flex:0 0 auto;border-radius:var(--nb-r-in);
  background:color-mix(in srgb,${T.accent} 15%, transparent);color:color-mix(in srgb,${T.accent} 70%, ${T.text})}
.nb-brandname{font-size:14px;font-weight:700;letter-spacing:-.01em;color:${T.text}}
.nb-crumb{font-size:12.5px;color:${T.text3};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(52ch,44vw);display:flex;align-items:center;gap:6px;min-width:0}
.nb-crumb b{color:${T.text2};font-weight:600}
.nb-crumbedit{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:transparent;border:0;padding:0 8px;margin:0 -8px;font:inherit;
  color:${T.text2};font-weight:600;cursor:pointer;border-radius:var(--nb-r-in);
  display:inline-flex;align-items:center;min-height:32px;max-width:42ch;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nb-crumbedit:hover{color:${T.text};background:var(--nb-wash-2)}
.nb-spacer{flex:1 1 auto}
.nb-actions{display:flex;align-items:center;gap:8px}

/* ---------------------------------------------------------------- controls */
.nb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:36px;padding:0 18px;border-radius:var(--nb-r-pill);cursor:pointer;
  font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;font-family:inherit;
  border:1px solid var(--nb-hair);background:var(--nb-wash);color:${T.text};
  transition:background var(--nb-dur-fast) var(--nb-ease),border-color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-btn:hover{background:var(--nb-wash-2);border-color:color-mix(in srgb,${T.text} 22%, transparent)}
.nb-btn:active{transform:translateY(1px)}
.nb-btn[disabled]{opacity:.45;cursor:not-allowed}
.nb-btn[data-variant=primary]{background:${T.accent};border-color:transparent;
  color:#0d0e15;font-weight:650;
  box-shadow:0 6px 18px -8px color-mix(in srgb,${T.accent} 80%, transparent)}
.nb-btn[data-variant=primary]:hover{background:color-mix(in srgb,${T.accent} 88%, ${T.text})}
.nb-btn[data-variant=primary][disabled]{background:var(--nb-wash);border-color:var(--nb-hair);color:${T.text3};box-shadow:none}
.nb-btn[data-variant=ghost]{background:transparent;border-color:transparent;color:${T.text2}}
.nb-btn[data-variant=ghost]:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-btn[data-size=sm]{min-height:32px;padding:0 12px;font-size:12.5px;border-radius:var(--nb-r-in)}
.nb-icon{width:36px;height:36px;min-height:36px;flex:0 0 auto;padding:0;border-radius:var(--nb-r-pill);display:grid;place-items:center;
  cursor:pointer;border:1px solid transparent;background:transparent;color:${T.text3};
  transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease),border-color var(--nb-dur-fast) var(--nb-ease)}
.nb-icon:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-icon[data-active=true]{background:color-mix(in srgb,${T.accent} 14%, transparent);color:color-mix(in srgb,${T.accent} 70%, ${T.text})}

/* segmented control — a pill track with a lifted thumb */
.nb-seg{display:inline-flex;gap:2px;padding:3px;border-radius:var(--nb-r-el);
  border:1px solid var(--nb-hair);background:var(--nb-wash)}
.nb-seg[data-fill="true"]{display:flex;width:100%}
.nb-seg[data-fill="true"] > button{flex:1;justify-content:center}
.nb-seg > button{min-height:32px;padding:0 14px;border:0;border-radius:var(--nb-r-in);background:transparent;
  color:${T.text3};cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;letter-spacing:0;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-seg > button:hover{color:${T.text};background:color-mix(in srgb,${T.text} 6%, transparent)}
.nb-seg > button[aria-selected=true]{background:${T.card};color:${T.text};box-shadow:var(--nb-shadow)}

.nb-field{display:flex;align-items:center;gap:9px;height:38px;padding:0 12px;border-radius:var(--nb-r-el);
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
.nb-body > .nb-col{background:var(--nb-panel);border:1px solid var(--nb-edge);
  border-radius:var(--nb-r-panel);overflow:hidden}
.nb-rail{flex:0 0 var(--nb-rail)}
.nb-rail[data-drop="true"]{outline:2px dashed ${T.accent};outline-offset:-6px;border-radius:var(--nb-r-panel)}
.nb-main-col{flex:1 1 auto}
.nb-studio{flex:0 0 var(--nb-studio)}
.nb-fade{position:absolute;left:0;right:0;bottom:0;height:30px;pointer-events:none;
  background:linear-gradient(to top, color-mix(in srgb, ${T.text} 6%, ${T.card}), transparent)}
.nb-pane-head{display:flex;align-items:center;gap:8px;height:52px;flex:0 0 52px;padding:0 18px}
.nb-pane-title{font-size:15px;font-weight:650;letter-spacing:-.01em;color:${T.text}}
.nb-pane-head .nb-meta{flex:1}
.nb-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,${T.text} 22%,transparent) transparent}
.nb-root ::selection{background:color-mix(in srgb,${T.accent} 32%,transparent)}
.nb-pad{padding:12px 14px}

/* ------------------------------------------------------------------- rail */
/* the assistant's mark in a message row; the rail's notebook switcher card is
   gone, so this is the only avatar the surface still draws */
.nb-avatar{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;
  border-radius:var(--nb-r-el);background:var(--nb-wash-2);color:${T.text2};
  font-size:13px;font-weight:700}

/* ---- the rail is three zones, not eight stacked boxes ---------------------
   header (title + add + tools) · one filter bar · the source list. The old
   panel stacked a notebook switcher card, a dashed Add button, a web-search
   box, a second search field, wrapped tag pills, a triply-nested checkbox tree
   and a decorative footer pill — about 380px of chrome above a 120px slit of
   actual sources. Everything that is not the list now lives behind the header
   (Add opens the one dialog that can take a URL, a file, pasted text or a web
   search) or in the single filter bar. */
.nb-rail-head{display:flex;align-items:center;gap:var(--nb-sp-2);min-height:52px;
  flex:0 0 52px;padding:0 var(--nb-sp-2) 0 var(--nb-sp-5);border-bottom:1px solid var(--nb-hair-soft)}
.nb-rail-title{font-size:var(--nb-fs-ui);font-weight:650;letter-spacing:-.01em;color:${T.text};
  display:flex;align-items:baseline;gap:var(--nb-sp-2);min-width:0}
.nb-rail-count{font-size:var(--nb-fs-meta);font-weight:600;color:${T.text3};
  font-variant-numeric:tabular-nums;white-space:nowrap}
.nb-rail-tools{display:flex;align-items:center;gap:1px;margin-left:auto}
/* one filter bar: a search field and one horizontally scrolling tag row */
.nb-rail-filter{padding:var(--nb-sp-3) var(--nb-sp-4) var(--nb-sp-3);display:flex;
  flex-direction:column;gap:var(--nb-sp-2);flex:0 0 auto}
.nb-tagrow{display:flex;align-items:center;gap:var(--nb-sp-2);flex-wrap:nowrap;
  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding-bottom:1px;
  min-height:24px}
.nb-tagrow::-webkit-scrollbar{display:none}
.nb-tagrow .nb-chip{flex:0 0 auto}
.nb-tagrow-empty{font-size:var(--nb-fs-meta);color:${T.text4};white-space:nowrap}
.nb-rail-list{flex:1;min-height:0;display:flex;flex-direction:column}
/* the source list itself: one flat card per source, checkbox on the left */
.nb-src-list{display:flex;flex-direction:column;gap:2px;padding:0 var(--nb-sp-3) var(--nb-sp-4)}
.nb-src{display:flex;align-items:center;gap:2px;width:100%;border-radius:var(--nb-r-el);
  padding:3px 4px;position:relative;transition:background var(--nb-dur-fast) var(--nb-ease)}
.nb-src:hover{background:var(--nb-wash-2)}
.nb-src[data-off=true]{opacity:.5}
.nb-src[data-on=true]{background:color-mix(in srgb,${T.accent} 9%, transparent)}
.nb-src-open{flex:1;min-width:0;display:flex;align-items:center;gap:var(--nb-sp-3);
  text-align:left;background:transparent;border:0;padding:5px 4px;border-radius:var(--nb-r-el);
  color:${T.text};cursor:pointer;font-family:inherit}
.nb-src-ico{position:relative;width:30px;height:30px;border-radius:var(--nb-r-in);display:grid;place-items:center;
  background:var(--nb-wash-2);color:${T.text2};flex:0 0 auto}
.nb-src[data-on=true] .nb-src-ico{background:color-mix(in srgb,${T.accent} 16%, transparent);
  color:color-mix(in srgb,${T.accent} 70%, ${T.text})}
/* the citation number rides the icon's corner, like a source badge */
.nb-cite{position:absolute;right:-5px;bottom:-5px;min-width:17px;height:17px;padding:0 4px;
  border-radius:var(--nb-r-pill);display:grid;place-items:center;background:${T.accent};
  /* The host's accent family is always a mid-to-bright hue in both themes
     (light default #B8860B measures 5.92:1 against near-black and 3.25:1
     against white; dark default #FFBF00 measures 11.65:1 / 1.65:1). Near-black
     ink is therefore the one that clears AA on the accent fill in EVERY skin —
     flipping the ink with color-scheme is what broke the light skin. */
  color:#0d0e15;
  font-size:10.5px;font-weight:700;
  box-shadow:0 1px 4px rgba(8,10,18,.4)}
.nb-src-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
/* Two lines, always: at 162px of text width a single line identifies nothing
   ("US roadmap targets fusion deployment by mid 203…"). The clamp is stated on
   the row's own title so the select-all label (a plain sentence) keeps its box. */
.nb-src .nb-src-title{font-size:var(--nb-fs-label);font-weight:600;line-height:1.35;color:${T.text};
  overflow:hidden;display:-webkit-box !important;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow-wrap:anywhere}
.nb-src-meta{display:flex;align-items:center;gap:5px;flex-wrap:nowrap;min-width:0;
  overflow:hidden}
.nb-src-meta .nb-chip{flex:0 0 auto}
/* the first chip may shrink; the "+n" stays whole, so rows keep one line */
.nb-src-meta .nb-chip:first-child{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
/* NotebookLM's per-source checkbox: a rounded box on the row's left edge */
.nb-srccheck{width:32px;height:32px;flex:0 0 auto;border-radius:var(--nb-r-in);cursor:pointer;
  border:1.5px solid var(--nb-hair-soft);background:transparent;color:#0d0e15;
  display:grid;place-items:center;padding:0;transition:all var(--nb-dur-fast) var(--nb-ease)}
.nb-srccheck:hover{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}
.nb-srccheck[aria-checked=true]{background:${T.accent};border-color:${T.accent}}
/* "all included" is a filter row over the list, not a checkbox above a tree */
.nb-selall{display:flex;align-items:center;gap:var(--nb-sp-2);padding:0 2px var(--nb-sp-2);
  border-bottom:1px solid var(--nb-hair-soft);margin-bottom:var(--nb-sp-1)}
.nb-selall .nb-src-title{font-size:var(--nb-fs-label);font-weight:600;color:${T.text2}}
/* The master control keeps the row's 32px target and the semantic radius (the
   a11y and design gates both refuse anything else); it is separated from the
   list by its hairline and by a quieter label, not by a different shape. */

.nb-src-flat{display:flex;flex-direction:column;gap:1px}
.nb-src-del{position:absolute;right:var(--nb-sp-1);top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity var(--nb-dur-fast) var(--nb-ease);background:var(--nb-card)}
.nb-src:hover .nb-src-del,.nb-src-del:focus-visible{opacity:1}
/* a topic is a section label, not a control: no checkbox, no fold-in-fold */
.nb-srcgroup{display:flex;align-items:center;gap:6px;width:100%;
  padding:10px var(--nb-sp-3) 4px;border:0;background:transparent;color:${T.text4};
  font-size:var(--nb-fs-meta);font-weight:650;letter-spacing:.02em;text-transform:uppercase;
  font-family:inherit}
/* a fold that folds: the chevron turns, the count rides the right edge */
.nb-srcgroup svg{flex:0 0 auto;opacity:.6;transition:transform var(--nb-dur-fast) var(--nb-ease)}
.nb-srcgroup[aria-expanded=false] svg{transform:rotate(-90deg)}
.nb-srcgroup em{margin-left:auto;font-style:normal;font-weight:600;color:${T.text3};
  font-size:var(--nb-fs-meta);text-transform:none;letter-spacing:0}

/* the "+ Add" control in the rail header is the only add affordance */
.nb-addsrc{height:32px;min-height:32px;padding:0 12px;border-radius:var(--nb-r-pill);
  background:${T.accent};border:1px solid transparent;color:#0d0e15;
  font-size:var(--nb-fs-label);font-weight:650;box-shadow:none;gap:5px}
.nb-addsrc:hover{background:color-mix(in srgb,${T.accent} 88%, ${T.text});border-color:transparent;
  color:#0d0e15}
.nb-paneltog{flex:0 0 48px;display:flex;flex-direction:column;align-items:center;
  gap:10px;padding-top:12px}
.nb-paneltog-btn{display:flex;flex-direction:column;align-items:center;gap:6px;width:44px;
  padding:10px 0 12px;border-radius:var(--nb-r-el);cursor:pointer;font-family:inherit;
  border:1px solid var(--nb-hair-soft);background:var(--nb-wash);color:${T.text3};
  font-size:var(--nb-fs-meta);font-weight:650;letter-spacing:.02em;
  transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease)}
.nb-paneltog-btn span{writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:.08em;
  text-transform:uppercase}
.nb-paneltog-btn:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-paneltog-btn:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
/* chips are soft pills; clickable ones are full 32px targets */
.nb-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:var(--nb-r-pill);
  font-size:11.5px;font-weight:600;letter-spacing:.01em;color:${T.text3};
  background:var(--nb-wash-2);border:1px solid transparent;white-space:nowrap;font-family:inherit}
.nb-chip[data-tone=accent]{color:color-mix(in srgb,${T.accent} 70%, ${T.text});
  background:color-mix(in srgb,${T.accent} 13%, transparent)}
/* Semantic tones are the host's success/warning/danger colours, which are
   tuned for the dark skin. MIXED toward the page's own ink they keep their hue
   and pick up contrast on whichever canvas is actually painted — #3fb950 on a
   near-white card measured 2.41:1 before this. */
.nb-chip[data-tone=ok]{color:color-mix(in srgb,${T.ok} 62%, ${T.text});
  background:color-mix(in srgb,${T.ok} 14%, transparent)}
.nb-chip[data-tone=warn]{color:color-mix(in srgb,${T.warn} 54%, ${T.text});
  background:color-mix(in srgb,${T.warn} 15%, transparent)}
.nb-chip[data-tone=danger]{color:color-mix(in srgb,${T.danger} 62%, ${T.text});
  background:color-mix(in srgb,${T.danger} 14%, transparent)}
.nb-citechip{height:32px;min-height:32px;padding:0 7px 0 9px;border-radius:var(--nb-r-pill);gap:7px;
  background:var(--nb-cite-bg);border-color:transparent;color:var(--nb-cite-ink);
  font-size:12.5px;font-weight:550}
.nb-citechip:hover{border-color:color-mix(in srgb,${T.accent} 50%, transparent)}
.nb-citechip b{font-family:var(--ui-font-mono,ui-monospace,monospace);color:var(--nb-cite-ink);font-weight:750;
  font-size:10.5px;background:color-mix(in srgb,${T.accent} 14%, transparent);border-radius:var(--nb-r-pill);
  padding:3px 7px;flex:0 0 auto}
.nb-citechip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:300px}
.nb-chip[data-click=true]{cursor:pointer;min-height:32px;height:32px;padding:0 13px;font-size:12.5px;
  background:var(--nb-card);border-color:var(--nb-hair)}
.nb-chip[data-click=true]:hover{background:var(--nb-wash-2);color:${T.text};
  border-color:color-mix(in srgb,${T.text} 20%, transparent)}
.nb-chip[data-click=true][aria-pressed=true]{background:color-mix(in srgb,${T.accent} 14%, transparent);
  color:color-mix(in srgb,${T.accent} 70%, ${T.text});border-color:color-mix(in srgb,${T.accent} 45%, transparent)}

/* discover candidates — the "find for me" picker inside the add-source sheet */
.nb-cand-list{display:flex;flex-direction:column;gap:8px;max-height:308px;overflow:auto;padding:2px}
.nb-cand{display:flex;gap:11px;align-items:flex-start;width:100%;text-align:left;
  padding:11px 12px;border-radius:var(--nb-r-el);border:1px solid var(--nb-hair-soft);
  background:var(--nb-card);cursor:pointer;font-family:inherit;color:inherit}
.nb-cand:hover{border-color:color-mix(in srgb,${T.text} 20%, transparent);background:var(--nb-wash-2)}
.nb-cand[data-on=true]{border-color:color-mix(in srgb,${T.accent} 45%, transparent);
  background:color-mix(in srgb,${T.accent} 8%, transparent)}
.nb-cand-check{width:20px;height:20px;flex:0 0 auto;margin-top:2px;border-radius:var(--nb-r-in);
  border:1.5px solid var(--nb-hair);display:grid;place-items:center;color:var(--ui-bg-primary, #0b0c11)}
.nb-cand[data-on=true] .nb-cand-check{background:${T.accent};border-color:${T.accent}}
.nb-cand-title{display:block;font-size:13px;font-weight:600;line-height:1.35;color:${T.text}}
.nb-cand-sub{display:flex;gap:7px;align-items:flex-start;margin-top:5px;font-size:12.5px;
  color:${T.text3};line-height:1.5}
.nb-cand-sub .nb-chip{flex:0 0 auto;margin-top:1px}
.nb-cand-sub > span:last-child{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow:hidden;min-width:0}

/* ------------------------------------------------------- title block (main)
   One compact header instead of a hero + a tab row + a second meta row. The
   notebook's title lives in the breadcrumb (the app bar already shows it), so
   the centre pane starts with a 44px strip: sigil, title, one meta line, the
   grounded chip, and the view tabs on the same baseline. That is ~180px of
   reading height that the old stacked block spent on nothing. */
.nb-main-head{padding:0 var(--nb-sp-6);border-bottom:1px solid var(--nb-hair-soft);
  flex:0 0 auto;position:relative;display:flex;flex-direction:column;min-width:0}
.nb-head-top{display:flex;align-items:center;gap:var(--nb-sp-3);min-height:52px;padding:var(--nb-sp-2) 0 0;
  min-width:0}
/* the view switcher's own row — the title keeps the width it needs */
.nb-tabs-row{display:flex;align-items:center;gap:var(--nb-sp-3);padding:var(--nb-sp-2) 0 8px;min-width:0}
.nb-head-sigil{width:34px;height:34px;flex:0 0 auto;display:grid;place-items:center;font-size:20px;
  border-radius:var(--nb-r-in);background:var(--nb-wash-2);border:1px solid var(--nb-hair-soft);
  overflow:hidden}
.nb-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
.nb-h1{font-size:var(--nb-fs-title);font-weight:650;letter-spacing:-.015em;line-height:1.25;margin:0;
  overflow:hidden;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  overflow-wrap:anywhere}
.nb-sub{color:${T.text3};font-size:var(--nb-fs-meta);line-height:1.4;margin:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:100%}
.nb-hero-side{display:flex;align-items:center;gap:var(--nb-sp-2);flex:0 0 auto}
/* ops host-measurement strip (Lab Ops only) */
.nb-strip{display:flex;align-items:stretch;gap:8px;margin:14px 0 0;flex-wrap:wrap}
.nb-cell{flex:1;min-width:90px;padding:10px 14px 11px;border-radius:var(--nb-r-el);
  border:1px solid var(--nb-hair-soft);background:var(--nb-wash)}
.nb-cell b{display:block;font-size:17px;font-weight:650;letter-spacing:-.02em;
  line-height:1.1;font-variant-numeric:tabular-nums}
.nb-cell span{display:block;font-size:11.5px;color:${T.text3};margin-top:6px;font-weight:600}
/* the view switcher: one pill track on the header line, never a second row.
   Long artifact titles truncate instead of pushing the track into overflow. */
.nb-tabs{display:inline-flex;align-items:center;gap:2px;padding:3px;flex:0 1 auto;
  min-width:0;max-width:100%;overflow:hidden;border-radius:var(--nb-r-el);
  border:1px solid var(--nb-hair-soft);background:var(--nb-wash)}
.nb-tab{min-height:32px;padding:0 11px;border:0;border-radius:var(--nb-r-in);background:transparent;
  color:${T.text2};font-size:var(--nb-fs-label);font-weight:600;cursor:pointer;
  display:inline-flex;align-items:center;gap:6px;letter-spacing:0;min-width:0;
  font-family:inherit;transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease)}
.nb-tab > span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}
.nb-tab:hover{color:${T.text};background:var(--nb-wash-2)}
.nb-tab[aria-selected=true]{color:${T.text};background:var(--nb-card);box-shadow:var(--nb-shadow)}
.nb-tab[disabled]{opacity:.45;cursor:default}

/* ------------------------------------------------------------------- chat */
.nb-chat{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-chatscroll{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.nb-hl{background:color-mix(in srgb, ${T.accent} 30%, transparent);color:inherit;border-radius:var(--nb-r-in);padding:0 2px}
.nb-latest{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:20;display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:var(--nb-r-pill);border:1px solid var(--nb-line,#2a2d3d);background:var(--nb-card,#14161f);color:var(--nb-text2,#c6c9d8);font-size:12.5px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35);transition:transform var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-latest:hover{transform:translateX(-50%) translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.45)}
/* 96px of tail: the composer and the floating zoom pill sit over this column, and a
   last bubble padded only 12px reads as clipped text at the bottom edge */
.nb-thread{flex:1;min-height:0;overflow:auto;padding:28px 28px 96px;display:flex;flex-direction:column;gap:24px}
.nb-msg{max-width:72ch;animation:nb-msg-in var(--nb-dur-fast) var(--nb-ease) both}
@keyframes nb-msg-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
/* generative marks breathe — a slow 1.5% drift so sigils feel alive, not pasted */
.nb-nbcard-emoji svg,.nb-nbcard-emoji svg{animation:nb-sigil-float 9s ease-in-out infinite}
@keyframes nb-sigil-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-2px) rotate(1.2deg)}}
/* home cards arrive in a stagger — the directory assembles itself */
.nb-nbcard-wrap{animation:nb-card-in var(--nb-dur-med) var(--nb-ease) both}
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
  .nb-msg,.nb-nbcard-wrap,.nb-nbcard-emoji svg,.nb-blob,.nb-sigil-draw{animation:none!important}
  .nb-sigil-draw path{stroke-dashoffset:0!important}
  .nb-sigil-draw circle{opacity:1!important;transform:none!important}
}
.nb-msg[data-role=assistant]{display:grid;grid-template-columns:30px minmax(0,1fr);gap:14px;align-self:flex-start}
.nb-msg[data-role=user]{align-self:flex-end;max-width:62ch}
.nb-msg-body{min-width:0}
.nb-msg[data-role=user] .nb-bubble{background:var(--nb-wash-2);border:1px solid var(--nb-hair-soft);
  border-radius:var(--nb-r-box);padding:11px 17px;font-size:15px;line-height:1.55;color:${T.text}}
.nb-msg[data-role=assistant] .nb-bubble{font-size:16px;line-height:1.66;color:${T.text}}
.nb-msg[data-role=assistant] .nb-avatar{width:30px;height:30px;margin-top:2px}
.nb-msg .nb-avatar{width:30px;height:30px;border-radius:var(--nb-r-pill);
  background:color-mix(in srgb,${T.accent} 16%, transparent);color:color-mix(in srgb,${T.accent} 70%, ${T.text});font-size:11.5px;letter-spacing:.02em}
.nb-who{font-size:11.5px;letter-spacing:.02em;color:${T.text3};font-weight:600;margin-bottom:8px}
.nb-msg[data-role=user] .nb-who{color:${T.text4}}
.nb-md p{margin:0 0 11px}
.nb-md p:last-child{margin-bottom:0}
.nb-md h2{font-size:17px;margin:20px 0 8px;letter-spacing:-.015em}
.nb-md h3{font-size:15px;margin:16px 0 6px;color:${T.text2};font-weight:700}
.nb-md ul{margin:0 0 11px;padding-left:20px}
.nb-md li{margin:5px 0}
.nb-md li::marker{color:color-mix(in srgb,${T.accent} 70%, ${T.text})}
.nb-md code{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:12.5px;
  background:var(--nb-wash-2);padding:1.5px 6px;border-radius:var(--nb-r-in)}
.nb-md strong{font-weight:650;color:${T.text}}
.nb-md blockquote{margin:12px 0;padding:10px 16px;border-radius:var(--nb-r-el);color:${T.text2};
  background:var(--nb-wash);border-left:3px solid color-mix(in srgb,${T.accent} 55%, transparent)}
/* inline citations are quiet accent pills with the source number */
.nb-inline-cite{display:inline-flex;align-items:center;min-height:22px;padding:0 9px;margin:0 3px;
  border-radius:var(--nb-r-pill);border:1px solid transparent;
  background:var(--nb-cite-bg);
  font-size:var(--nb-fs-meta);font-weight:650;letter-spacing:.01em;
  color:var(--nb-cite-ink);
  color:color-mix(in srgb,${T.accent} 70%, ${T.text});cursor:pointer;vertical-align:1px;line-height:1}
.nb-inline-cite:hover{background:color-mix(in srgb,${T.accent} 20%, transparent)}
.nb-composer{flex:0 0 auto;padding:14px 30px 20px}
.nb-askbox{display:flex;flex-direction:column;gap:10px;border:1px solid var(--nb-hair);
  border-radius:var(--nb-r-panel);background:var(--nb-card);padding:14px 16px;box-shadow:var(--nb-shadow);
  transition:border-color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-askbox:focus-within{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  box-shadow:0 0 0 4px color-mix(in srgb,${T.accent} 15%, transparent), var(--nb-shadow)}
.nb-askbox textarea{width:100%;min-height:44px;max-height:150px;resize:none;border:0;outline:0;
  background:transparent;color:${T.text};font-size:15px;line-height:1.5;font-family:inherit}
.nb-askbox textarea::placeholder{color:${T.text3}}
.nb-askfoot{display:flex;align-items:center;gap:8px;min-width:0}
/* the keyboard hint yields before the Send button does: it was pushing the
   button out of the column at 1330px, so the primary action sat half-clipped
   at the panel edge */
.nb-thrchip{min-width:0;max-width:min(210px,38%);overflow:hidden;flex:0 1 auto;min-height:32px}
.nb-thrchip > span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nb-askfoot > .nb-hint{min-width:0;flex:1 1 0;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.nb-sendbtn{width:38px;height:38px;flex:0 0 auto;border-radius:var(--nb-r-pill);border:0;cursor:pointer;
  background:${T.accent};color:#0d0e15;display:grid;place-items:center;padding:0;
  transition:opacity var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-sendbtn:hover{transform:scale(1.05)}
.nb-sendbtn[disabled]{opacity:.4;cursor:not-allowed;transform:none}
.nb-disclaimer{font-size:11.5px;color:${T.text3};text-align:center;margin-top:9px}

/* ------------------------------------------------- overview + suggestions */
.nb-overview{border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-box);background:var(--nb-card);
  padding:18px 20px;display:grid;gap:10px}
.nb-overview-head{display:flex;align-items:center;gap:8px}
.nb-overview-head .nb-meta{flex:1}
.nb-overview-body{font-size:14px;line-height:1.66;color:${T.text2}}
.nb-overview-body .nb-md strong{color:${T.text}}
.nb-suggest-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.nb-suggest{display:flex;flex-direction:column;justify-content:space-between;gap:10px;
  min-height:104px;text-align:left;padding:14px;border-radius:var(--nb-r-box);cursor:pointer;
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
  padding:10px 12px;border-radius:var(--nb-r-el);cursor:pointer;font-family:inherit;
  border:1px solid transparent;background:transparent;color:${T.text}}
.nb-thrrow:hover{background:var(--nb-wash)}
.nb-thrrow.is-current{border-color:color-mix(in srgb,${T.accent} 40%, transparent);
  background:color-mix(in srgb,${T.accent} 8%, transparent)}
.nb-thrwrap{display:flex;align-items:center;gap:4px}
.nb-thrwrap .nb-thrrow{flex:1;min-width:0}
.nb-thrwrap .nb-icon{opacity:0;transition:opacity var(--nb-dur-fast) var(--nb-ease)}
.nb-thrwrap:hover .nb-icon,.nb-thrwrap:focus-within .nb-icon{opacity:1}
.nb-emgrid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.nb-em{aspect-ratio:1;border-radius:var(--nb-r-in);border:1px solid var(--nb-hair-soft);
  background:var(--nb-card);font-size:17px;cursor:pointer;display:grid;place-items:center;
  transition:border-color var(--nb-dur-fast) var(--nb-ease),background var(--nb-dur-fast) var(--nb-ease)}
.nb-em:hover{border-color:color-mix(in srgb,${T.accent} 45%, transparent)}
.nb-em.is-on{border-color:color-mix(in srgb,${T.accent} 70%, ${T.text});background:color-mix(in srgb,${T.accent} 12%, transparent)}

/* -------------------------------------------------- studio (the workbench)
   The right panel is where things get made, so it is organised by what it makes
   — listen & watch, read, study, visualise — instead of one flat 2-col grid of
   thirteen equals. Each family folds (a crowded bench is unworkable), each pill
   says what it produces and what state its last run is in, and the run list
   underneath is the record of what was actually produced. */
.nb-studio-head{gap:10px;padding-bottom:10px}
.nb-studio-head .nb-chip{margin-left:2px}
.nb-studio-head .nb-icon:last-child{margin-left:auto}
.nb-studio-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:var(--nb-sp-4);
  overflow:auto;overscroll-behavior:contain;
  /* The last card used to end flush against the status bar: a cut card at the
     panel edge reads as a rendering fault, not as "scroll for more". A real
     bottom gutter gives the bench a visible end. */
  padding:var(--nb-sp-4) var(--nb-sp-4) var(--nb-sp-6);
  /* A card sliced by the panel's bottom edge reads as a rendering fault. The
     fade says "there is more below" while the panel is scrolled, and because
     the bottom gutter is deeper than the fade, it disappears at the end of the
     list instead of dimming the last card. */
  -webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 18px),transparent);
  mask-image:linear-gradient(to bottom,#000 calc(100% - 18px),transparent);
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,${T.text} 22%,transparent) transparent}
.nb-studio-sec{display:flex;flex-direction:column;gap:var(--nb-sp-2)}
.nb-studio-sec-head{display:flex;align-items:center;gap:var(--nb-sp-2);min-height:32px}
.nb-studio-sec-head .nb-meta{color:${T.text2}}

/* a family header: icon + name + "n of m ready" + fold chevron */
.nb-group{display:flex;flex-direction:column;gap:var(--nb-sp-2)}
.nb-group-head{display:flex;align-items:center;gap:var(--nb-sp-2);width:100%;
  scroll-margin-top:var(--nb-sp-4);
  min-height:32px;padding:0 var(--nb-sp-2);border:0;border-radius:var(--nb-r-in);
  background:transparent;cursor:pointer;color:${T.text3};font-family:inherit;
  font-size:var(--nb-fs-label);font-weight:650;letter-spacing:.01em;
  transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease)}
.nb-group-head:hover{background:var(--nb-wash-2);color:${T.text}}
.nb-group-head:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
.nb-group-head svg{opacity:.7;flex:0 0 auto}
.nb-group-name{flex:0 0 auto}
.nb-group-count{margin-left:auto;font-size:var(--nb-fs-meta);font-weight:600;
  color:${T.text3};font-variant-numeric:tabular-nums}
.nb-group-head[aria-expanded=true] .nb-group-count{color:${T.text2}}
.nb-group-chev{display:grid;place-items:center;opacity:.55;
  transition:transform var(--nb-dur-fast) var(--nb-ease)}
.nb-group-head[aria-expanded=false] .nb-group-chev{transform:rotate(-90deg)}

/* The output list: ONE per row, tinted by its kind.
   Two-up cards in a 320–420px drawer left ~190px per card, so every blurb
   wrapped to three lines, the timestamp dotted beside it, and the whole bench
   read as a wall of equal-weight boxes. One row per output gives the name room,
   keeps the state on the same line, and reads like a studio list should. */
/* The Studio bench, 2-up like NotebookLM's: a 40px pastel badge, the name, a
   one-line promise, and the state of the last run. Two columns of ~150px tiles
   fit a 320-420px drawer; below 300px of drawer the container query drops to a
   single column instead of squeezing. */
.nb-studio{container-type:inline-size}
.nb-gen-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;
  padding:0 0 var(--nb-sp-2)}
@container (max-width: 300px){ .nb-gen-grid{grid-template-columns:minmax(0,1fr)} }
/* a family with an odd count leaves its last tile at half width, like every
   other grid: spanning the row made that one output look like a special case */

.nb-card{--kc:${T.accent};
  display:flex;align-items:flex-start;gap:10px;width:100%;min-width:0;
  min-height:92px;padding:13px 13px 12px;
  border:1px solid var(--nb-edge);border-radius:var(--nb-r-el);
  background:var(--nb-tile);cursor:pointer;text-align:left;color:${T.text};
  transition:background var(--nb-dur-fast) var(--nb-ease),border-color var(--nb-dur-fast) var(--nb-ease),
    transform var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease)}
.nb-card:hover{background:var(--nb-tile-hi);border-color:color-mix(in srgb,var(--kc) 40%, var(--nb-hair));
  transform:translateY(-1px);
  box-shadow:0 8px 26px -12px color-mix(in srgb,var(--kc) 42%, transparent)}
.nb-card:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
.nb-card[data-ready=true]{border-color:color-mix(in srgb,var(--kc) 26%, var(--nb-hair-soft))}
.nb-card[data-busy=true]{border-color:color-mix(in srgb,var(--kc) 48%, transparent);
  background:color-mix(in srgb,var(--kc) 6%, var(--nb-card))}
/* a 40px pastel badge carries the kind — the colour is the only thing that has
   to be learned, the words stay in ink */
.nb-card-ico{width:40px;height:40px;flex:0 0 auto;border-radius:var(--nb-r-el);display:grid;place-items:center;
  background:color-mix(in srgb,var(--kc) 16%, transparent);color:var(--kc)}
.nb-card-ico svg{width:19px;height:19px}
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
.nb-card[data-kind=data_table],.nb-art[data-kind=data_table]{--kc:#a8c7fa}
.nb-card-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px;padding-right:18px}
.nb-card-name{display:-webkit-box;font-size:var(--nb-fs-label);font-weight:650;
  letter-spacing:-.005em;line-height:1.25;color:${T.text};
  -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nb-card-name svg{color:var(--kc);flex:0 0 auto}
/* the blurb is what the output actually is — the pill is not just a label */
.nb-card-blurb{display:none}
.nb-card .nb-card-state{flex:0 0 auto;align-self:flex-start;margin-top:3px;padding:0;
  background:transparent !important}
.nb-card{position:relative}
.nb-card-bar{position:absolute;left:8px;right:8px;bottom:3px}
.nb-card-state{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
  font-size:var(--nb-fs-meta);font-weight:600;color:${T.text3};
  padding:2px 7px;border-radius:var(--nb-r-pill)}
.nb-card[data-ready=true] .nb-card-state{color:color-mix(in srgb,${T.ok} 62%, ${T.text});
  background:color-mix(in srgb,${T.ok} 14%, transparent)}
.nb-card[data-busy=true] .nb-card-state{color:color-mix(in srgb,var(--kc) 58%, ${T.text});
  background:color-mix(in srgb,var(--kc) 14%, transparent)}
.nb-dot{width:6px;height:6px;border-radius:50%;background:${T.text4};display:inline-block;flex:0 0 auto}
.nb-card[data-ready=true] .nb-dot{background:${T.ok}}
.nb-card[data-busy=true] .nb-dot{background:var(--kc);animation:nb-pulse 1.2s ease-in-out infinite}
.nb-bar-track{height:3px;margin-top:3px;background:var(--nb-wash-2);border-radius:var(--nb-r-pill);
  overflow:hidden;display:block;flex:1;max-width:100%}
.nb-bar-fill{height:100%;background:var(--kc);border-radius:var(--nb-r-pill);
  transition:width var(--nb-dur-med) var(--nb-ease)}
@keyframes nb-pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* the run list: a record of real files, newest first */
.nb-studio-runs{padding-top:var(--nb-sp-3);border-top:1px solid var(--nb-hair-soft)}
.nb-studio-filters{padding:0 0 var(--nb-sp-2)}
.nb-artlist{display:flex;flex-direction:column;gap:2px;padding:0 var(--nb-sp-2) 72px}
.nb-art{display:flex;align-items:center;gap:var(--nb-sp-3);width:100%;text-align:left;
  min-height:52px;padding:var(--nb-sp-2) var(--nb-sp-3);border-radius:var(--nb-r-el);
  border:1px solid transparent;background:transparent;color:${T.text};
  cursor:pointer;font-family:inherit;
  transition:background var(--nb-dur-fast) var(--nb-ease),border-color var(--nb-dur-fast) var(--nb-ease)}
.nb-art:hover{background:var(--nb-wash-2);border-color:var(--nb-hair-soft)}
/* a run that exists reads differently from one that has never been made:
   the left edge carries the "ready" colour and a quiet open arrow appears on
   hover, so the drawer answers "what can I read right now" at a glance */
.nb-art[data-ready=true]{border-left:2px solid color-mix(in srgb,${T.ok} 55%, transparent)}
.nb-art-go{margin-left:auto;display:grid;place-items:center;flex:0 0 auto;width:28px;height:28px;
  border-radius:var(--nb-r-pill);color:color-mix(in srgb,${T.ok} 62%, ${T.text});
  opacity:0;transform:translateX(-3px);
  transition:opacity var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-art:hover .nb-art-go,.nb-art:focus-visible .nb-art-go{opacity:1;transform:none}
.nb-art:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
.nb-art-ico{width:38px;height:38px;flex:0 0 auto;border-radius:var(--nb-r-in);position:relative;overflow:hidden;
  display:grid;place-items:center;
  background:color-mix(in srgb,var(--kc) 13%, transparent);
  color:color-mix(in srgb,var(--kc) 70%, ${T.text});
  border:1px solid color-mix(in srgb,var(--kc) 22%, transparent)}
.nb-art-ico svg{opacity:.92}
.nb-art-main{flex:1;min-width:0}
.nb-art-title{display:block;font-size:var(--nb-fs-ui);font-weight:600;line-height:1.3;color:${T.text};
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-art-sub{display:block;font-size:var(--nb-fs-meta);color:${T.text3};margin-top:1px;
  overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.nb-artrow{position:relative}
.nb-art-del{position:absolute;right:var(--nb-sp-1);top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity var(--nb-dur-fast) var(--nb-ease)}
.nb-artrow:hover .nb-art-del,.nb-art-del:focus-visible{opacity:1}
.nb-artrow:hover .nb-art{padding-right:40px}
.nb-empty-out{display:flex;align-items:flex-start;gap:var(--nb-sp-3);padding:var(--nb-sp-5) var(--nb-sp-3);
  color:${T.text3};font-size:var(--nb-fs-label);line-height:1.5}
.nb-empty-out svg{flex:0 0 auto;opacity:.6;margin-top:1px}
/* thumb content inside the artifact icon tile */
.nb-art-ico .nb-thumb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nb-art-ico .nb-thumb-wave{display:flex;align-items:center;gap:1.5px;height:70%;width:80%}
.nb-art-ico .nb-thumb-wave i{flex:1 1 0;min-width:1.5px;border-radius:var(--nb-r-pill);background:var(--kc);opacity:.8}

/* ----------------------------------------------------------------- viewer
   The viewer owns exactly ONE toolbar. The surface tab already names the kind,
   so the strip under it is a 44px line of category badge + human metadata +
   icon actions — there is no second title, no file-size telemetry dump, and no
   generated-at timestamp as a heading. */
.nb-view{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-view-head{display:flex;align-items:center;gap:var(--nb-sp-3);min-height:44px;
  padding:var(--nb-sp-1) var(--nb-sp-5);border-bottom:1px solid var(--nb-hair-soft);
  flex:0 0 auto;background:var(--nb-wash)}
.nb-view-title{font-size:var(--nb-fs-ui);font-weight:600;letter-spacing:-.005em;color:${T.text};
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nb-view-sub{font-size:var(--nb-fs-meta);color:${T.text3};line-height:1.45;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.nb-view-acts{display:flex;align-items:center;gap:2px;flex:0 0 auto;margin-left:auto}
.nb-view-acts .nb-icon{width:32px;height:32px;min-height:32px}
.nb-view-body{flex:1;min-height:0;overflow:auto;padding:var(--nb-sp-6) var(--nb-sp-6) var(--nb-sp-7)}
.nb-doc{max-width:70ch;font-size:15px;line-height:1.68}
/* the artifact's own markdown title is a duplicate of the toolbar title: demote it
   rather than print the same sentence twice in one viewport */
.nb-doc h1{font-size:19px;line-height:1.25;letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance;
  color:${T.text};font-weight:650}
.nb-doc em{color:${T.text2}}
.nb-doc hr{border:0;border-top:1px solid var(--nb-hair-soft);margin:22px 0}
.nb-doc h2{font-size:19px;margin:26px 0 10px;letter-spacing:-.02em}
.nb-doc h2:first-child{margin-top:0}
.nb-doc h3{font-size:15px;margin:20px 0 6px;color:${T.text2};font-weight:700}
.nb-doc ul,.nb-doc ol{padding-left:22px;margin:0 0 12px}
.nb-doc li{margin:5px 0}
.nb-doc table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px;margin:14px 0;
  border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-el);overflow:hidden}
.nb-doc th,.nb-doc td{border-bottom:1px solid var(--nb-hair-soft);padding:9px 12px;text-align:left}
.nb-doc td+td,.nb-doc th+th{border-left:1px solid var(--nb-hair-soft)}
.nb-doc tr:last-child td{border-bottom:0}
.nb-doc th{background:var(--nb-wash-2);font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;
  font-weight:700;color:${T.text2}}
.nb-doc pre{background:var(--nb-wash);border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-el);
  padding:14px;overflow:auto;font-size:13px}

/* ------------------------------------------------------- document surfaces
   Summary and Briefing Doc are documents, not chat replies: a BLUF banner, a
   KPI strip, then sections. FAQ is an accordion grouped by tier. Study Guide is
   concept cards plus trap alerts. All of it is built from the generated
   markdown, so an older artifact without the skeleton still renders as prose. */
.nb-docdoc{max-width:88ch;display:flex;flex-direction:column;gap:var(--nb-sp-6)}
.nb-doc-lede{max-width:74ch}
.nb-doc-sec{display:flex;flex-direction:column;gap:var(--nb-sp-3)}
.nb-doc-h2{font-size:19px;letter-spacing:-.02em;margin:0;color:${T.text};font-weight:680;line-height:1.25}
.nb-bluf{display:flex;align-items:flex-start;gap:var(--nb-sp-3);padding:var(--nb-sp-5);
  border-radius:var(--nb-r-box);
  border:1px solid color-mix(in srgb,${T.accent} 30%, transparent);
  background:linear-gradient(135deg, color-mix(in srgb,${T.accent} 14%, var(--nb-card)), var(--nb-card) 72%)}
.nb-bluf svg{flex:0 0 auto;margin-top:2px;color:color-mix(in srgb,${T.accent} 78%, ${T.text})}
.nb-bluf-body{display:flex;flex-direction:column;gap:var(--nb-sp-2);min-width:0}
.nb-bluf-tag{font-size:var(--nb-fs-meta);font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:color-mix(in srgb,${T.accent} 72%, ${T.text})}
.nb-bluf-text{font-size:var(--nb-fs-read);line-height:1.62;color:${T.text};max-width:74ch}
.nb-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--nb-sp-3)}
.nb-kpi{display:flex;flex-direction:column;gap:3px;padding:var(--nb-sp-4) var(--nb-sp-5);
  border-radius:var(--nb-r-el);border:1px solid var(--nb-hair-soft);background:var(--nb-card);min-width:0}
.nb-kpi-value{font-size:26px;font-weight:720;letter-spacing:-.028em;line-height:1.1;
  color:${T.text};font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.nb-kpi-label{font-size:var(--nb-fs-label);color:${T.text2};line-height:1.4;font-weight:600}
.nb-kpi-ctx{font-size:var(--nb-fs-meta);color:${T.text3};line-height:1.45}
.nb-kpi-src{font-size:var(--nb-fs-meta);margin-top:2px}
/* a RAG badge sits in the text flow but reads as a status, not a word */
.nb-rag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:var(--nb-r-pill);
  font-size:var(--nb-fs-meta);font-weight:700;letter-spacing:.07em;text-transform:uppercase;flex:0 0 auto}
.nb-rag[data-tone=danger]{color:color-mix(in srgb,${T.danger} 58%, ${T.text});
  background:color-mix(in srgb,${T.danger} 15%, transparent)}
.nb-rag[data-tone=warn]{color:color-mix(in srgb,${T.warn} 52%, ${T.text});
  background:color-mix(in srgb,${T.warn} 16%, transparent)}
.nb-rag[data-tone=ok]{color:color-mix(in srgb,${T.ok} 58%, ${T.text});
  background:color-mix(in srgb,${T.ok} 15%, transparent)}
.nb-rag[data-tone=accent]{color:color-mix(in srgb,${T.accent} 72%, ${T.text});
  background:color-mix(in srgb,${T.accent} 13%, transparent)}
.nb-risks{display:flex;flex-direction:column;gap:var(--nb-sp-2)}
.nb-risk{display:flex;align-items:flex-start;gap:var(--nb-sp-3);padding:var(--nb-sp-4);
  border-radius:var(--nb-r-el);border:1px solid var(--nb-hair-soft);background:var(--nb-card)}
.nb-risk-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.nb-risk-head{font-size:var(--nb-fs-read);line-height:1.5;color:${T.text}}
.nb-risk-rest{font-size:var(--nb-fs-label);line-height:1.55;color:${T.text2}}

/* faq accordion: one tier at a time, verdict first, caveat last */
.nb-faq{display:flex;flex-direction:column;gap:var(--nb-sp-6);max-width:80ch}
.nb-faq-bar{display:flex;align-items:center;gap:var(--nb-sp-2);flex-wrap:wrap}
.nb-faq-tier{display:flex;flex-direction:column;gap:var(--nb-sp-2)}
.nb-faq-tierhead{display:flex;align-items:center;gap:var(--nb-sp-2);padding-bottom:var(--nb-sp-2);
  border-bottom:1px solid var(--nb-hair-soft);font-size:var(--nb-fs-label);font-weight:650;
  color:${T.text2};text-transform:uppercase;letter-spacing:.06em}
.nb-faq-tierhead svg{opacity:.8}
.nb-faq-tierhead .nb-meta{margin-left:auto;text-transform:none;letter-spacing:0}
.nb-faq-item{border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-el);background:var(--nb-card);
  overflow:hidden;transition:border-color var(--nb-dur-fast) var(--nb-ease)}
.nb-faq-item[data-open=true]{border-color:color-mix(in srgb,${T.accent} 34%, var(--nb-hair))}
.nb-faq-q{display:flex;align-items:flex-start;gap:var(--nb-sp-3);width:100%;min-height:44px;
  padding:var(--nb-sp-4) var(--nb-sp-5);border:0;background:transparent;color:${T.text};
  font-family:inherit;font-size:var(--nb-fs-read);font-weight:600;line-height:1.45;
  text-align:left;cursor:pointer}
.nb-faq-q:focus-visible{outline:2px solid ${T.accent};outline-offset:-2px}
.nb-faq-marker{flex:0 0 auto;width:18px;color:color-mix(in srgb,${T.accent} 72%, ${T.text});
  font-weight:700;font-family:var(--ui-font-mono,ui-monospace,monospace)}
.nb-faq-qt{min-width:0}
.nb-faq-a{display:flex;flex-direction:column;gap:var(--nb-sp-3);padding:0 var(--nb-sp-5) var(--nb-sp-5)
  var(--nb-sp-5)}
.nb-verdict{align-self:flex-start;display:inline-flex;align-items:center;min-height:26px;
  padding:3px 10px;border-radius:var(--nb-r-pill);font-size:var(--nb-fs-label);font-weight:650;
  line-height:1.4;max-width:100%}
.nb-verdict[data-tone=ok]{color:color-mix(in srgb,${T.ok} 55%, ${T.text});
  background:color-mix(in srgb,${T.ok} 14%, transparent)}
.nb-verdict[data-tone=danger]{color:color-mix(in srgb,${T.danger} 55%, ${T.text});
  background:color-mix(in srgb,${T.danger} 14%, transparent)}
.nb-verdict[data-tone=accent]{color:color-mix(in srgb,${T.accent} 72%, ${T.text});
  background:color-mix(in srgb,${T.accent} 13%, transparent)}
.nb-caveat{display:flex;align-items:flex-start;gap:6px;font-size:var(--nb-fs-label);line-height:1.5;
  color:${T.text3};padding-top:var(--nb-sp-2);border-top:1px solid var(--nb-hair-soft)}
.nb-caveat svg{flex:0 0 auto;margin-top:2px;opacity:.8}

/* study guide: concept cards in a two-column bento, trap alerts as a split */
.nb-studyguide{max-width:92ch;display:flex;flex-direction:column;gap:var(--nb-sp-6)}
.nb-concepts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--nb-sp-3)}
.nb-concept{display:flex;flex-direction:column;gap:var(--nb-sp-2);padding:var(--nb-sp-5);
  border-radius:var(--nb-r-box);border:1px solid var(--nb-hair-soft);background:var(--nb-card);min-width:0}
.nb-concept-term{font-size:var(--nb-fs-title);font-weight:680;letter-spacing:-.012em;color:${T.text};
  line-height:1.3}
.nb-concept-row{display:flex;flex-direction:column;gap:1px}
.nb-concept-lab{font-size:var(--nb-fs-meta);font-weight:650;letter-spacing:.05em;text-transform:uppercase;
  color:${T.text3}}
.nb-concept-val{font-size:var(--nb-fs-label);line-height:1.55;color:${T.text2}}
.nb-concept-src{font-size:var(--nb-fs-meta);padding-top:var(--nb-sp-2);margin-top:auto;
  border-top:1px solid var(--nb-hair-soft)}
.nb-trap{display:grid;grid-template-columns:1fr 1fr;gap:var(--nb-sp-2);border-radius:var(--nb-r-box);
  overflow:hidden;border:1px solid var(--nb-hair-soft)}
.nb-trap-half{display:flex;flex-direction:column;gap:5px;padding:var(--nb-sp-4) var(--nb-sp-5);
  font-size:var(--nb-fs-label);line-height:1.55;color:${T.text2}}
.nb-trap-half[data-side=novice]{background:color-mix(in srgb,${T.warn} 9%, var(--nb-card))}
.nb-trap-half[data-side=actual]{background:color-mix(in srgb,${T.ok} 9%, var(--nb-card))}
.nb-trap-tag{font-size:var(--nb-fs-meta);font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.nb-trap-half[data-side=novice] .nb-trap-tag{color:color-mix(in srgb,${T.warn} 52%, ${T.text})}
.nb-trap-half[data-side=actual] .nb-trap-tag{color:color-mix(in srgb,${T.ok} 52%, ${T.text})}
@media (max-width:860px){.nb-trap{grid-template-columns:1fr}}

/* ------------------------------------------------------------ slide bodies
   One layout per archetype, drawn on the dark slide canvas. These rules are
   scoped to .nb-slide so the presentation surface never inherits a document
   colour: every ink here is set for #0a0b10, not for the app's own paper. */
.nb-slide{display:flex;flex-direction:column;gap:18px;flex:1;min-height:0;
  color:#e9ebf4;overflow:hidden}
/* the archetype name on the element is a label, not a layout: the shared
   .nb-slide grid already stacks the head above the body for all nine */
.nb-slide-gap,.nb-slide-bento,.nb-slide-pipe,.nb-slide-cmp,.nb-slide-tension,
.nb-slide-roadmap{display:flex;flex-direction:column;gap:16px;flex:1;min-height:0}
.nb-slide-gap-head{font-size:clamp(19px,2.1vw,30px);font-weight:680;letter-spacing:-.02em;
  line-height:1.16;color:#f2f3f8;margin:0}
.nb-slide-kicker{font-size:11.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;
  color:#9aa0b5}
.nb-slide-kicker[data-tone=accent]{color:color-mix(in srgb,${T.accent} 62%, #ffffff)}
.nb-slide-kicker[data-tone=ok]{color:#7fe3b0}
.nb-slide-kicker[data-tone=warn]{color:#ffd28a}
.nb-slide-list{margin:0;padding-left:18px;display:grid;gap:9px;font-size:16px;line-height:1.55;
  color:#d6d8e6}
.nb-slide-list li{list-style:disc}
.nb-slide-md{font-size:inherit;line-height:inherit;color:inherit}
.nb-slide-empty{font-size:13px;color:#7d8398;font-style:italic}

/* title_hero */
.nb-slide-hero{justify-content:center;gap:16px}
.nb-slide-hero-t{font-size:clamp(28px,3.4vw,52px);font-weight:700;letter-spacing:-.026em;
  line-height:1.08;color:#ffffff;max-width:24ch}
.nb-slide-hero-sub{font-size:17px;line-height:1.5;color:#b7bccd;max-width:62ch}
.nb-slide-hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.nb-slide-badge{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:99px;
  font-size:12px;font-weight:600;color:#c7ccdb;background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.10)}
.nb-slide-badge[data-tone=accent]{color:#fff;
  background:color-mix(in srgb,${T.accent} 34%, rgba(255,255,255,.06));
  border-color:color-mix(in srgb,${T.accent} 46%, transparent)}

/* executive_bluf */
.nb-slide-bluf{gap:16px}
.nb-slide-bluf-t{font-size:clamp(24px,2.6vw,38px);font-weight:690;letter-spacing:-.024em;
  line-height:1.12;color:#fff;max-width:26ch}
.nb-slide-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.nb-slide-stats[data-count="3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.nb-slide-stats[data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.nb-slide-stat{display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:14px;
  background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);min-width:0}
.nb-slide-stat-v{font-size:clamp(24px,2.4vw,34px);font-weight:730;letter-spacing:-.03em;
  line-height:1.06;color:#fff;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.nb-slide-stat-l{font-size:12.5px;line-height:1.4;color:#a8aec1}
.nb-slide-banner{display:flex;align-items:flex-start;gap:10px;margin-top:auto;padding:14px 16px;
  border-radius:14px;font-size:16px;line-height:1.5;color:#eef0f7;
  background:color-mix(in srgb,${T.accent} 22%, rgba(255,255,255,.05));
  border:1px solid color-mix(in srgb,${T.accent} 38%, transparent)}
.nb-slide-banner svg{flex:0 0 auto;margin-top:2px;color:color-mix(in srgb,${T.accent} 60%, #ffffff)}

/* problem_gap */
.nb-slide-split{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:stretch;flex:1;
  min-height:0}
.nb-slide-half{display:flex;flex-direction:column;gap:10px;padding:16px 18px;border-radius:16px;
  min-width:0;overflow:auto}
.nb-slide-half[data-side=left]{background:rgba(255,255,255,.035);
  border:1px solid rgba(255,255,255,.08)}
.nb-slide-half[data-side=right]{background:color-mix(in srgb,${T.accent} 16%, rgba(255,255,255,.03));
  border:1px solid color-mix(in srgb,${T.accent} 34%, transparent)}
.nb-slide-half[data-side=left] .nb-slide-list{color:#9aa0b5}
.nb-slide-arrow{align-self:center;font-size:22px;color:color-mix(in srgb,${T.accent} 62%, #ffffff)}

/* architecture_bento */
.nb-slide-cards{display:grid;gap:12px;flex:1;min-height:0}
.nb-slide-cards[data-count="1"]{grid-template-columns:1fr}
.nb-slide-cards[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.nb-slide-cards[data-count="3"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.nb-slide-cards[data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr))}
.nb-slide-cards[data-count="5"]{grid-template-columns:repeat(3,minmax(0,1fr))}
.nb-slide-card{display:flex;flex-direction:column;gap:6px;padding:14px 15px;border-radius:14px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);min-width:0;overflow:auto}
.nb-slide-card-h{font-size:15.5px;font-weight:660;line-height:1.3;color:#f2f3f8}
.nb-slide-card-s{font-size:13px;line-height:1.45;color:#a8aec1}

/* process_pipeline */
.nb-slide-stages{display:flex;align-items:stretch;gap:10px;flex:1;min-height:0;flex-wrap:nowrap}
.nb-slide-stage{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px;
  padding:14px 13px;border-radius:14px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.10);position:relative;overflow:auto}
.nb-slide-stage-n{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;
  border-radius:99px;font-size:12px;font-weight:700;color:#fff;
  background:color-mix(in srgb,${T.accent} 46%, transparent)}
.nb-slide-stage-h{font-size:14.5px;font-weight:650;line-height:1.3;color:#f2f3f8}
.nb-slide-stage-s{font-size:12.5px;line-height:1.45;color:#a8aec1}
.nb-slide-chev{align-self:center;flex:0 0 auto;width:0;height:0;margin:0 -4px;
  border-left:7px solid color-mix(in srgb,${T.accent} 45%, transparent);
  border-top:6px solid transparent;border-bottom:6px solid transparent}

/* deep_dive_comparison */
.nb-slide-table{width:100%;border-collapse:collapse;font-size:13.5px;line-height:1.45;
  color:#d6d8e6}
.nb-slide-table th{text-align:left;padding:0 12px 8px;border-bottom:1px solid rgba(255,255,255,.16)}
.nb-slide-table td{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:top}
.nb-slide-rows{display:flex;flex-direction:column;gap:8px;overflow:auto}
.nb-slide-row{display:grid;grid-template-columns:minmax(120px,.9fr) 2fr;gap:12px;
  padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.04)}
.nb-slide-row-h{font-size:13.5px;font-weight:640;color:#f2f3f8}
.nb-slide-row-s{font-size:13px;color:#a8aec1}

/* tension_audit */
.nb-slide-tension-body{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;min-height:0}
.nb-slide-tcol{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;
  min-width:0;overflow:auto}
.nb-slide-tcol[data-side=agree]{background:rgba(127,227,176,.09);border:1px solid rgba(127,227,176,.26)}
.nb-slide-tcol[data-side=conflict]{background:rgba(255,210,138,.09);
  border:1px solid rgba(255,210,138,.26)}

/* roadmap */
.nb-slide-lanes{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;overflow:auto}
.nb-slide-lane{display:grid;grid-template-columns:minmax(96px,.34fr) 1fr;gap:14px;align-items:baseline;
  padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.nb-slide-lane-head{display:flex;flex-direction:column;gap:5px;min-width:0}
.nb-slide-lane-n{font-size:14px;font-weight:660;color:#fff;overflow-wrap:anywhere}
.nb-slide-lane-rule{height:3px;border-radius:2px;background:color-mix(in srgb,${T.accent} 52%, transparent)}
.nb-slide-lane-body{font-size:13.5px;line-height:1.5;color:#a8aec1}

/* closing */
.nb-slide-close{justify-content:center;align-items:flex-start;gap:16px}
.nb-slide-close-t{font-size:clamp(26px,3vw,44px);font-weight:700;letter-spacing:-.026em;
  line-height:1.1;color:#fff;max-width:22ch}
.nb-slide-close-s{font-size:16px;line-height:1.5;color:#b7bccd;max-width:60ch}

/* the notes affordance is a hint, not a control: it says a key exists */
.nb-slide-notes-chip{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;
  font-size:11.5px;color:#7d8398}
.nb-slide-notes-chip svg{opacity:.8}

/* quiz: the verdict, the lesson, and why each distractor looked right */
.nb-quiz-done{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.nb-quiz-verdict{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;
  min-height:24px;padding:2px 9px;border-radius:var(--nb-r-pill);font-size:var(--nb-fs-label);
  font-weight:650}
.nb-quiz-verdict[data-tone=ok]{color:color-mix(in srgb,${T.ok} 56%, ${T.text});
  background:color-mix(in srgb,${T.ok} 14%, transparent)}
.nb-quiz-verdict[data-tone=warn]{color:color-mix(in srgb,${T.warn} 52%, ${T.text});
  background:color-mix(in srgb,${T.warn} 15%, transparent)}
.nb-quiz-explain{font-size:var(--nb-fs-label);line-height:1.55;color:${T.text2}}
.nb-quiz-why{display:flex;flex-direction:column;gap:2px;padding-top:6px;
  border-top:1px solid var(--nb-hair-soft)}
.nb-quiz-why-row{display:grid;grid-template-columns:16px 1fr;gap:8px;padding:6px 8px;
  border-radius:var(--nb-r-el);align-items:start}
.nb-quiz-why-row[data-tone=ok]{background:color-mix(in srgb,${T.ok} 9%, transparent)}
.nb-quiz-why-row[data-tone=warn]{background:color-mix(in srgb,${T.warn} 9%, transparent)}
.nb-quiz-why-mark{font-weight:700;text-align:center;color:${T.text3};font-size:12px;line-height:1.6}
.nb-quiz-why-row[data-tone=ok] .nb-quiz-why-mark{color:color-mix(in srgb,${T.ok} 60%, ${T.text})}
.nb-quiz-why-row[data-tone=warn] .nb-quiz-why-mark{color:color-mix(in srgb,${T.warn} 58%, ${T.text})}
.nb-quiz-why-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nb-quiz-why-choice{font-size:var(--nb-fs-meta);font-weight:640;color:${T.text2}}
.nb-quiz-why-text{font-size:var(--nb-fs-meta);line-height:1.5;color:${T.text3}}
.nb-quiz-src{display:flex;gap:4px;flex-wrap:wrap}

/* flashcard extras: the hook and the citations, on the answer face */
.nb-card-hook{display:flex;align-items:flex-start;gap:6px;margin-top:10px;padding:7px 9px;
  border-radius:var(--nb-r-el);font-size:var(--nb-fs-meta);line-height:1.5;color:${T.text2};
  background:color-mix(in srgb,${T.accent} 10%, transparent)}
.nb-card-hook svg{flex:0 0 auto;margin-top:2px;color:color-mix(in srgb,${T.accent} 70%, ${T.text})}
.nb-card-cites{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}

/* the mind map: a stage with an inspector beside it, on a dark pane */
.nb-map-wrap{display:flex;flex-direction:column;gap:10px}
.nb-map-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.nb-map-legend{display:flex;gap:10px;flex-wrap:wrap}
.nb-map-leg{display:inline-flex;align-items:center;gap:5px;font-size:var(--nb-fs-meta);
  color:${T.text3}}
.nb-map-dot{width:8px;height:8px;border-radius:99px}
.nb-map-dot[data-tone=accent]{background:${T.accent}}
.nb-map-dot[data-tone=accentSoft]{background:color-mix(in srgb,${T.accent} 70%, ${T.text})}
.nb-map-dot[data-tone=warn]{background:${T.warn}}
.nb-map-dot[data-tone=danger]{background:${T.danger}}
.nb-map-dot[data-tone=ok]{background:${T.ok}}
.nb-map-stage{display:grid;grid-template-columns:1fr minmax(0,240px);gap:12px;min-height:420px}
.nb-map{background:var(--nb-wash);border:1px solid var(--nb-hair-soft);
  border-radius:var(--nb-r-box);min-height:420px;touch-action:none}
.nb-map-ins{display:flex;flex-direction:column;gap:8px;padding:14px;
  border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-box);background:var(--nb-card);
  align-self:start;min-width:0}
.nb-map-ins-hint{font-size:var(--nb-fs-label);color:${T.text3};line-height:1.5}
.nb-map-ins-head{display:flex;flex-direction:column;gap:4px}
.nb-map-type{align-self:flex-start;font-size:var(--nb-fs-meta);font-weight:700;
  letter-spacing:.06em;text-transform:uppercase}
.nb-map-type[data-tone=accent]{color:color-mix(in srgb,${T.accent} 72%, ${T.text})}
.nb-map-type[data-tone=accentSoft]{color:color-mix(in srgb,${T.accent} 58%, ${T.text})}
.nb-map-type[data-tone=warn]{color:color-mix(in srgb,${T.warn} 58%, ${T.text})}
.nb-map-type[data-tone=danger]{color:color-mix(in srgb,${T.danger} 58%, ${T.text})}
.nb-map-type[data-tone=ok]{color:color-mix(in srgb,${T.ok} 58%, ${T.text})}
.nb-map-ins-label{font-size:var(--nb-fs-read);font-weight:660;line-height:1.35;color:${T.text}}
.nb-map-ins-stat{font-size:20px;font-weight:700;letter-spacing:-.02em;color:${T.text};
  font-variant-numeric:tabular-nums}
.nb-map-ins-sum{font-size:var(--nb-fs-label);line-height:1.55;color:${T.text2}}
.nb-map-ins-src{display:flex;gap:4px;flex-wrap:wrap;padding-top:6px;
  border-top:1px solid var(--nb-hair-soft)}
@media (max-width:900px){.nb-map-stage{grid-template-columns:1fr}}

/* an export menu, not a row of buttons: each target explains what it is for */
.nb-menu-wrap{position:relative;display:inline-flex}
.nb-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:40;min-width:250px;
  display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:var(--nb-r-box);
  background:var(--nb-card);border:1px solid var(--nb-hair);box-shadow:0 12px 32px rgba(0,0,0,.22)}
.nb-menu-item{display:flex;align-items:flex-start;gap:9px;width:100%;min-height:44px;padding:7px 9px;
  border:0;border-radius:var(--nb-r-el);background:transparent;cursor:pointer;
  font-family:inherit;text-align:left;color:inherit}
.nb-menu-item:hover,.nb-menu-item:focus-visible{background:var(--nb-wash);outline:none}
.nb-menu-item svg{flex:0 0 auto;margin-top:3px;color:color-mix(in srgb,${T.accent} 70%, ${T.text})}
.nb-menu-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nb-menu-label{font-size:var(--nb-fs-label);font-weight:650;color:${T.text}}
.nb-menu-hint{font-size:var(--nb-fs-meta);line-height:1.4;color:${T.text3}}

/* the computed aggregates, beside the table they describe */
.nb-dt-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--nb-sp-2);
  margin-top:var(--nb-sp-4)}
.nb-dt-sum-h{grid-column:1/-1;font-size:var(--nb-fs-meta);font-weight:650;letter-spacing:.05em;
  text-transform:uppercase;color:${T.text3}}
.nb-dt-sum-cell{display:flex;flex-direction:column;gap:1px;padding:var(--nb-sp-3) var(--nb-sp-4);
  border-radius:var(--nb-r-el);border:1px solid var(--nb-hair-soft);background:var(--nb-card)}
.nb-dt-sum-v{font-size:20px;font-weight:700;letter-spacing:-.02em;color:${T.text};
  font-variant-numeric:tabular-nums}
.nb-dt-sum-l{font-size:var(--nb-fs-label);color:${T.text2}}
.nb-dt-sum-b{font-size:var(--nb-fs-meta);color:${T.text3}}

/* the scrubber carries chapter ticks for a timed transcript */
.nb-scrub{position:relative;flex:1;display:flex;align-items:center;min-width:0}
.nb-scrub-marks{position:absolute;left:0;right:0;top:2px;height:6px;pointer-events:none}
.nb-scrub-mark{position:absolute;top:0;width:2px;height:6px;padding:0;border:0;
  border-radius:1px;background:#9aa0b5;opacity:.75;pointer-events:auto;cursor:pointer}
.nb-scrub-mark:hover,.nb-scrub-mark:focus-visible{background:#fff;opacity:1;outline:none}

/* -------------------------------------------------------------- stage/media */
.nb-stage{display:flex;flex-direction:column;gap:16px}
.nb-screen{position:relative;overflow:hidden;border-radius:var(--nb-r-box);border:1px solid var(--nb-hair);
  background:var(--nb-media);aspect-ratio:16/9;display:grid;place-items:center;box-shadow:var(--nb-shadow)}
.nb-screen video,.nb-screen iframe{width:100%;height:100%;border:0;display:block;background:#000}
.nb-screen-audio{aspect-ratio:auto;padding:22px;display:flex;flex-direction:column;gap:16px;
  place-items:stretch;width:100%}
.nb-wave{display:flex;align-items:center;gap:2.5px;height:72px;width:100%}
.nb-wave i{flex:1 1 0;min-width:2px;height:100%;border-radius:var(--nb-r-pill);background:rgba(235,238,245,.42)}
.nb-wave i[data-past=true]{background:${T.accent};opacity:1}
.nb-ctrl{display:flex;align-items:center;gap:10px}
.nb-timeline{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none;position:relative}
.nb-timeline::before{content:'';position:absolute;left:7px;top:10px;bottom:10px;width:2px;
  border-radius:2px;background:var(--nb-hair-soft)}
.nb-tl{display:grid;grid-template-columns:110px 1fr;gap:16px;padding:13px 0 13px 24px;
  border-top:1px solid var(--nb-hair-soft);position:relative}
.nb-tl:first-child{border-top:0}
.nb-tl::before{content:'';position:absolute;left:2px;top:20px;width:11px;height:11px;border-radius:var(--nb-r-pill);
  background:${T.accent};box-shadow:0 0 0 3px color-mix(in srgb,${T.accent} 18%, transparent)}
.nb-tl-when{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:10.5px;font-weight:700;
  color:color-mix(in srgb,${T.accent} 70%, ${T.text});letter-spacing:.06em;text-transform:uppercase;padding-top:3px}
.nb-tl-what{font-size:15px;color:${T.text2}}

/* ---------------------------------------------- timeline artifact (spine)
   A "timeline" that renders as paragraphs is not a timeline. The generated
   markdown is parsed into dated/phase nodes and drawn on a vertical spine: a
   glowing dot per node, a pill for the date or phase, the milestone in a card,
   and [S1] rendered as a real citation chip that opens the source. When the
   material is procedural rather than dated the nodes are phases, not dates —
   the doc says so instead of apologising in prose. */
.nb-spine{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none;
  position:relative;max-width:760px}
.nb-spine::before{content:'';position:absolute;left:9px;top:14px;bottom:14px;width:2px;
  border-radius:var(--nb-r-pill);background:linear-gradient(to bottom,
    color-mix(in srgb,${T.accent} 60%, transparent),
    color-mix(in srgb,${T.accent} 18%, transparent) 70%,
    transparent)}
.nb-node{position:relative;padding:0 0 var(--nb-sp-5) var(--nb-sp-7);display:flex;
  flex-direction:column;gap:var(--nb-sp-2)}
.nb-node:last-child{padding-bottom:0}
.nb-node-dot{position:absolute;left:3px;top:15px;width:14px;height:14px;border-radius:var(--nb-r-pill);
  background:var(--nb-card-deep, #14161f);border:2px solid color-mix(in srgb,${T.accent} 80%, ${T.text});
  box-shadow:0 0 0 4px color-mix(in srgb,${T.accent} 12%, transparent),
              0 0 14px -2px color-mix(in srgb,${T.accent} 55%, transparent)}
.nb-node-when{display:inline-flex;align-items:center;align-self:flex-start;height:22px;
  padding:0 9px;border-radius:var(--nb-r-pill);font-size:var(--nb-fs-meta);font-weight:700;
  letter-spacing:.01em;font-variant-numeric:tabular-nums;
  color:color-mix(in srgb,${T.accent} 74%, ${T.text});
  background:color-mix(in srgb,${T.accent} 13%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 26%, transparent)}
.nb-node-when[data-phase=true]{color:color-mix(in srgb,${T.purple} 66%, ${T.text});
  background:color-mix(in srgb,${T.purple} 15%, transparent);
  border-color:color-mix(in srgb,${T.purple} 30%, transparent)}
.nb-node-card{padding:var(--nb-sp-4) var(--nb-sp-5);border-radius:var(--nb-r-el);
  border:1px solid var(--nb-hair-soft);background:var(--nb-card);
  font-size:var(--nb-fs-read);line-height:1.6;color:${T.text2};
  transition:border-color var(--nb-dur-fast) var(--nb-ease),background var(--nb-dur-fast) var(--nb-ease)}
.nb-node-card:hover{border-color:var(--nb-hair);background:var(--nb-wash)}
.nb-node-card .nb-md p:last-child{margin-bottom:0}
.nb-node-src{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding-top:2px}
/* the canonical row: category badge, headline, what changed, what it unblocked */
.nb-node-cat{display:inline-flex;align-items:center;height:20px;padding:0 8px;margin-bottom:6px;
  border-radius:var(--nb-r-pill);font-size:var(--nb-fs-meta);font-weight:650;letter-spacing:.01em;
  color:${T.text2};background:var(--nb-wash)}
.nb-node-cat[data-tone=ok]{color:color-mix(in srgb,${T.ok} 62%, ${T.text});
  background:color-mix(in srgb,${T.ok} 13%, transparent)}
.nb-node-cat[data-tone=accent]{color:color-mix(in srgb,${T.accent} 72%, ${T.text});
  background:color-mix(in srgb,${T.accent} 13%, transparent)}
.nb-node-cat[data-tone=warn]{color:color-mix(in srgb,${T.warn} 54%, ${T.text});
  background:color-mix(in srgb,${T.warn} 14%, transparent)}
.nb-node-headline{font-size:var(--nb-fs-read);font-weight:650;line-height:1.35;color:${T.text};
  margin-bottom:4px;letter-spacing:-.01em}
.nb-node-what{color:${T.text2};line-height:1.6}
.nb-node-cons{display:flex;align-items:flex-start;gap:6px;margin-top:8px;padding-top:8px;
  border-top:1px solid var(--nb-hair-soft);font-size:var(--nb-fs-label);line-height:1.5;color:${T.text3}}
.nb-node-cons svg{flex:0 0 auto;margin-top:2px;opacity:.8}
.nb-node-note{font-size:var(--nb-fs-meta);color:${T.text3};line-height:1.5;
  padding:var(--nb-sp-2) 0 0 0}
/* the phase preamble: says what kind of timeline this is, once */
.nb-spine-lede{display:flex;align-items:center;gap:var(--nb-sp-2);flex-wrap:wrap;
  margin-bottom:var(--nb-sp-5);font-size:var(--nb-fs-label);color:${T.text3};line-height:1.5}
.nb-spine-lede b{color:${T.text2};font-weight:600}
/* a source chip that opens S# — the same affordance the chat answer has */
.nb-srcchip{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 10px;
  border-radius:var(--nb-r-pill);border:1px solid color-mix(in srgb,${T.accent} 28%, transparent);
  background:color-mix(in srgb,${T.accent} 9%, transparent);cursor:pointer;
  font-size:var(--nb-fs-meta);font-weight:700;color:color-mix(in srgb,${T.accent} 72%, ${T.text});
  max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:inherit}
.nb-srcchip:hover{background:color-mix(in srgb,${T.accent} 18%, transparent);
  border-color:color-mix(in srgb,${T.accent} 50%, transparent)}
.nb-srcchip[disabled]{cursor:default;opacity:.7}

/* ---------------------------------------------------------------- mind map */
.nb-map{width:100%;height:100%;min-height:340px;display:block;cursor:grab;border-radius:var(--nb-r-box);
  border:1px solid var(--nb-hair-soft);
  background:radial-gradient(circle at 50% 45%, color-mix(in srgb,${T.accent} 9%, transparent), transparent 62%), var(--nb-card)}
.nb-map:active{cursor:grabbing}

/* -------------------------------------------------------------- flashcards */
.nb-deck{display:flex;flex-direction:column;gap:16px;max-width:640px;margin:0 auto;width:100%}
.nb-flip{perspective:1400px;cursor:pointer;border:0;background:transparent;padding:0;width:100%}
.nb-flip-inner{position:relative;width:100%;min-height:310px;transition:transform .5s cubic-bezier(.2,.7,.2,1);
  transform-style:preserve-3d}
.nb-flip[data-flipped=true] .nb-flip-inner{transform:rotateY(180deg)}
.nb-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:var(--nb-r-box);
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
  padding:11px 14px;border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-el);background:var(--nb-card);
  cursor:pointer;text-align:left;color:${T.text};min-height:54px;
  transition:border-color var(--nb-dur-fast) var(--nb-ease),box-shadow var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease)}
.nb-frow:hover{border-color:color-mix(in srgb,${T.text} 20%, transparent);box-shadow:var(--nb-shadow)}
.nb-frow[aria-current=true]{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  background:color-mix(in srgb,${T.accent} 9%, var(--nb-card))}
.nb-fname{font-size:14px;font-weight:600;line-height:1.25;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nb-frole{font-size:10.5px;color:${T.text3};text-transform:uppercase;letter-spacing:.06em;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nb-term{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13px;line-height:1.55;flex:1 1 auto;
  background:#101320;color:#c9cede;border-radius:var(--nb-r-box);padding:16px;min-height:130px;max-height:none;overflow:auto;
  white-space:pre-wrap;word-break:break-word;border:1px solid rgba(255,255,255,.09);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.nb-term-in{display:flex;gap:8px;align-items:center;margin-top:10px}
.nb-term-in input{flex:1;height:38px;border-radius:var(--nb-r-el);border:1px solid var(--nb-hair);
  background:var(--nb-wash);color:${T.text};padding:0 13px;font-size:13px;
  font-family:var(--ui-font-mono,ui-monospace,monospace);outline:0}
.nb-term-in input:focus{border-color:color-mix(in srgb,${T.accent} 55%, transparent)}

/* -------------------------------------------------------------- status bar */
.nb-status{flex:0 0 32px;height:32px;display:flex;align-items:center;gap:14px;padding:0 18px;font-size:12.5px;
  border-top:1px solid var(--nb-hair-soft);background:transparent;
  font-size:11.5px;color:${T.text3}}
.nb-status b{color:${T.text2};font-weight:600}
.nb-sdot{width:8px;height:8px;border-radius:var(--nb-r-pill);display:inline-block;margin-right:8px;vertical-align:middle}
.nb-void{display:grid;place-items:center;height:100%;padding:40px;text-align:center;color:${T.text3}}
.nb-void h3{color:${T.text};font-size:22px;margin:0 0 10px;letter-spacing:-.02em;font-weight:700}
.nb-void p{margin:0;max-width:48ch;font-size:14px;line-height:1.62}

/* ------------------------------------------------------ home (the reading room)
   One shelf, full width, one card design. The old surface drew the same
   notebooks twice — a coloured "most in the drawer" row and then the grey
   "all notebooks" grid underneath — and capped both at three columns, leaving
   the right of a 16:9 window empty. There is now a single responsive grid that
   spans the content column, one action in the header (New notebook, beside the
   search field), and one card that carries an accent strip, a clamped title,
   a description preview and counted metadata. */
.nb-home{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-home-scroll{flex:1;min-height:0;overflow:auto;
  padding:var(--nb-sp-7) var(--nb-sp-6) var(--nb-sp-8);
  overscroll-behavior:contain}
.nb-home-inner{max-width:1360px;margin:0 auto;width:100%;display:flex;flex-direction:column;
  min-height:100%}
/* the header is one bar: title + counts on the left, search + New notebook on
   the right. The action lives where the person looks first, not stranded over
   the second row of cards. */
.nb-home-head{display:flex;align-items:flex-end;gap:var(--nb-sp-4);flex-wrap:wrap;
  margin-bottom:var(--nb-sp-6)}
.nb-home-titles{min-width:0;flex:1 1 220px}
.nb-home-title{font-size:var(--nb-fs-display);font-weight:700;letter-spacing:-.022em;
  margin:0;line-height:1.15}
.nb-home-sub{font-size:var(--nb-fs-ui);color:${T.text2};margin:var(--nb-sp-2) 0 0;line-height:1.5}
.nb-home-sub b{color:${T.text};font-weight:650;font-variant-numeric:tabular-nums}
.nb-home-tools{display:flex;align-items:center;gap:var(--nb-sp-3);flex-wrap:wrap}
.nb-home-search{width:min(280px,46vw)}
/* count chips read as measurements, not prose: glyph + number + quiet noun */
.nb-counts{display:flex;align-items:center;gap:var(--nb-sp-3);flex-wrap:wrap}
.nb-count{display:inline-flex;align-items:center;gap:5px;color:${T.text3};
  font-size:var(--nb-fs-meta);line-height:1;white-space:nowrap}
.nb-count b{color:${T.text2};font-weight:650;font-variant-numeric:tabular-nums}
.nb-count svg{opacity:.75}

.nb-home-sec{display:flex;align-items:center;gap:var(--nb-sp-3);margin:0 0 var(--nb-sp-4);
  padding-bottom:var(--nb-sp-3);border-bottom:1px solid var(--nb-hair-soft)}
.nb-home-sec .nb-meta{color:${T.text2}}
/* the shelf fills whatever width the card is given: 320px minimum, no cap */
.nb-home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
  gap:var(--nb-sp-4);align-content:start;width:100%}
.nb-nbcard-wrap{position:relative;min-height:176px;animation:nb-card-in var(--nb-dur-med) var(--nb-ease) both}
.nb-nbcard{width:100%;height:100%;position:relative;border-radius:var(--nb-r-box);
  padding:var(--nb-sp-5) var(--nb-sp-5) var(--nb-sp-4);
  display:flex;flex-direction:column;gap:var(--nb-sp-3);
  text-align:left;cursor:pointer;color:${T.text};font-family:inherit;
  border:1px solid var(--nb-hair-soft);background:var(--nb-card);
  transition:border-color var(--nb-dur-fast) var(--nb-ease),transform var(--nb-dur-fast) var(--nb-ease),
    box-shadow var(--nb-dur-fast) var(--nb-ease),background var(--nb-dur-fast) var(--nb-ease)}
/* the accent strip: the notebook's own sigil hue, drawn from its id, so two
   cards never read as the same object */
.nb-nbcard::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;
  border-radius:var(--nb-r-box) var(--nb-r-box) 0 0;
  background:linear-gradient(90deg,
    color-mix(in srgb,var(--kc) 78%, transparent),
    color-mix(in srgb,var(--kc) 18%, transparent))}
.nb-nbcard:hover{border-color:color-mix(in srgb,var(--kc) 44%, var(--nb-hair));
  transform:translateY(-2px);box-shadow:var(--nb-shadow-lift);background:var(--nb-wash-2)}
.nb-nbcard:focus-visible{outline:2px solid ${T.accent};outline-offset:3px}
.nb-nbcard-top{display:flex;align-items:flex-start;gap:var(--nb-sp-3);min-width:0}
.nb-nbcard-emoji{flex:0 0 auto;line-height:1;display:grid;place-items:center}
.nb-nbcard-head{min-width:0;flex:1;padding-right:var(--nb-sp-6)}
.nb-nbcard-title{font-size:var(--nb-fs-title);font-weight:650;line-height:1.3;letter-spacing:-.012em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  overflow-wrap:anywhere}
.nb-nbcard-when{display:block;margin-top:3px;font-size:var(--nb-fs-meta);color:${T.text3};font-weight:500}
.nb-nbcard-desc{font-size:var(--nb-fs-label);line-height:1.5;color:${T.text3};
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  min-height:calc(2 * 1.5 * var(--nb-fs-label))}
.nb-nbcard-desc[data-empty="true"]{color:${T.text4};font-style:italic}
.nb-nbcard-foot{display:flex;align-items:center;gap:var(--nb-sp-3);margin-top:auto;
  padding-top:var(--nb-sp-3);border-top:1px solid var(--nb-hair-soft);flex-wrap:wrap;row-gap:var(--nb-sp-2)}
.nb-nbcard-open{display:inline-flex;align-items:center;gap:6px;margin-left:auto;
  /* 62% of the card's own accent measured 4.45:1 on the light skin — just under
     AA. 55% clears it on every card colour without turning the link grey. */
  font-size:var(--nb-fs-label);font-weight:650;color:color-mix(in srgb,var(--kc) 52%, ${T.text});
  white-space:nowrap}
.nb-nbcard:hover .nb-nbcard-open svg{transform:translateX(2px)}
.nb-nbcard-open svg{transition:transform var(--nb-dur-fast) var(--nb-ease)}
.nb-nbcard-del{position:absolute;top:var(--nb-sp-3);right:var(--nb-sp-2);z-index:2}
.nb-nbcard-ren{position:absolute;top:var(--nb-sp-3);right:calc(var(--nb-sp-2) + 34px);z-index:2}
/* the corner buttons only exist when the card is hovered or focused-within —
   destructive chrome is not billboarded (DESIGN-LORE law 4) */
.nb-nbcard-del,.nb-nbcard-ren{opacity:0}
.nb-nbcard-wrap:hover .nb-nbcard-del,.nb-nbcard-wrap:hover .nb-nbcard-ren,
.nb-nbcard-wrap:focus-within .nb-nbcard-del,.nb-nbcard-wrap:focus-within .nb-nbcard-ren,
.nb-nbcard-del:focus-visible,.nb-nbcard-ren:focus-visible{opacity:1}
@media (hover:none){ .nb-nbcard-del,.nb-nbcard-ren{opacity:1} }

/* --------------------------------------------------------------- council */
.nb-council{display:inline-flex;flex-wrap:wrap;align-items:center;gap:7px;
  margin:0 0 10px;max-width:100%;padding:7px 12px;border-radius:var(--nb-r-pill);
  font-size:var(--nb-fs-label);line-height:1.45;color:var(--nb-ink);
  background:var(--nb-wash);border:1px solid var(--nb-hair)}
.nb-council>*{white-space:normal}
.nb-council-dot{width:8px;height:8px;border-radius:50%;flex:none;background:#B8860B;
  box-shadow:0 0 0 3px color-mix(in srgb,#B8860B 22%, transparent)}
.nb-council[data-verdict=holds],.nb-council[data-verdict=partly],.nb-council[data-verdict=fails]{
  color:var(--nb-ink)}
.nb-council[data-verdict=holds] .nb-council-dot{background:${T.ok};box-shadow:0 0 0 3px color-mix(in srgb,${T.ok} 22%, transparent)}
.nb-council[data-verdict=partly] .nb-council-dot{background:#C08A2E;box-shadow:0 0 0 3px rgba(192,138,46,.22)}
.nb-council[data-verdict=fails] .nb-council-dot{background:${T.danger};box-shadow:0 0 0 3px color-mix(in srgb,${T.danger} 22%, transparent)}
.nb-council[data-verdict=unknown] .nb-council-dot{background:${T.text4}}
.nb-council-lab{font-weight:750;color:var(--nb-ink)}
.nb-council-note{color:var(--nb-ink2);font-size:var(--nb-fs-meta)}
.nb-council-bad{margin:6px 0 0;padding-left:18px;width:100%;color:${T.text2};
  font-size:var(--nb-fs-label);line-height:1.5}
.nb-council-bad li{margin:2px 0}

/* ---------------------------------------------- composer modes + action cards */
.nb-modes{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.nb-mode{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;
  border-radius:var(--nb-r-pill);cursor:pointer;font-family:inherit;
  font-size:var(--nb-fs-meta);font-weight:650;letter-spacing:.01em;
  border:1px solid var(--nb-edge);background:transparent;color:${T.text3};
  transition:background var(--nb-dur-fast) var(--nb-ease),color var(--nb-dur-fast) var(--nb-ease),
    border-color var(--nb-dur-fast) var(--nb-ease)}
.nb-mode:hover{color:${T.text};background:var(--nb-wash-2)}
.nb-mode[data-active=true]{color:color-mix(in srgb,${T.accent} 65%, ${T.text});
  border-color:color-mix(in srgb,${T.accent} 45%, var(--nb-edge));
  background:color-mix(in srgb,${T.accent} 12%, transparent)}
.nb-mode:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}

.nb-acts{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}
.nb-act{background:var(--nb-tile);border:1px solid var(--nb-edge);
  border-radius:var(--nb-r-el);overflow:hidden}
.nb-act[data-ok=false]{border-color:color-mix(in srgb,${T.danger} 45%, var(--nb-edge))}
.nb-act-head{display:flex;align-items:center;gap:8px;width:100%;padding:9px 11px;
  background:transparent;border:0;cursor:pointer;font-family:inherit;
  color:${T.text2};font-size:var(--nb-fs-label);text-align:left;min-height:36px}
.nb-act-head:hover{background:var(--nb-wash)}
.nb-act-status{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;
  font-size:11px;font-weight:800;color:#0d0e15;background:${T.ok}}
.nb-act[data-ok=false] .nb-act-status{background:${T.danger};color:#fff}
.nb-act-title{font-weight:700;color:${T.text};white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.nb-act-meta{color:${T.text3};font-size:var(--nb-fs-meta);font-weight:600}
.nb-act-ms{margin-left:auto;color:${T.text4};font-size:var(--nb-fs-meta);
  font-variant-numeric:tabular-nums}
.nb-act-chev{display:grid;place-items:center;color:${T.text4};
  transition:transform var(--nb-dur-fast) var(--nb-ease)}
.nb-act-head[aria-expanded=true] .nb-act-chev{transform:rotate(180deg)}
.nb-act-body{padding:0 11px 11px;display:flex;flex-direction:column;gap:8px}
.nb-act-label{font-size:var(--nb-fs-meta);font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:${T.text4}}
.nb-act-pre{margin:0;padding:9px 11px;border-radius:var(--nb-r-in);background:var(--nb-inset);
  border:1px solid var(--nb-edge);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:12.5px;line-height:1.5;color:${T.text2};overflow:auto;max-height:220px;
  white-space:pre-wrap;overflow-wrap:anywhere}
.nb-act-in{color:${T.text}}
/* the same blue the citation pills use, so a query and its sources read as one family */
.nb-hl-kw{color:var(--nb-cite-ink);font-weight:650}
.nb-hl-str{color:color-mix(in srgb,${T.ok} 72%, ${T.text})}
.nb-hl-num{color:color-mix(in srgb,${T.warn} 78%, ${T.text})}
.nb-hl-com{color:${T.text4};font-style:italic}

.nb-act-err{color:${T.danger}}
.nb-act-tablewrap{overflow:auto;max-height:240px;border:1px solid var(--nb-edge);
  border-radius:var(--nb-r-in);background:var(--nb-inset)}
.nb-act-table{border-collapse:collapse;width:100%;font-size:12.5px}
.nb-act-table th,.nb-act-table td{padding:6px 10px;text-align:left;
  border-bottom:1px solid var(--nb-edge);white-space:nowrap}
.nb-act-table th{font-weight:700;color:${T.text2};position:sticky;top:0;background:var(--nb-tile)}
.nb-act-note{font-size:var(--nb-fs-meta);color:${T.text3}}
.nb-act-foot{display:flex;gap:6px;flex-wrap:wrap}

/* ------------------------------------------------ infographic (live render)
   The artifact is JSON first and a poster second: this renders the JSON, so the
   numbers are selectable text, each one carries its source, and the layout
   follows the theme instead of being baked into a PNG. */
.nb-ig{display:flex;flex-direction:column;gap:16px;padding-bottom:8px}
.nb-ig-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.nb-ig-title{font-size:22px;font-weight:650;letter-spacing:-.015em;line-height:1.25;margin:0;color:${T.text}}
.nb-ig-switch{display:flex;justify-content:flex-end;margin-bottom:10px}
.nb-ig-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.nb-ig-kpi{background:var(--nb-tile);border:1px solid var(--nb-edge);border-radius:var(--nb-r-el);
  padding:14px 14px 12px;display:flex;flex-direction:column;gap:4px;min-width:0}
.nb-ig-kpi-value{font-size:28px;font-weight:750;letter-spacing:-.02em;line-height:1.1;color:${T.text}}
.nb-ig-kpi-label{font-size:var(--nb-fs-label);font-weight:650;color:${T.text2}}
.nb-ig-kpi-detail{font-size:var(--nb-fs-meta);line-height:1.45;color:${T.text2}}
.nb-ig-src{margin-top:2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;display:block;text-align:left}
.nb-ig-quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.nb-ig-quote{display:flex;flex-direction:column;gap:6px;text-align:left;cursor:pointer;
  background:var(--nb-tile);border:1px solid var(--nb-edge);border-radius:var(--nb-r-el);
  padding:13px 14px;font-family:inherit;color:${T.text}}
.nb-ig-quote[data-open=true]{border-color:color-mix(in srgb,${T.accent} 45%, var(--nb-edge))}
.nb-ig-quote blockquote{margin:0;font-size:14px;line-height:1.55;color:${T.text2};
  border-left:2px solid color-mix(in srgb,${T.accent} 45%, transparent);padding-left:10px}
.nb-ig-quote-src{font-size:var(--nb-fs-meta);font-weight:650;color:${T.text3};
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nb-ig-cites{display:flex;gap:4px;flex-wrap:wrap}
.nb-ig-take{background:color-mix(in srgb,${T.accent} 8%, var(--nb-tile));
  border:1px solid color-mix(in srgb,${T.accent} 26%, var(--nb-edge));
  border-radius:var(--nb-r-box);padding:14px 16px}
.nb-ig-take-label{font-size:var(--nb-fs-meta);font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:color-mix(in srgb,${T.accent} 55%, ${T.text})}
.nb-ig-take p{margin:6px 0 0;font-size:var(--nb-fs-read);line-height:1.55;color:${T.text}}

/* generator options popover + citation hover card + data table */
.nb-gen{position:relative}
/* The options button is a CONTROL, not a hover decoration: it was opacity:0
   until the pointer was already over the card, so on a touch screen, on a
   trackpad with the pointer elsewhere, or on first glance at the page the
   settings looked like they did not exist. Quiet when idle, bright on hover. */
.nb-gen-cfg{position:absolute;top:3px;right:3px;width:32px;height:32px;
  border-radius:var(--nb-r-in);background:var(--nb-wash-2);opacity:.42;
  transition:opacity var(--nb-dur-fast) var(--nb-ease)}
.nb-gen:hover .nb-gen-cfg,.nb-gen:focus-within .nb-gen-cfg,
.nb-gen-cfg:focus-visible,.nb-gen-cfg[data-active=true]{opacity:1}
@media (hover:none){.nb-gen-cfg{opacity:.75}}
.nb-gen:hover .nb-gen-cfg,.nb-gen-cfg[data-active="true"],.nb-gen-cfg:focus-visible{opacity:1}
@media (hover:none){.nb-gen-cfg{opacity:.8}}
.nb-genopt-label{font-size:11.5px;font-weight:600;color:${T.text3};margin-bottom:6px;
  text-transform:uppercase;letter-spacing:.06em}
.nb-genopt .nb-seg{width:100%}
.nb-genopt .nb-seg button{flex:1;justify-content:center}
.nb-genopt-text{width:100%;height:32px;padding:0 10px;border-radius:var(--nb-r-in);font-size:13px;
  border:1px solid ${T.line};background:${T.inset};color:${T.text};outline:none}
.nb-genopt-text:focus{border-color:color-mix(in srgb,${T.accent} 55%,transparent)}

/* A hover card floats OVER the page, so it gets its own material: the panel
   colour at 95% over a blur, which reads as glass instead of a second pane. */
.nb-citepop{position:fixed;z-index:80;width:340px;max-width:calc(100vw - 32px);
  background:color-mix(in srgb,var(--nb-panel) 95%, transparent);
  -webkit-backdrop-filter:blur(18px) saturate(1.3);
  backdrop-filter:blur(18px) saturate(1.3);
  border:1px solid color-mix(in srgb,var(--nb-ink) 12%, transparent);
  border-radius:var(--nb-r-box);
  box-shadow:0 24px 60px -24px rgba(0,0,0,.55);
  padding:13px 15px;pointer-events:none}
.nb-citepop-head{display:flex;align-items:center;gap:8px;font-size:12.5px;
  color:${T.text3};margin-bottom:6px;flex-wrap:wrap}
.nb-citepop-head b{color:color-mix(in srgb,${T.accent} 70%, ${T.text});font-weight:700}
.nb-citepop-body{font-size:13px;line-height:1.55;color:${T.text2};
  display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}

.nb-scope-check{flex:none;width:18px;height:18px;border-radius:var(--nb-r-in);
  border:1.5px solid ${T.line};display:grid;place-items:center;font-size:11.5px;
  color:#fff;transition:all var(--nb-dur-fast) var(--nb-ease)}
.nb-scope-check.on{background:${T.accent};border-color:${T.accent}}

.nb-search-hit{display:block;width:100%;text-align:left;background:transparent;
  border:1px solid ${T.line};border-radius:var(--nb-r-el);padding:10px 12px;cursor:pointer;
  color:${T.text};font:inherit;transition:border-color var(--nb-dur-fast) var(--nb-ease),background var(--nb-dur-fast) var(--nb-ease)}
.nb-search-hit:hover{border-color:color-mix(in srgb,${T.accent} 45%,transparent);
  background:color-mix(in srgb,${T.accent} 6%,transparent)}
.nb-search-hit-head{display:flex;align-items:center;gap:8px;font-size:13px;
  margin-bottom:4px}
.nb-search-hit-head b{font-weight:600;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.nb-search-hit-snip{font-size:13px;line-height:1.5;color:${T.text3};
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nb-search-hit mark{background:color-mix(in srgb,${T.accent} 30%,transparent);
  color:${T.text};border-radius:var(--nb-r-in);padding:0 1px}

.nb-dt-wrap{overflow:auto;border:1px solid ${T.line};border-radius:var(--nb-r-box);
  background:${T.card}}
.nb-dt{border-collapse:collapse;width:100%;font-size:13px;min-width:520px}
.nb-dt th{position:sticky;top:0;background:${T.inset};text-align:left;
  font-weight:650;font-size:12.5px;color:${T.text2};padding:10px 14px;
  border-bottom:1px solid ${T.line};cursor:pointer;user-select:none;white-space:nowrap}
.nb-dt th:hover{color:${T.text}}
.nb-dt-arrow{color:color-mix(in srgb,${T.accent} 70%, ${T.text});margin-left:5px;font-size:11.5px}
.nb-dt td{padding:9px 14px;border-bottom:1px solid ${T.lineSoft};color:${T.text2}}
.nb-dt tbody tr:last-child td{border-bottom:0}
.nb-dt tbody tr:hover td{background:color-mix(in srgb,${T.accent} 4%,transparent)}

/* Density is measured on the ROOT (see appendChild's ResizeObserver in
   30-shell.js), because the viewport is not the space this page gets: the host
   app's own rail takes 260px of it. These rules replace the viewport queries
   that shipped before, which fired at the wrong widths and left the main pane
   332px wide on a 1280px screen. */
.nb-root[data-density=compact]{--nb-rail:236px; --nb-studio:320px}
.nb-root[data-density=compact] .nb-body{padding:10px;gap:10px}
.nb-root[data-density=compact] .nb-h1{font-size:22px}
/* the output list is one column at every density: a 2-up grid in a 300–420px
   drawer forces a min-content floor wider than the panel, which is exactly how
   rows ended up clipped by the drawer's edge */
/* Below 900 root pixels the three-column workbench is three slivers. The RAIL
   folds away (its content is reachable from Home and the source dialog), and
   the drawer keeps its width because the artifacts are the product. Hiding both
   — which is what the old max-width:1100 query did — left a chat pane and
   nothing to make anything with. */
/* TIGHT: widths only — nothing is hidden by CSS.
   A display:none rule here was a dead end: below 1060 root px (every 1280px
   window once the app's own sidebar is counted) the sources rail vanished, and
   because the rail was still mounted there was no toggle to bring it back. A
   panel may only disappear when the USER closes it, and PanelToggles then keeps
   it one click away. */
.nb-root[data-density=tight]{--nb-rail:216px; --nb-studio:288px}
.nb-root[data-density=tight] .nb-body{padding:8px;gap:8px}
.nb-root[data-density=tight] .nb-h1{font-size:20px}

/* ================= the old viewport queries, for a host that renders the page
   full-bleed (the preview harness and a fullscreen window do) ================
   EVERY rule here is scoped to the root's own density attribute; without that
   scope they applied to EVERY host. They used to be unscoped,
   and that was the bug that made the workbench look broken: with the shell's own
   sidebar taking ~260px, a 1024–1280px window gives this page ~760–1020px, the
   root-measured tier said "tight — keep the Make drawer", and then
   the old max-width:1100 query hid it anyway. Rail
   folded by density, drawer folded by viewport, and the page was a lone chat
   column with nothing to make anything with. */
@media (max-width:1280px){
  .nb-root:not([data-density]){--nb-rail:240px; --nb-studio:340px}
}
@media (max-width:1100px){
  .nb-root:not([data-density]) .nb-studio{display:none}
  .nb-thread{padding:22px 20px 12px}
  .nb-main-head{padding:0 var(--nb-sp-4)}
  .nb-composer{padding:12px 20px 16px}
  .nb-home-scroll{padding:20px 18px 24px}
}
@media (max-width:820px){
  .nb-root:not([data-density]) .nb-rail{display:none}
  .nb-h1{font-size:22px}
  .nb-body{padding:8px;gap:8px}
  .nb-suggest-grid{grid-template-columns:1fr}
}

/* study — a session, not a deck viewer: one card at a time, keyboard first */
.nb-study{display:flex;flex-direction:column;gap:16px;padding:26px 30px 40px;max-width:980px;margin:0 auto;
  width:100%;flex:1 1 auto;min-height:0;overflow:auto}
.nb-study-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
.nb-study-title{font-size:22px;font-weight:650;letter-spacing:-.01em;color:${T.text}}
.nb-study-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.nb-study-actions{display:flex;gap:8px;align-items:center}
.nb-study-progress{display:flex;align-items:center;gap:12px}
.nb-study-bar{flex:1;height:4px;border-radius:var(--nb-r-pill);background:var(--nb-hair-soft);overflow:hidden}
.nb-study-bar i{display:block;height:100%;background:${T.accent};border-radius:var(--nb-r-pill);transition:width .25s ease}
.nb-study-card{margin-top:auto;border:1px solid var(--nb-hair);border-radius:var(--nb-r-box);background:var(--nb-card);
  padding:28px 30px 24px;min-height:210px;display:flex;flex-direction:column;gap:16px;
  box-shadow:var(--nb-shadow)}
.nb-study-card[data-phase="new"]{border-color:color-mix(in srgb,${T.accent} 40%, var(--nb-hair))}
.nb-study-q{font-size:22px;line-height:1.4;font-weight:600;color:${T.text};max-width:62ch}
.nb-study-choices{display:grid;gap:8px;max-width:62ch}
.nb-study-choice{padding:10px 14px;border-radius:var(--nb-r-el);border:1px solid var(--nb-hair-soft);
  background:var(--nb-card-deep, transparent);color:${T.text2};font-size:14px}
.nb-study-choice[data-right="true"]{border-color:${T.ok};background:color-mix(in srgb,${T.ok} 14%, transparent);color:${T.text}}
.nb-study-a{display:flex;flex-direction:column;gap:8px;font-size:16px;line-height:1.55;color:${T.text};
  padding-top:14px;border-top:1px solid var(--nb-hair-soft)}
.nb-study-a-label{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:${T.text4}}
.nb-study-reveal{display:flex;align-items:center;gap:12px;margin-top:auto}
.nb-study-ratings{display:flex;gap:8px;flex-wrap:wrap;min-height:44px;align-items:center;margin-bottom:auto}
.nb-study-rate{flex:1 1 150px;display:flex;flex-direction:column;gap:2px;align-items:flex-start;
  padding:10px 14px;border-radius:var(--nb-r-el);border:1px solid var(--nb-hair);background:var(--nb-card);
  color:${T.text};cursor:pointer;font-size:14px}
.nb-study-rate span{font-size:11.5px;color:${T.text3}}
.nb-study-rate:hover{background:var(--nb-card-hover, color-mix(in srgb,#fff 4%, transparent))}
.nb-study-src{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:0;
  border:0;background:none;color:color-mix(in srgb,${T.accent} 70%, ${T.text});
  font-size:12.5px;text-decoration:underline;
  text-underline-offset:3px;cursor:pointer}
.nb-study-empty{display:grid;justify-items:center;gap:10px;padding:64px 20px;text-align:center;
  color:${T.text3};border:1px dashed var(--nb-hair-soft);border-radius:var(--nb-r-box)}
@media (max-width:820px){ .nb-study{padding:18px 16px 32px} .nb-study-q{font-size:19px} }
.nb-linkbtn{background:none;border:0;padding:0;font:inherit;
  color:color-mix(in srgb,${T.accent} 70%, ${T.text});cursor:pointer;
  text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.nb-linkbtn:hover{color:${T.text}}
/* --- surfaces that lost their stylesheet in a branch merge: discover, thread
   list, link buttons, inputs and chip rows were rendering as browser defaults --- */
.nb-newthread{display:flex;gap:8px;align-items:center}
.nb-newthread .nb-genopt-text{flex:1;min-width:0}
.nb-chiprow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 0 6px}
.nb-thrlist{display:flex;flex-direction:column;gap:6px;max-height:min(46vh,360px);
  overflow:auto;overscroll-behavior:contain;padding:2px;margin:0 -2px}
.nb-thredit{display:flex;gap:6px;align-items:center;width:100%;padding:2px 4px}
.nb-thredit .nb-genopt-text{flex:1;min-width:0}
.nb-newthread{display:flex;gap:8px;align-items:center}
.nb-newthread .nb-genopt-text{flex:1;min-width:0}
.nb-danger{color:${T.danger} !important;
  border-color:color-mix(in srgb,${T.danger} 45%,transparent) !important}
/* ---------------------------------------------------------------- tensions */
/* The audit reads as a case file: a verdict a person can quote, then numbered
   disagreements, each with its two (or more) cited sides. Tone follows the
   measured independence, never a fixed colour. */
.nb-tensions{flex:1;min-height:0;overflow:auto;padding:var(--nb-sp-7) var(--nb-sp-8) var(--nb-sp-8);
  display:flex;flex-direction:column;gap:var(--nb-sp-4);max-width:1040px;width:100%;
  overscroll-behavior:contain}
.nb-tensions .nb-disc-head h1{margin:0 0 6px}
.nb-disc-sub{font-size:var(--nb-fs-ui);color:${T.text2};line-height:1.55;margin:0;max-width:76ch}
.nb-tension-bar{display:flex;align-items:center;gap:var(--nb-sp-4);flex-wrap:wrap;margin-top:2px}
.nb-tension-counts{display:flex;align-items:center;gap:var(--nb-sp-4);flex-wrap:wrap}

/* the measured verdict — one sentence, toned by what was measured */
.nb-tension-verdict{padding:var(--nb-sp-4) var(--nb-sp-4);border-radius:var(--nb-r-el);
  border:1px solid var(--nb-hair-soft);background:var(--nb-card);
  font-size:var(--nb-fs-ui);line-height:1.55;color:${T.text2};
  border-left:3px solid color-mix(in srgb,${T.ok} 70%, transparent)}
.nb-tension-verdict[data-tone=warn]{border-left-color:color-mix(in srgb,${T.warn} 70%, transparent)}
.nb-tension-verdict b{color:${T.text}}

/* one disagreement = a case file entry */
.nb-tension-list{display:flex;flex-direction:column;gap:var(--nb-sp-4)}
.nb-tension{border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-box);
  background:var(--nb-card);padding:var(--nb-sp-4) var(--nb-sp-5) var(--nb-sp-5);
  display:flex;flex-direction:column;gap:var(--nb-sp-3)}
.nb-tension-head{display:flex;align-items:baseline;gap:var(--nb-sp-3)}
.nb-tension-n{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:var(--nb-fs-meta);
  font-weight:700;color:${T.text3};flex:0 0 auto}
.nb-tension-topic{margin:0;font-size:var(--nb-fs-title);font-weight:650;line-height:1.35;
  letter-spacing:-.01em;color:${T.text}}
.nb-tension-sides{display:grid;grid-template-columns:1fr 1fr;gap:var(--nb-sp-3)}
.nb-tension-side{display:flex;flex-direction:column;gap:var(--nb-sp-2);min-width:0}
.nb-tension-claim{font-size:var(--nb-fs-body);line-height:1.5;color:${T.text}}
.nb-tension-quote{margin:0;padding:var(--nb-sp-2) var(--nb-sp-3);border-radius:var(--nb-r-in);
  background:var(--nb-wash-2);border-left:2px solid color-mix(in srgb,${T.accent} 55%, transparent);
  font-size:var(--nb-fs-label);line-height:1.5;color:${T.text3};font-style:italic}
.nb-tension-src{display:flex;gap:6px;flex-wrap:wrap}
.nb-tension-why{font-size:var(--nb-fs-label);line-height:1.5;color:${T.text3}}
.nb-tension-res{font-size:var(--nb-fs-label);line-height:1.5;color:${T.text2};
  padding-top:var(--nb-sp-2);border-top:1px solid var(--nb-hair-soft)}
.nb-tension-res b{color:${T.text}}
.nb-tension-agree{display:flex;flex-direction:column;gap:var(--nb-sp-2);margin-top:var(--nb-sp-2)}
.nb-tension-agree-row{display:flex;align-items:flex-start;gap:var(--nb-sp-3);
  padding:var(--nb-sp-2) var(--nb-sp-3);border-radius:var(--nb-r-el);background:var(--nb-wash)}
.nb-tension-agree-row svg{flex:0 0 auto;margin-top:2px;color:color-mix(in srgb,${T.ok} 62%, ${T.text})}
.nb-tension-agree-claim{flex:1;min-width:0;font-size:var(--nb-fs-label);line-height:1.5;color:${T.text}}
.nb-tension-agree-src{flex:0 0 auto;font-family:var(--ui-font-mono,ui-monospace,monospace);
  font-size:var(--nb-fs-meta);font-weight:650;color:${T.accent}}
@media (max-width:900px){ .nb-tension-sides{grid-template-columns:1fr} }

/* ---------------------------------------------------------------- discover */
.nb-disc{flex:1;min-height:0;overflow:auto;padding:26px 30px 40px;display:flex;flex-direction:column;
  gap:14px;max-width:1040px;width:100%}
.nb-disc-head h1{margin:0 0 6px}
.nb-disc-search{display:flex;gap:10px;align-items:center;margin-top:4px}
.nb-disc-search .nb-input{flex:1;min-width:0}
.nb-input{height:44px;padding:0 16px;border-radius:var(--nb-r-el);border:1px solid var(--nb-hair);
  background:var(--nb-card);color:${T.text};font:inherit;font-size:14px;outline:0;
  transition:border-color .15s ease, box-shadow .15s ease}
.nb-input:focus{border-color:color-mix(in srgb,${T.accent} 55%, transparent);
  box-shadow:0 0 0 4px color-mix(in srgb,${T.accent} 14%, transparent)}
.nb-input::placeholder{color:${T.text4}}
.nb-disc-gaps{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.nb-disc-body{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.nb-disc-card{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;cursor:pointer;
  border:1px solid var(--nb-hair-soft);border-radius:var(--nb-r-box);background:var(--nb-card);
  transition:border-color .15s ease, background .15s ease}
.nb-disc-card:hover{border-color:var(--nb-hair)}
.nb-disc-card[data-on=true]{border-color:color-mix(in srgb,${T.accent} 50%, transparent);
  background:color-mix(in srgb,${T.accent} 8%, var(--nb-card))}
.nb-disc-card input{width:16px;height:16px;margin-top:3px;accent-color:color-mix(in srgb,${T.accent} 70%, ${T.text});
  cursor:pointer;flex:0 0 16px}
.nb-disc-main{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}
.nb-disc-top{display:flex;align-items:center;gap:8px;font-size:11.5px}
.nb-disc-dom{color:color-mix(in srgb,${T.accent} 70%, ${T.text});font-weight:600;letter-spacing:.01em}
.nb-disc-title{font-size:14px;font-weight:600;line-height:1.35;color:${T.text}}
.nb-disc-snip{font-size:13px;line-height:1.5;color:${T.text3};
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.nb-disc-why{display:flex;align-items:center;gap:6px;font-size:12.5px;color:${T.text2};padding-top:2px}
.nb-disc-foot{display:flex;align-items:center;gap:12px;position:sticky;bottom:12px;
  padding:12px 14px;border-radius:var(--nb-r-box);border:1px solid var(--nb-hair);
  background:var(--nb-card);box-shadow:var(--nb-shadow)}
.nb-disc-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:${T.text4};padding-top:4px}
.nb-disc-empty{display:grid;justify-items:center;gap:8px;padding:56px 20px;text-align:center;
  color:${T.text3};border:1px dashed var(--nb-hair-soft);border-radius:var(--nb-r-box)}
.nb-disc-err{color:${T.danger};font-size:13px;padding:10px 14px;border-radius:var(--nb-r-el);
  background:color-mix(in srgb,${T.danger} 12%, transparent)}
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

/* ------------------------------------------------------------ state machines
 *
 * The page has always known what it is doing only by inference: five booleans
 * named `busy`, a `pending` object that carries its own clock, `ov`/`ovErr`/
 * `ovRetry` where one failure is expressed as three variables. That inference is
 * where the impossible states live — "searching but no query", "creating while
 * idle", a spinner that cannot be dismissed after the backend gives up.
 *
 * One machine per concern, declared as data:
 *
 *   const turn = Machine('turn', {
 *     initial: 'idle',
 *     states: {
 *       idle:    { on: { ASK: 'asking' } },
 *       asking:  { tags: ['busy'], on: { ANSWER: 'idle', FAIL: 'failed', CANCEL: 'idle' },
 *                  enter: (ctx) => { const t = setInterval(...); return () => clearInterval(t) } },
 *       failed:  { on: { ASK: 'asking', DISMISS: 'idle' } }
 *     }
 *   })
 *
 * Why this shape, and not a library:
 *
 * - **UX** — a component reads one state and a derived flag (`tags`), so it cannot
 *   render searching-with-no-query. `enter` returns its own cleanup, so timers and
 *   listeners cannot outlive the state that needed them.
 * - **DX** — the transition table *is* the documentation. An illegal event is
 *   refused and recorded (with the state it arrived in) instead of silently
 *   corrupting a boolean. `machine.can('ASK')` is the disabled predicate.
 * - **AX** — every machine registers itself, and the whole fleet is readable from
 *   the DOM (`data-machines`) and from `window.__nbMachines()`. An agent that wants
 *   to know why a button is disabled asks the page, instead of screenshotting it.
 */

const MACHINES = new Map()
const MACHINE_LOG_MAX = 24

const machineWarn = (msg, extra) => {
  try { console.warn(`[machine] ${msg}`, extra === undefined ? '' : extra) } catch (e) { /* no console */ }
}

/** Publish the fleet for agents: `{"turn":"asking","jobs":{"mind_map":"running"}}`. */
const publishMachines = () => {
  try {
    const out = {}
    MACHINES.forEach((m, name) => {
      const cut = name.indexOf(':')
      if (cut > 0) {
        const group = name.slice(0, cut)
        const leaf = name.slice(cut + 1)
        if (!out[group] || typeof out[group] !== 'object') out[group] = {}
        out[group][leaf] = m.state
      } else { out[name] = m.state }
    })
    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-machines', JSON.stringify(out))
    }
  } catch (e) { /* not attached yet */ }
}

/**
 * Create a machine. `spec.states[state]` may declare:
 *   on:    { EVENT: 'nextState' | { target, guard, action } }
 *   enter: (ctx, machine) => cleanup   — runs on entry, cleanup on exit
 *   tags:  ['busy']                    — derived booleans the UI may read
 *   final: true                        — nothing may leave it (END still allowed)
 */
function Machine(name, spec) {
  const states = spec.states || {}
  const initial = spec.initial || Object.keys(states)[0]
  if (!states[initial]) throw new Error(`machine ${name}: initial state "${initial}" is not declared`)

  let state = initial
  let ctx = Object.assign({}, spec.context || {})
  let cleanup = null
  const subs = new Set()
  const log = []

  const record = (entry) => {
    log.push(entry)
    if (log.length > MACHINE_LOG_MAX) log.shift()
  }

  const transitionFor = (from, event) => {
    const node = states[from] || {}
    const raw = (node.on || {})[event]
    if (!raw) return null
    return typeof raw === 'string' ? { target: raw } : raw
  }

  const machine = {
    name,
    get state() { return state },
    get ctx() { return ctx },
    /** Derived booleans for the current state — what the UI is allowed to ask. */
    get tags() { return (states[state] || {}).tags || [] },
    tag(t) { return ((states[state] || {}).tags || []).indexOf(t) >= 0 },
    matches() { return Array.prototype.slice.call(arguments).indexOf(state) >= 0 },
    can(event) { return !!transitionFor(state, event) },
    /** Every event that would move the machine right now — the AX/DX surface. */
    available() {
      const node = states[state] || {}
      return Object.keys(node.on || {}).filter((ev) => {
        const t = transitionFor(state, ev)
        return !!t && (!t.guard || !!t.guard(ctx))
      })
    },
    send(event, payload) {
      const t = transitionFor(state, event)
      if (!t) {
        // refused, never thrown: a late response after CANCEL is normal, and a
        // page must not die for it. The refusal is recorded so a person can see it.
        record({ at: Date.now(), event, from: state, to: null, payload: undefined })
        machineWarn(`${name}: "${event}" not allowed in "${state}"`)
        return false
      }
      if (t.guard && !t.guard(ctx, payload)) {
        record({ at: Date.now(), event, from: state, to: null, refused: 'guard' })
        return false
      }
      const from = state
      if (cleanup) { try { cleanup() } catch (e) { machineWarn(`${name}: exit cleanup threw`, e) } cleanup = null }
      // state moves BEFORE the action runs: an action is allowed to send a
      // follow-up event (a lane finishing can drain the queue), and that nested
      // send must see the machine in its new state, not the old one
      state = t.target
      if (typeof t.action === 'function') {
        try { const patch = t.action(ctx, payload, machine); if (patch && typeof patch === 'object') Object.assign(ctx, patch) }
        catch (e) { machineWarn(`${name}: action for ${event} threw`, e) }
      }
      record({ at: Date.now(), event, from, to: state })
      const node = states[state] || {}
      if (typeof node.enter === 'function') {
        try { cleanup = node.enter(ctx, machine) || null }
        catch (e) { machineWarn(`${name}: enter ${state} threw`, e) }
      }
      publishMachines()
      subs.forEach((fn) => { try { fn(machine) } catch (e) { machineWarn(`${name}: subscriber threw`, e) } })
      return true
    },
    /** Replace context without a transition (a clock tick, a payload refresh). */
    set(patch) {
      if (!patch) return
      Object.assign(ctx, patch)
      subs.forEach((fn) => { try { fn(machine) } catch (e) { /* swallowed above */ } })
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
    /** Drop a per-instance machine from the fleet (component unmount). */
    dispose() {
      if (cleanup) { try { cleanup() } catch (e) { /* already gone */ } cleanup = null }
      subs.clear()
      MACHINES.delete(name)
      publishMachines()
    },
    /** For people and agents: what happened, in order, without a debugger. */
    history() { return log.slice() },
    snapshot() {
      return {
        state,
        tags: machine.tags,
        available: machine.available(),
        ctx: JSON.parse(JSON.stringify(ctx, (k, v) => (typeof v === 'function' ? '[fn]' : v))),
        recent: log.slice(-6)
      }
    }
  }

  const node = states[initial] || {}
  if (typeof node.enter === 'function') {
    try { cleanup = node.enter(ctx, machine) || null } catch (e) { machineWarn(`${name}: enter ${initial} threw`, e) }
  }
  MACHINES.set(name, machine)
  publishMachines()
  return machine
}

/** The fleet, for `window.__nbMachines()` and the gates. */
const machineFleet = () => {
  const out = {}
  MACHINES.forEach((m, name) => { out[name] = m.snapshot() })
  return out
}

/** React binding: re-render on transition, return the machine itself. */
function useMachine(m) {
  const [, bump] = useState(0)
  useEffect(() => {
    const off = m.subscribe(() => bump((n) => n + 1))
    return () => { off() }
  }, [m])
  return m
}

if (typeof window !== 'undefined') {
  window.__nbMachines = machineFleet
  window.__nbMachine = (name) => (MACHINES.get(name) || null)
}

/* ---------------------------------------------------------------- the fleet
 * Small, single-purpose machines, declared where their concern lives. This map
 * only records what each one is for, so the docs and the gates agree.
 */
const MACHINE_DOCS = {
  studio: 'one /state fetch: loading → ready | error, and reload while ready',
  jobs: 'artifact generation, one lane per kind: idle → running → done | failed',
  turn: 'one chat question: idle → asking → (answered) idle | failed, cancellable',
  overview: 'the notebook opener text: idle → loading → ready | failed (retry)',
  search: 'passage search: closed → typing → searching → results | error',
  discover: 'source discovery: idle → searching → results | error, per-candidate add',
  player: 'audio/video playback: idle → loading → playing → paused | ended | error',
  dialogs: 'at most one modal surface: closed → newNotebook | settings | addSource | discover'
}

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
  // a blueprint reads as a plan view, not a bar chart: three stacked
  // zones with a column split, which is what the poster actually is
  blueprint: 'M3 4h18v16H3V4Zm0 5h18M9 9v11M14 9v11M3 15h18',
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
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5v-9Zm7 3v3',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
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
  stop: 'M7 7h10v10H7V7Z',
  tag: 'M4 4h6.6L20 13.4a2 2 0 0 1 0 2.8l-3.8 3.8a2 2 0 0 1-2.8 0L4 10.6V4Zm4.6 3.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  pin: 'M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6m-6 4v6',
  pencil: 'M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17v3Zm9.5-11.5 2 2',
  shuffle: 'M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5'
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

/* Generative notebook sigil — abstract SVG seeded by the notebook id, so every
 * notebook gets a stable, unique piece of generative art instead of a literal
 * icon. Deterministic: same id, same sigil, forever. */
function _sigHash(str) {
  let h = 2166136261
  const s = String(str || 'notebook')
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function _sigRnd(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function sigHue(seed) {
  return _sigHash(seed) % 360
}
function Sigil({ seed, size = 44, draw = false }) {
  const rnd = _sigRnd(_sigHash(seed))
  const hue = Math.floor(rnd() * 360)
  const out = []
  for (let i = 0; i < 3; i += 1) {
      const y1 = 10 + rnd() * 30
      const y2 = 10 + rnd() * 30
      const cx = 10 + rnd() * 28
      const h2 = (hue + i * 47 + Math.floor(rnd() * 36)) % 360
      out.push(el('path', {
        key: `r${i}`,
        pathLength: 1,
        d: `M -6 ${y1.toFixed(1)} C ${cx.toFixed(1)} ${(y1 - 16 - rnd() * 12).toFixed(1)}, ` +
           `${(54 - cx).toFixed(1)} ${(y2 + 16 + rnd() * 12).toFixed(1)}, 54 ${y2.toFixed(1)}`,
        fill: 'none',
        stroke: `hsl(${h2} 72% 66% / ${(0.45 + rnd() * 0.35).toFixed(2)})`,
        strokeWidth: (1.4 + rnd() * 2.4).toFixed(2),
        strokeLinecap: 'round'
      }))
    }
    for (let i = 0; i < 2; i += 1) {
      out.push(el('circle', {
        key: `n${i}`,
        cx: (8 + rnd() * 32).toFixed(1), cy: (8 + rnd() * 32).toFixed(1),
        r: (1.5 + rnd() * 2.6).toFixed(2),
        fill: `hsl(${(hue + 150 + i * 70) % 360} 70% 72% / 0.85)`
      }))
    }
    return el('svg', {
      width: size, height: size, viewBox: '-6 -6 60 60',
      'aria-hidden': 'true', focusable: 'false',
      className: draw ? 'nb-sigil-draw' : undefined,
      style: { display: 'block' },
      children: out
    })
}

/* -------------------------------------------------------------- primitives */

function Btn({ children, icon, variant, size, onClick, disabled, title, type = 'button', className, style, ...rest }) {
  return el('button', {
    type, className: cx('nb-btn', className), 'data-variant': variant, 'data-size': size,
    onClick, disabled, title, style, 'aria-label': rest['aria-label'],
    children: [icon ? jsx(Glyph, { name: icon, size: size === 'sm' ? 14 : 15 }) : null,
               children ? el('span', { children }) : null].filter(Boolean)
  })
}

function IconBtn({ icon, label, onClick, active, size = 16, disabled, className }) {
  return el('button', {
    type: 'button', className: cx('nb-icon', className), onClick, title: label, 'aria-label': label,
    disabled, 'data-active': active ? 'true' : 'false',
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

function SearchField({ value, onChange, placeholder, label, autoFocus }) {
  return el('div', { className: 'nb-field' },
    jsx(Glyph, { name: 'search', size: 14 }),
    el('input', {
      value, placeholder, 'aria-label': label || placeholder,
      // Preact sets .autoFocus as a property; a data attribute is what the dialog
      // can reliably find, and it is also what an agent can look for
      'data-autofocus': autoFocus ? 'true' : undefined, autoFocus: !!autoFocus,
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
      const target = root && (root.querySelector('[data-autofocus="true"],[autofocus]')
        || root.querySelector('input,textarea,button'))
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
      border: `1px solid ${T.line}`, borderRadius: '18px', padding: '22px',
      boxShadow: '0 24px 70px rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.25)'
    }
  },
  el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' } },
    el('div', { style: { flex: 1 } },
      el('div', { style: { fontSize: '17px', fontWeight: 650, letterSpacing: '-.01em' }, children: title })),
    jsx(IconBtn, { icon: 'close', label: 'Close dialog', onClick: onClose })
  ),
  children))
}

/* Copying is an ACTION, so it reports.
 *
 * Every call site used to wrap `navigator.clipboard.writeText(...)` in
 * try/catch. writeText returns a PROMISE, so a denied permission sailed past
 * the catch as an unhandled rejection, and the button said nothing either
 * way — the click looked broken in exactly the window where copying matters
 * most (the app's renderer, where the async clipboard can be refused).
 *
 * One helper, three outcomes with a sentence for each, and a selection-copy
 * fallback that works where the async API is refused. */
async function copyText(text, say) {
  const value = String(text == null ? '' : text)
  if (!value.trim()) { if (say) say('there is nothing to copy here'); return false }
  let told = false
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value)
      if (say) say('copied to the clipboard')
      return true
    }
  } catch { told = true /* refused — fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', 'true')
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const done = document.execCommand ? document.execCommand('copy') : false
    ta.remove()
    if (say) say(done ? 'copied to the clipboard'
      : 'this window will not let the page copy — select the text and press Ctrl+C')
    return !!done
  } catch {
    if (say) say(told ? 'this window will not let the page copy — select the text and press Ctrl+C'
      : 'could not reach the clipboard')
    return false
  }
}

/* ----------------------------------------------------------------- markdown
 * A small, honest renderer: headings, lists, tables, fenced code, quotes, and
 * bold/italic/code/inline-citation spans. Generated artifacts are markdown, and
 * shipping them as raw text in a "polished" viewer is the difference between a
 * product and a debug pane — but a full markdown library is not importable here.
 */
const INLINE = /(\*\*[^*]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[S\d+\]|\[[^\]]+\]\([^)]+\))/g

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
    // A zero-width emphasis ("**" or "__") escapes the pattern rarely, but when
    // it does React renders an empty span and the line collapses. Skip it.
    if (!tok || tok.length <= 2 || !tok.slice(1, -1).trim()) { last = m.index + tok.length; continue }
    if (tok.startsWith('**') || tok.startsWith('__')) {
      out.push(el('strong', { children: tok.slice(2, -2) }, k))
    } else if (tok.startsWith('`')) {
      out.push(el('code', { children: tok.slice(1, -1) }, k))
    } else if (tok.startsWith('~~')) {
      out.push(el('del', { children: tok.slice(2, -2) }, k))
    } else if (tok.startsWith('*') || tok.startsWith('_')) {
      out.push(el('em', { children: tok.slice(1, -1) }, k))
    } else if (/^\[S\d+\]$/.test(tok)) {
      const n = Number(tok.slice(2, -1))
      if (onCite) {
        out.push(el('button', {
          type: 'button', className: 'nb-inline-cite', title: `Open source S${n}`,
          'data-n': n,
          'aria-label': `Citation ${n} — open the source`,
          onClick: (e) => { e.stopPropagation(); onCite(n) },
          children: tok
        }, k))
      } else out.push(el('span', { className: 'nb-inline-cite', children: tok }, k))
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      // a URL containing ")" breaks the match; the text is still worth showing,
      // so fall back to it instead of throwing and blanking the whole answer
      if (!mm) out.push(tok)
      else out.push(el('a', {
        href: mm[2], target: '_blank', rel: 'noreferrer', style: { color: T.accent },
        children: mm[1]
      }, k))
    }
    last = m.index + tok.length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

function messageText(text) {
  // The answer arrives as a string; older threads and a few artifact fields
  // carry objects. Stringing those renders "[object Object]" in the bubble,
  // which reads as leaked internals — take the one field that is text, or
  // nothing at all.
  if (text === null || text === undefined) return ''
  if (typeof text === 'string') return text
  if (typeof text === 'number' || typeof text === 'boolean') return String(text)
  if (typeof text === 'object') {
    for (const key of ['text', 'answer', 'content', 'markdown', 'value', 'summary']) {
      if (typeof text[key] === 'string') return text[key]
    }
    return ''          // no renderable text key: drop it rather than print debris
  }
  return ''
}

function Markdown({ text, onCite, className }) {
  const blocks = useMemo(() => parseBlocks(messageText(text)), [text])
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
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { blocks.push({ t: 'hr' }); i += 1; continue }
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
  if (b.t === 'hr') return el('hr', { key })
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

/* One `/state` fetch is a machine, not three booleans: `loading`, `error` and
 * `data` could previously disagree (error set, loading true, data stale) and a
 * slow reply from a previous notebook could land on the current one. The machine
 * refuses both: refreshes carry a generation, and only the newest generation may
 * settle a load. */
const STUDIO = Machine('studio', {
  initial: 'loading',
  context: { data: null, error: '', gen: 0 },
  states: {
    loading: {
      tags: ['busy'],
      on: {
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) },
        FAILED: { target: 'error', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ error: p.message }) }
      }
    },
    ready: {
      on: {
        // a silent refresh keeps the current data on screen; a full one shows the
        // skeleton, because the caller asked for that
        REFRESH_SOFT: 'refreshing',
        REFRESH_FULL: 'loading',
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) }
      }
    },
    refreshing: {
      tags: ['busy', 'stale'],
      on: {
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) },
        FAILED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ error: p.message }) },
        REFRESH_FULL: 'loading'
      }
    },
    error: {
      on: {
        REFRESH_FULL: 'loading',
        REFRESH_SOFT: 'loading',
        LOADED: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                  action: (c, p) => ({ data: p.data, error: '' }) }
      }
    }
  }
})

/** `nb` scopes it to a notebook, `thread` to a conversation. */
function useStudio(nb, thread) {
  const m = useMachine(STUDIO)
  const scope = useRef({ nb, thread })
  scope.current = { nb, thread }
  const load = useCallback(async (silent) => {
    const { nb: n, thread: t } = scope.current
    const gen = STUDIO.ctx.gen + 1
    STUDIO.set({ gen })
    // the first load starts in `loading`; only later loads need a refresh event
    if (silent && STUDIO.can('REFRESH_SOFT')) STUDIO.send('REFRESH_SOFT')
    else if (STUDIO.can('REFRESH_FULL')) STUDIO.send('REFRESH_FULL')
    try {
      const next = await api(`/state${n ? `?${qs({ notebook: n, thread: t || '' })}` : ''}`)
      STUDIO.send('LOADED', { data: next, gen })
      return next
    } catch (e) {
      STUDIO.send('FAILED', { message: e.message || String(e), gen })
      return null
    }
  }, [nb, thread])
  useEffect(() => {
    // a scope change is a new load; the machine's generation guard drops the old one
    load(false)
  }, [load])
  return {
    data: m.ctx.data,
    error: m.ctx.error,
    loading: m.matches('loading'),
    refreshing: m.matches('refreshing'),
    reload: load,
    setData: (d) => STUDIO.set({ data: d })
  }
}

/* ------------------------------------------------------------------- kinds */
const KIND_ICON = {
  video_overview: 'video', audio_overview: 'audio', summary: 'summary',
  briefing_doc: 'doc', study_guide: 'study', faq: 'faq', timeline: 'timeline',
  mind_map: 'mindmap', flashcards: 'cards', quiz: 'quiz', slides: 'slides',
  infographic: 'chart', data_table: 'grid',
  blueprint_evolution: 'blueprint'
}

/* Studio groups — the workbench sorts outputs by what they make, so its group
 * headers need a glyph per family rather than one generic icon. */
const GROUP_ICON = { media: 'play', docs: 'doc', study: 'cards', visual: 'image', other: 'grid' }

const SRC_ICON = {
  url: 'globe', youtube: 'video', file: 'file', text: 'note', image: 'image',
  pdf: 'file', note: 'note', audio: 'audio',
  docx: 'doc', pptx: 'slides', xlsx: 'chart', epub: 'book', ipynb: 'notebook',
  code: 'terminal', markdown: 'doc', csv: 'chart'
}

/** What a person calls the source's type — NotebookLM shows "Website",
 *  "YouTube", "PDF"…; ours are the extractor's kind ids. */
const KIND_LABEL = {
  url: 'web', youtube: 'youtube', note: 'note', text: 'pasted text',
  pdf: 'pdf', docx: 'docx', pptx: 'slides', xlsx: 'sheet', epub: 'ebook',
  ipynb: 'notebook', image: 'image', file: 'file', audio: 'audio'
}
const kindLabel = (k) => KIND_LABEL[k] || k || 'file'

/** NotebookLM-style identity: a stable 3D-emoji per notebook id. */
const NB_EMOJI = ['📓', '🧠', '🔬', '📚', '🛰️', '⚛️', '🌱', '🏛️', '🎧', '🧪',
  '📈', '🗺️', '🧭', '💡', '🏥', '⚖️']
const hashStr = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const emojiFor = (id, custom) => (custom && String(custom).trim()) || NB_EMOJI[hashStr(id || 'nb') % NB_EMOJI.length]
const dshort = (stamp) => {
  const d = stamp ? new Date(stamp) : null
  return d && !isNaN(d) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
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

const OPT_LABEL = { focus: 'focus', count_hint: 'amount', format: 'format', length: 'length', language: 'language', style: 'style' }
/** "focus: fusion economics · format: brief" — what a tailored run asked for. */
const optsSummary = (opts) => Object.keys(opts || {})
  .filter((k) => opts[k])
  .map((k) => `${OPT_LABEL[k] || k}: ${String(opts[k]).slice(0, 48)}`)
  .join(' · ')

/* ------------------------------------------------------------- state machines
 *
 * The app's de-facto state machines, made explicit. Before this module the
 * same invariants were enforced by convention across scattered useState
 * setters — legal-looking calls could produce impossible screens (a "view"
 * tab with no artifact, two modal dialogs stacked, a peek tab with no
 * source). Each machine below is a pure transition table: state + event →
 * next state (return null/undefined to reject the event). React binds them
 * with useReducer in 30-shell.js; nothing here touches the DOM, so the
 * tables are unit-testable in plain node (tests/machine.test.mjs).
 *
 * ATLAS — every implicit machine found in the app, and its disposition:
 *
 *   M1  center view      tab{chat,view,peek} × picked artifact × peeked
 *                        source — three useStates that had to agree.
 *                        → VIEW_FSM (migrated; was the spine, most drift risk)
 *   M2  overlays         srcDialog / newNb / renNb / searchOpen — four
 *                        independent dialog flags, no exclusivity.
 *                        → dialogs machine (src/05-machine.js; fixes stacked
 *                          modals and is visible to agents)
 *   M3  chat thread      thread/msgs/pending + overview{idle,loading,ready,
 *                        error} + suggestions lifecycle — component-local,
 *                        consistent today; migrate if it grows transitions.
 *   M4  generation       busy{kind→startedAt} per studio card + reload
 *                        polling — implicit but single-direction.
 *   M5  add-source dlg   mode{url,text,find,note} × cands/sel/adding/added —
 *                        nested machine inside one dialog; self-contained.
 *   M6  audio player     playing/t/dur/rate × editing/draft/rendering —
 *                        viewer-local, orthogonal substates.
 *   M7  ops panels       per-panel state{idle,busy,done,error} — repeated
 *                        shape, already honest about failures.
 *   M8  viewer chrome    zoom/pan, slide index, quiz index, table sort —
 *                        pure UI state, no cross-component invariants.
 *
 * Decision: migrate only the spine (M1+M2) where illegal combinations were
 * representable and transitions were copy-pasted. The rest are local,
 * consistent, and cheap — the pattern is here when they need it.
 */

/* createMachine(spec) → { initial, step(state, event) }
 * spec.transitions[event.type] is (state, event) => nextState | null.
 * Returning null/undefined rejects the event: state passes through
 * unchanged, so guards live inside the table where they can be read. */
export function createMachine(spec) {
  return {
    initial: spec.initial,
    step(state, event) {
      const fn = spec.transitions[event && event.type]
      if (!fn) return state
      const next = fn(state, event)
      return next == null ? state : next
    }
  }
}

/* M1 — center view. `tab` is the visible pane; `artifact` and `source` are
 * per-room selections that persist while another tab is showing (switching
 * Chat → Viewer → Chat must not lose the open artifact). Illegal combos
 * self-heal: clearing the selection under its own tab falls back to chat,
 * and tab switches are guarded by the selection they require. */
export const VIEW_FSM = createMachine({
  initial: { tab: 'chat', artifact: null, source: null },
  transitions: {
    TAB_CHAT: (s) => ({ ...s, tab: 'chat' }),
    TAB_TENSIONS: (s) => ({ ...s, tab: 'tensions' }),
    TAB_VIEW: (s) => (s.artifact ? { ...s, tab: 'view' } : s),
    TAB_PEEK: (s) => (s.source ? { ...s, tab: 'peek' } : s),
    OPEN_ARTIFACT: (s, e) => ({ tab: 'view', artifact: e.artifact, source: s.source }),
    OPEN_SOURCE: (s, e) => ({ tab: 'peek', artifact: s.artifact, source: e.source }),
    STEP_ARTIFACT: (s, e) => ({
      ...s, artifact: e.artifact,
      tab: s.tab === 'view' && !e.artifact ? 'chat' : s.tab
    }),
    STEP_SOURCE: (s, e) => ({
      ...s, source: e.source,
      tab: s.tab === 'peek' && !e.source ? 'chat' : s.tab
    }),
    RESET_VIEW: () => ({ tab: 'chat', artifact: null, source: null })
  }
})

/* M2 — modal overlays live in src/05-machine.js as the `dialogs` machine: same
 * exclusivity rule, but stateful and published to the agent fleet
 * (`window.__nbMachines().dialogs`), so an agent can read which surface is open.
 * The lesson from this table survives: OPEN_SEARCH is a passive global shortcut
 * and must not discard a half-typed draft — the dialogs machine guards it.
 */

/* ------------------------------------------------------------------ shell */

/* Artifact generation used to be one `busy` object mutated in four places. Now a
 * lane per kind: starting a run while it is already running is refused (it used to
 * fire a second request), and the map the UI reads is derived, not stored. */
const JOBS = Machine('jobs', {
  initial: 'idle',
  context: { lanes: {} },
  states: {
    idle: {
      on: { RUN: { target: 'active', action: (c, p) => { c.lanes[p.kind] = p.at || Date.now() } } }
    },
    active: {
      tags: ['busy'],
      on: {
        RUN: { target: 'active',
               guard: (c, p) => !c.lanes[p.kind],
               action: (c, p) => { c.lanes[p.kind] = p.at || Date.now() } },
        FINISH: { target: 'active', action: (c, p) => {
          delete c.lanes[p.kind]
          if (!Object.keys(c.lanes).length) return undefined
        } },
        SETTLE: { target: 'idle', guard: (c) => !Object.keys(c.lanes).length }
      }
    }
  }
})

/* Modal surfaces used to be four independent booleans, so a search could open on
 * top of the settings dialog and Escape closed whichever effect ran last. One
 * machine owns "at most one modal", and the booleans are derived from it. */
const DIALOGS = Machine('dialogs', {
  initial: 'closed',
  context: { payload: null },
  states: {
    closed: {
      on: { OPEN: { target: 'open', guard: (c, p) => !!(p && p.surface),
                    action: (c, p) => ({ payload: { surface: p.surface, data: p.data || null } }) } }
    },
    open: {
      on: {
        // Search is a passive global shortcut (Ctrl+K). Opening it over a
        // half-typed add-source draft would silently discard the draft, so it is
        // only allowed when nothing is open — the same rule the view reducer's
        // author arrived at independently.
        OPEN: { target: 'open',
                guard: (c, p) => !!(p && p.surface) &&
                  (p.surface !== 'search' || !c.payload || c.payload.surface === 'search'),
                action: (c, p) => ({ payload: { surface: p.surface, data: p.data || null } }) },
        // a stale close must not dismiss the surface somebody just opened
        CLOSE: { target: 'closed', guard: (c, p) => !p || !p.surface || (c.payload && c.payload.surface === p.surface),
                 action: () => ({ payload: null }) }
      }
    }
  }
})

function App() {
  const [mode, setMode] = useState(() => persist.get('mode', 'home'))
  const [nb, setNb] = useState(() => persist.get('notebook', ''))
  // Which conversation is open, remembered per notebook so a reload lands people
  // back in the thread they were reading.
  const [threadName, setThreadName] = useState(() => persist.get('thread', ''))
  const studio = useStudio(nb, threadName)
  useEffect(() => {
    if (!nb) return
    const saved = persist.get(`thread.${nb}`, '')
    setThreadName(saved || '')
  }, [nb])
  // M1 — the center view (tab × artifact × peeked source) is a pure transition
  // table (src/25-machine.js). An illegal combination cannot be represented, and
  // clearing a selection under its own tab self-heals to chat instead of stranding
  // an empty pane behind a tab that claims content.
  const [view, viewSend] = useReducer(VIEW_FSM.step, VIEW_FSM.initial)
  const { tab, artifact: picked, source: peek } = view
  // setter-shaped adapters: every downstream prop keeps its old name and shape
  const setTab = useCallback((t) => viewSend({
    type: t === 'view' ? 'TAB_VIEW'
      : t === 'peek' ? 'TAB_PEEK'
        : t === 'tensions' ? 'TAB_TENSIONS' : 'TAB_CHAT'
  }), [])
  const setPicked = useCallback((a) => viewSend({ type: 'STEP_ARTIFACT', artifact: a }), [])
  const setPeek = useCallback((src) => viewSend({ type: 'STEP_SOURCE', source: src }), [])
  const jobs = useMachine(JOBS)
  const busy = jobs.ctx.lanes                      // kind -> startedAt (ms)
  const [note, setNote] = useState('')
  const [askOpen, setAskOpen] = useState(0)        // bump to focus the composer
  const dialogs = useMachine(DIALOGS)
  const surface = dialogs.matches('open') && dialogs.ctx.payload ? dialogs.ctx.payload.surface : ''
  const openSurface = useCallback((name, data) => DIALOGS.send('OPEN', { surface: name, data }), [])
  const closeSurface = useCallback((name) => DIALOGS.send('CLOSE', { surface: name }), [])
  const setSrcDialog = useCallback((v) => (v ? openSurface('addSource', v) : closeSurface('addSource')), [openSurface, closeSurface])
  const setNewNb = useCallback((v) => (v ? openSurface('newNotebook') : closeSurface('newNotebook')), [openSurface, closeSurface])
  const setRenNb = useCallback((v) => (v ? openSurface('settings', v) : closeSurface('settings')), [openSurface, closeSurface])
  const srcDialog = surface === 'addSource' ? (dialogs.ctx.payload.data || {}) : null
  const newNb = surface === 'newNotebook'
  const renNb = surface === 'settings' ? (dialogs.ctx.payload.data || null) : null
  const [filter, setFilter] = useState('all')
  const [railOpen, setRailOpen] = useState(() => persist.get('rail', '1') !== '0')
  const [studioOpen, setStudioOpen] = useState(() => persist.get('studio', '1') !== '0')
  // A panel may be folded by DENSITY only if the reader can unfold it, otherwise
  // the choice is a dead end. These two flags record "the user has an opinion",
  // and from then on the density heuristic stops overriding it.
  const [railTouched, setRailTouched] = useState(false)
  const [studioTouched, setStudioTouched] = useState(false)
  const [size, setSize] = useState(0)
  const [opsStats, setOpsStats] = useState(null)
  const setSearchOpen = useCallback((v) => (v ? openSurface('search') : closeSurface('search')), [openSurface, closeSurface])
  const searchOpen = surface === 'search' 

  // palette/deep links can ask for a surface: ?surface=ops opens the lab deck
  useEffect(() => {
    try {
      const want = new URLSearchParams(window.location.search).get('surface')
      if (want === 'ops' || want === 'studio' || want === 'home') setMode(want)
    } catch { /* no location in this host */ }
  }, [])

  const say = useCallback((msg) => {
    setNote(msg)
    const t = setTimeout(() => setNote(''), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { persist.set('mode', mode) }, [mode])
  useEffect(() => { persist.set('notebook', nb) }, [nb])
  useEffect(() => { persist.set('rail', railOpen ? '1' : '0') }, [railOpen])
  useEffect(() => { persist.set('studio', studioOpen ? '1' : '0') }, [studioOpen])

  const data = studio.data
  const notebook = data && data.notebook
  const kinds = (data && data.kinds) || []

  // Ctrl/Cmd+K → notebook search (NotebookLM's global find)
  // Ctrl/Cmd+\\ → fold the make drawer (reading a timeline or a slide wants the
  //   canvas, and a 380px panel that cannot be dismissed from the keyboard is a
  //   permanent tax on the reading width).
  useEffect(() => {
    const onKey = (e) => {
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && String(e.key).toLowerCase() === 'k') {
        if (mode === 'studio' && notebook) { e.preventDefault(); setSearchOpen(true) }
        return
      }
      if (cmd && e.key === '\\') {
        if (mode === 'studio' && notebook) { e.preventDefault(); setStudioOpen((v) => !v) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mode, notebook])

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

  const generate = useCallback(async (kind, opts) => {
    if (!notebook) return
    if (!JOBS.can('RUN')) { say(`${kind.replace(/_/g, ' ')} is already running`); return }
    if (!JOBS.send('RUN', { kind })) { say(`${kind.replace(/_/g, ' ')} is already running`); return }
    try {
      await api('/generate', {
        method: 'POST',
        body: { notebook: notebook.id, kind, length: 'short', ...(opts || {}) },
        // Measured on a six-source notebook: a timeline returns in ~117s, a
        // study guide in ~239s. At 240s the page gave up on the slowest kinds
        // while the server kept generating, so the artifact appeared later with
        // a "failed" toast next to it. The progress pill already shows elapsed
        // time, so waiting is visible rather than silent.
        timeoutMs: 420000
      })
      const fresh = await studio.reload(true)
      const target = fresh && fresh.notebook && fresh.notebook.artifacts
        ? fresh.notebook.artifacts.find((a) => a.kind === kind) : null
      if (target) { setPicked(target); setTab('view') }
      say(`${kind.replace(/_/g, ' ')} ready`)
    } catch (e) {
      say(`${kind.replace(/_/g, ' ')} failed: ${e.message || e}`)
    } finally {
      JOBS.send('FINISH', { kind })
      JOBS.send('SETTLE')
    }
  }, [notebook, studio, say])

  // NotebookLM-style tagging: one click re-runs the model's auto-label pass
  // over anything that arrived without labels (the /label route).
  const labelSources = useCallback(async () => {
    if (!nb) return
    try {
      await api('/label', { method: 'POST', body: { notebook: nb }, timeoutMs: 180000 })
      await studio.reload(true)
      say('sources labelled')
    } catch (e) {
      say(`labelling failed: ${e.message || e}`)
    }
  }, [nb, studio, say])

  const openSource = useCallback((s) => { setPeek(s); setTab('peek') }, [])
  const openAddSource = useCallback((opts) => setSrcDialog(opts || { mode: 'find' }), [])

  // drag files onto the sources rail → same ingest path as the upload picker
  const dropSources = useCallback(async (files) => {
    if (!nb || !files || !files.length) return
    let added = 0, skipped = 0
    for (const f of files) {
      try {
        let body = null
        if (f.path) body = { notebook: nb, path: f.path, title: f.name }
        else if (f.size && f.size <= 1500000) body = { notebook: nb, text: await f.text(), title: f.name }
        if (!body) { skipped += 1; continue }
        await api('/source', { method: 'POST', body, timeoutMs: 120000 })
        added += 1
      } catch { skipped += 1 }
    }
    if (added) await studio.reload(true)
    if (added && !skipped) say(`added ${added} source${added === 1 ? '' : 's'} from dropped files`)
    else if (added) say(`added ${added} source${added === 1 ? '' : 's'} — ${skipped} file${skipped === 1 ? '' : 's'} skipped (too large or unreadable)`)
    else say('dropped files could not be read — use Add source for paths or large files')
  }, [nb, studio, say])

  // NotebookLM's per-source checkbox: the /source_state reply carries the fresh
  // notebook payload — merge it over the current state instead of a full reload.
  const toggleSource = useCallback(async (s) => {
    if (!nb || !s || !s.id) return
    try {
      const out = await api('/source_state', {
        method: 'POST',
        body: { notebook: nb, source_id: s.id, enabled: s.active === false },
        timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
    } catch (e) { say(`could not update source: ${e.message || e}`) }
  }, [nb, studio, say])

  // one /source_state call for a whole set — folder checkboxes and select-all
  // share it (the reply carries the fresh notebook payload like toggleSource)
  const applySourceStates = useCallback(async (list, enabled) => {
    if (!nb || !list || !list.length) return
    try {
      const out = await api('/source_state', {
        method: 'POST',
        body: { notebook: nb, source_ids: list.map((s) => s.id), enabled },
        timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
    } catch (e) { say(`could not update sources: ${e.message || e}`) }
  }, [nb, studio, say])

  const toggleAllSources = useCallback(async () => {
    const sources = (notebook && notebook.sources) || []
    if (!sources.length) return
    const allOn = sources.every((s) => s.active !== false)
    await applySourceStates(sources, !allOn)
  }, [notebook, applySourceStates])

  // folder checkbox: all-on turns the folder off; anything else turns it on
  const toggleGroupSources = useCallback(async (list) => {
    if (!list || !list.length) return
    const allOn = list.every((s) => s.active !== false)
    await applySourceStates(list, !allOn)
  }, [applySourceStates])

  // removing a source/artifact returns the fresh notebook payload — merge it
  // like toggleSource does, and close any viewer pointed at the deleted thing.
  const deleteSource = useCallback(async (s) => {
    if (!nb || !s || !s.id) return
    try {
      const out = await api('/source/delete', {
        method: 'POST',
        body: { notebook: nb, source_id: s.id }, timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
      if (peek && peek.id === s.id) setPeek(null)
      say(`removed “${s.title || s.id}”`)
    } catch (e) { say(`could not remove source: ${e.message || e}`) }
  }, [nb, studio, say, peek])

  const deleteArtifact = useCallback(async (a) => {
    if (!nb || !a || !a.key) return
    try {
      const out = await api('/artifact/delete', {
        method: 'POST',
        body: { notebook: nb, key: a.key }, timeoutMs: 30000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
      if (picked && picked.key === a.key) setPicked(null)
      say('artifact deleted')
    } catch (e) { say(`could not delete artifact: ${e.message || e}`) }
  }, [nb, studio, say, picked])

  // viewer-side edits (rename) change the run row — re-resolve `picked` from
  // fresh state so the open artifact doesn't keep showing stale metadata
  const refreshArtifact = useCallback(async () => {
    const fresh = await studio.reload(true)
    const arts = fresh && fresh.notebook && fresh.notebook.artifacts
    if (!arts) return
    if (picked) {
      const hit = arts.find((a) => a.key === picked.key)
      setPicked(hit || null)
    }
  }, [studio, picked])

  const refreshSource = useCallback(async (s) => {
    if (!nb || !s || !s.id) return
    try {
      const out = await api('/source/refresh', {
        method: 'POST',
        body: { notebook: nb, source_id: s.id }, timeoutMs: 180000
      })
      if (out && out.state && studio.data) {
        studio.setData({ ...studio.data, notebook: out.state })
      } else {
        await studio.reload(true)
      }
      if (out && out.source && peek && peek.id === s.id) {
        setPeek({ ...peek, ...out.source })
      }
      say(`“${s.title || s.id}” refreshed`)
    } catch (e) { say(`refresh failed: ${e.message || e}`) }
  }, [nb, studio, say, peek])

  // ---------------------------------------------------------------- threads
  const openThread = useCallback((name) => {
    setThreadName(name)
    if (nb) persist.set(`thread.${nb}`, name)
  }, [nb])

  const newThread = useCallback(async (title) => {
    if (!nb) return
    try {
      const out = await api('/thread/new', {
        method: 'POST',
        body: { notebook: nb, title: title || '' },
        timeoutMs: 30000
      })
      const name = out && out.thread ? out.thread.name : ''
      if (name) openThread(name)
      await studio.reload(true)
      say('new conversation started')
    } catch (e) { say(`could not start a conversation: ${e.message || e}`) }
  }, [nb, openThread, studio, say])

  const renameThread = useCallback(async (name, title) => {
    if (!nb) return
    try {
      await api('/thread/rename', {
        method: 'POST', body: { notebook: nb, thread: name, title }, timeoutMs: 30000
      })
      await studio.reload(true)
    } catch (e) { say(`could not rename: ${e.message || e}`) }
  }, [nb, studio, say])

  const deleteThread = useCallback(async (name) => {
    if (!nb) return
    try {
      const out = await api('/thread/delete', {
        method: 'POST', body: { notebook: nb, thread: name, confirm: true }, timeoutMs: 30000
      })
      if (out && out.next) openThread(out.next)
      await studio.reload(true)
      say('conversation deleted')
    } catch (e) { say(`could not delete: ${e.message || e}`) }
  }, [nb, openThread, studio, say])

  const threads = {
    name: threadName || (notebook && notebook.thread_name) || 'default',
    title: (notebook && notebook.thread_title) || 'Conversation',
    list: (notebook && notebook.threads) || [],
    onOpen: openThread, onNew: newThread, onRename: renameThread, onDelete: deleteThread
  }

  const deleteNotebook = useCallback(async (id) => {
    try {
      await api('/notebook/delete', {
        method: 'POST', body: { notebook: id, confirm: true }, timeoutMs: 30000
      })
      if (nb === id) setNb('')
      await studio.reload(true)
      say('notebook deleted')
    } catch (e) { say(`delete failed: ${e.message || e}`) }
  }, [nb, studio, say])

  const exportNotebook = useCallback(async () => {
    if (!notebook) return
    try {
      const out = await api(`/export?${qs({ notebook: notebook.id, b64: 1 })}`, { timeoutMs: 120000 })
      const raw = atob(out.b64 || '')
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
      const a = document.createElement('a')
      a.href = url; a.download = out.name || 'notebook.zip'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      say('notebook exported')
    } catch (e) { say(`export failed: ${e.message || e}`) }
  }, [notebook, say])

  const renameNotebook = useCallback(async (id, title, desc, emoji) => {
    try {
      await api('/notebook/update', {
        method: 'POST',
        body: { notebook: id, title, description: desc, emoji },
        timeoutMs: 30000
      })
      await studio.reload(true)
      say('notebook updated')
    } catch (e) { say(`rename failed: ${e.message || e}`) }
  }, [studio, say])

  const duplicateNotebook = useCallback(async (id, openIt = true) => {
    try {
      const out = await api('/notebook/duplicate', {
        method: 'POST', body: { notebook: id }, timeoutMs: 120000
      })
      await studio.reload(true)
      say(`copied as “${(out.notebook && out.notebook.title) || 'new notebook'}”`)
      if (openIt && out.notebook && out.notebook.id) {
        setNb(out.notebook.id); setPicked(null); setPeek(null); setTab('chat'); setMode('studio')
      }
      return out.notebook
    } catch (e) { say(`copy failed: ${e.message || e}`); return null }
  }, [studio, say])

  const openNotebook = useCallback((id) => {
    // one event instead of the copy-pasted three-setter ritual
    setNb(id); viewSend({ type: 'RESET_VIEW' }); setMode('studio')
  }, [])

  // Measure the ROOT, not the viewport. The plugin lives inside the host's
  // window, so `@media (max-width:…)` measures the wrong thing: at a 1600px
  // window this root is 1340px, and at 1280px it is 1020px — where two fixed
  // panels (268 + 420) left the main pane 332px wide.
  // Which skin is this? The host never sets `color-scheme`, so `light-dark()`
  // would always resolve light even in a dark app. Read the host's own canvas
  // colour instead and publish a data attribute the stylesheet can branch on.
  const [themePref, setThemePref] = useState(() => persist.get('skin', 'auto'))
  const [detected, setDetected] = useState('dark')
  // "auto" follows the app's own canvas; the toggle pins one and remembers it.
  const skin = themePref === 'auto' ? detected : themePref
  useEffect(() => {
    const lum = (css) => {
      const m = String(css || '').match(/rgba?\(([^)]+)\)/)
      let r, g, b
      if (m) { const p = m[1].split(/[,\s\/]+/).filter(Boolean).map(Number); [r, g, b] = p }
      else {
        const hex = String(css || '').trim().replace('#', '')
        if (hex.length < 6) return null
        r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16)
      }
      if ([r, g, b].some((v) => Number.isNaN(v))) return null
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const read = () => {
      const cs = getComputedStyle(document.documentElement)
      const bg = cs.getPropertyValue('--ui-bg-primary') || cs.getPropertyValue('--background') || ''
      const l = lum(bg) ?? lum(getComputedStyle(document.body).backgroundColor)
      if (l !== null) setDetected(l > 0.35 ? 'light' : 'dark')
    }
    read()
    // React to the host swapping theme instead of polling for it: a class on
    // <html>, an injected stylesheet, or a style attribute are the three ways a
    // skin changes, and all three land here immediately. The interval is only a
    // backstop for a theme applied by canvas or by a CSS var set elsewhere.
    const mo = new MutationObserver(() => read())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    if (document.head) mo.observe(document.head, { childList: true, subtree: true })
    // 300ms, not 1.5s: a theme swap made between frames must land before the
    // next measurement, and this read is one getComputedStyle on the root
    const id = setInterval(read, 300)
    return () => { mo.disconnect(); clearInterval(id) }
  }, [])

  const rootRef = useRef(null)
  const [density, setDensity] = useState('wide')
  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    // Thresholds are chosen from the MAIN column this leaves, not from a round
    // number, and they are measured on the ROOT because the host shell's own
    // sidebar is not ours: a 1440 window hands this page ~1180, a 1280 window
    // ~1020. The old 1320/1100 pair therefore almost never picked "wide" — on a
    // 1440 laptop you got the 200px rail, and on a 1280 you got a rail-less
    // "tight" tier. Now: wide 268+420 needs 1250 to keep main >= 520; compact
    // 200+320 needs 1060 for the same; below that the rail folds and the Make
    // drawer keeps 300, because the artifacts are the product.
    const measure = (w) => {
      setSize(w)
      setDensity(w >= 1250 ? 'wide' : w >= 1060 ? 'compact' : 'tight')
    }
    measure(node.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) measure(e.contentRect.width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // Below 1060px of root the rail is a 216px sliver that holds ~70px of title,
  // and below 860 the Make drawer leaves the chat 224px. In those bands a panel
  // starts folded on the strength of the measurement alone — but only until the
  // reader touches it, at which point their choice is the one that stands.
  const railVisible = railOpen && (density !== 'tight' || railTouched)
  const studioVisible = studioOpen && (size >= 860 || studioTouched)

  const ops = mode === 'ops'
  const home = mode === 'home'
  const discoverMode = mode === 'discover'
  // Study and the workbench are notebook-scoped: with no notebook open they
  // render their own "pick or create one" state rather than an empty workspace,
  // and the surface switcher does not offer them at all.
  const studyMode = mode === 'study'

  return el('div', {
    ref: rootRef,
    className: 'nb-root', 'data-mode': mode, 'data-plugin': ID, 'data-density': density,
    'data-skin': skin,
    // the room takes on the notebook's colour: its sigil hue becomes the ambient
    // field behind every panel, and home keeps a fixed violet
    style: { '--nb-hue': sigHue(notebook ? notebook.id : 'hermes-home') }
  },
    el('style', { dangerouslySetInnerHTML: { __html: CSS } }),
    el('div', { className: 'nb-aurora', 'aria-hidden': 'true' },
      el('i', { className: 'nb-blob' }),
      el('i', { className: 'nb-blob' }),
      el('i', { className: 'nb-blob' })),
    el('header', { className: 'nb-bar' },
      el('div', { className: 'nb-brand' },
        el('span', { className: 'nb-mark' }, jsx(Glyph, { name: 'notebook', size: 15 })),
        el('span', { className: 'nb-brandname', children: 'Notebook' }),
        el('span', { className: 'nb-crumb' },
          ops
            ? el('b', { children: 'Lab Ops' })
            : home
              ? el('b', { children: 'All notebooks' })
              : discoverMode
                ? el('b', { children: 'Discover' })
                : studyMode
                  ? el('b', { children: 'Study' })
                : el('span', null, jsx(Glyph, { name: 'chevron', size: 12 }), ' ', notebook
                    ? el('button', {
                        type: 'button', className: 'nb-crumbedit',
                        onClick: () => setRenNb(notebook),
                        title: 'Notebook settings — rename, describe, pick an icon',
                        children: notebook.title
                      })
                    : el('b', { children: 'no notebook' })))
      ),
      el('div', { className: 'nb-spacer' }),
      // The bar switches WORKSPACE LAYOUTS, and it says which ones exist right
      // now: Home, Discover and Lab Ops are notebook-independent; Study and the
      // notebook workbench only appear once a notebook is actually open, so
      // nobody clicks into an empty state. (The right-hand drawer is a panel
      // inside the workbench, not a fourth copy of this switch — its heading is
      // "Make", so the word Studio names exactly one thing.)
      jsx(Seg, {
        label: 'Surface', value: mode,
        onChange: (v) => {
          if (v === 'studio' && !notebook) { setMode('home'); return }
          setMode(v)
        },
        // The gate is `notebook`, NOT the current mode. Gating on
        // `mode !== 'home'` meant that from Home the switcher offered only
        // Home / Discover / Lab Ops — so once you landed on Home with a
        // notebook open you could not get back to Studio at all, and the tab
        // row silently changed shape under the pointer.
        options: (notebook
          ? [
              { id: 'home', label: 'Home', icon: 'grid' },
              { id: 'studio', label: 'Studio', icon: 'notebook' },
              { id: 'study', label: 'Study', icon: 'cards' },
              { id: 'discover', label: 'Discover', icon: 'search' },
              { id: 'ops', label: 'Lab Ops', icon: 'server' }
            ]
          : [
              { id: 'home', label: 'Home', icon: 'grid' },
              { id: 'discover', label: 'Discover', icon: 'search' },
              { id: 'ops', label: 'Lab Ops', icon: 'server' }
            ])
      }),
      el('div', { className: 'nb-actions' },
        // Add-source lives in ONE place: the sources panel header. The nav used
        // to repeat it, so the same dialog had two triggers eight pixels apart.
        mode === 'studio' && notebook ? jsx(IconBtn, {
          icon: 'search', label: 'Search notebook (Ctrl+K)', onClick: () => setSearchOpen(true)
        }) : null,
        mode === 'studio' && notebook ? jsx(IconBtn, {
          icon: 'download', label: 'Export notebook (.zip)', onClick: exportNotebook
        }) : null,
        // one control, three states: follow the app, or pin a skin
        jsx(IconBtn, {
          icon: skin === 'dark' ? 'moon' : 'sun',
          label: `Theme: ${themePref === 'auto' ? 'follow the app' : themePref}. Click to change.`,
          onClick: () => {
            const next = themePref === 'auto' ? (skin === 'dark' ? 'light' : 'dark') : (themePref === 'light' ? 'dark' : 'auto')
            setThemePref(next)
            persist.set('skin', next)
          }
        }))
    ),

    ops
      ? jsx(OpsDeck, { onSay: say, onStats: setOpsStats })
      : home
        ? jsx(HomeDashboard, {
            data, onOpen: openNotebook, onNew: () => setNewNb(true),
            onDelete: deleteNotebook, onRename: renameNotebook,
            onDuplicate: (id) => duplicateNotebook(id, false)
          })
        : discoverMode
          ? jsx(DiscoverPanel, {
              notebook, onSay: say,
              reload: () => studio.reload(true)
            })
          : studyMode
            ? jsx(StudyPanel, {
                notebook, onSay: say,
                onOpenSource: (title) => {
                  const s = ((notebook && notebook.sources) || []).find(
                    (x) => (x.title || '').trim().toLowerCase() === String(title).trim().toLowerCase())
                  if (s) { setPeek({ ...s, citeSnippet: '' }); setTab('peek') }
                }
              })
          : el('div', { className: 'nb-body' },
            railVisible
              ? jsx(Rail, {
                  data, notebook,
                  onAddSource: () => openAddSource(), onOpenSource: openSource,
                  onToggleSource: toggleSource, onToggleAll: toggleAllSources,
                  onToggleGroup: toggleGroupSources,
                  onDeleteSource: deleteSource,
                  onLabel: labelSources,
                  onCollapse: () => { setRailTouched(true); setRailOpen(false) },
                  onGoHome: () => setMode('home'), onSay: say, onDropFiles: dropSources,
                  loading: studio.loading, error: studio.error, reload: studio.reload
                })
              : jsx(PanelToggles, { side: 'left',
                  onShow: () => { setRailTouched(true); setRailOpen(true) } }),
            jsx(Main, {
              notebook, kinds, tab, setTab, picked, setPicked, busy, generate,
              onAsk: () => setAskOpen((n) => n + 1), askOpen, onSay: say,
              reload: studio.reload, modelReady: data && data.model_ready,
              error: studio.error, loading: studio.loading,
              peek, setPeek, onOpenSource: openSource, onRefreshSource: refreshSource,
              refreshArtifact,
              onAddSource: openAddSource, onNewNotebook: () => setNewNb(true),
              onFindSources: (seed) => openAddSource({ mode: 'find', seed: seed || '' }),
              threads
            }),
            studioVisible
              ? jsx(StudioPanel, {
                  kinds, notebook, busy, generate, filter, setFilter,
                  onOpen: (art) => { setPicked(art); setTab('view') },
                  onDelete: deleteArtifact,
                  onCollapse: () => { setStudioTouched(true); setStudioOpen(false) },
                  onAddNote: () => openAddSource({ mode: 'note' })
                })
              : jsx(PanelToggles, { side: 'right',
                  onShow: () => { setStudioTouched(true); setStudioOpen(true) } })
          ),

    jsx(StatusBar, { mode, notebook, data, note, opsStats }),

    jsx(AddSourceDialog, {
      open: !!srcDialog, onClose: () => setSrcDialog(null), notebook,
      initialMode: srcDialog && srcDialog.mode,
      seedQuery: srcDialog && srcDialog.seed,
      noteOnly: !!(srcDialog && srcDialog.mode === 'note'),
      onDone: async (msg) => { setSrcDialog(null); await studio.reload(true); if (msg) say(msg) }
    }),
    jsx(SearchDialog, {
      open: searchOpen, onClose: () => setSearchOpen(false), notebook,
      onPick: (hit) => {
        const src = ((notebook && notebook.sources) || []).find((s) => s.id === hit.source_id)
        // carry the matched passage so the peek highlights it, like a citation
        if (src) { setPeek({ ...src, citeSnippet: hit.snippet || '' }); setTab('peek') }
        else say('that source is no longer in the notebook')
      }
    }),
    jsx(NewNotebookDialog, {
      open: newNb, onClose: () => setNewNb(false),
      onDone: async (id) => { setNewNb(false); if (id) { setNb(id); setPicked(null) } }
    }),
    renNb ? jsx(RenameDialog, {
      notebook: renNb, onClose: () => setRenNb(null),
      onDone: async (title, desc, emoji) => { setRenNb(null); await renameNotebook(renNb.id, title, desc, emoji) },
      onDuplicate: async () => { const id = renNb.id; setRenNb(null); await duplicateNotebook(id, true) }
    }) : null
  )
}

/* --------------------------------------------------------- home dashboard */

/* A notebook is a set of sources; the card has to say what is in it without
 * writing a sentence. Counts carry the shape (sources, outputs, chats), the
 * description carries the subject, and one action carries the intent. */
function CountChip({ icon, n, noun }) {
  return el('span', { className: 'nb-count', title: `${n} ${noun}${n === 1 ? '' : 's'}` },
    jsx(Glyph, { name: icon, size: 12 }),
    el('b', { children: String(n) }),
    el('span', { children: noun + (n === 1 ? '' : 's') }))
}

function NotebookDescription(n) {
  const desc = String(n.description || '').trim()
  if (!desc) {
    return el('span', { className: 'nb-nbcard-desc', 'data-empty': 'true',
      children: n.sources ? 'No description — open it to see what is on the desk.' : 'Empty notebook — add sources to begin.' })
  }
  return el('span', { className: 'nb-nbcard-desc', children: desc })
}

/* one shelf: a single responsive grid. The colour a card carries is its own
 * sigil hue (derived from the id), so the accent strip is an identity, not a
 * ranking — there is no second "featured" row to duplicate the same notebooks
 * 40px further down. The New notebook action sits in the header, beside the
 * search field, where a person looks for it first. */
function HomeDashboard({ data, onOpen, onNew, onDelete, onRename, onDuplicate }) {
  const [query, setQuery] = useState('')
  const [del, setDel] = useState(null)
  const [ren, setRen] = useState(null)
  const notebooks = (data && data.notebooks) || []
  const needle = query.trim().toLowerCase()
  const shown = notebooks
    .filter((n) => !needle || `${n.title} ${n.description || ''}`.toLowerCase().includes(needle))
    // "newest activity first" is a claim the list has to keep: sort here, not in
    // the payload, so a stale /state still reads in the order the label promises
    .slice().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
  const totalSources = notebooks.reduce((s, n) => s + (n.sources || 0), 0)
  const totalArtifacts = notebooks.reduce((s, n) => s + (n.artifacts || 0), 0)
  const empty = notebooks.filter((n) => !n.sources).length

  return el('div', { className: 'nb-home' },
    el('div', { className: 'nb-home-scroll' },
      el('div', { className: 'nb-home-inner' },
        el('div', { className: 'nb-home-head' },
          el('div', { className: 'nb-home-titles' },
            el('h1', { className: 'nb-home-title', children: 'Notebooks' }),
            el('p', { className: 'nb-home-sub', children: [
              el('b', { children: String(notebooks.length) }), ' notebook' + (notebooks.length === 1 ? '' : 's'),
              ' · ', el('b', { children: String(totalSources) }), ' sources',
              ' · ', el('b', { children: String(totalArtifacts) }), ' outputs',
              empty ? ` · ${empty} still empty` : ''
            ] })),
          el('div', { className: 'nb-home-tools' },
            el('div', { className: 'nb-home-search' },
              jsx(SearchField, { value: query, onChange: setQuery,
                placeholder: 'Search notebooks', label: 'Search notebooks' })),
            jsx(Btn, { icon: 'plus', variant: 'primary', onClick: onNew, children: 'New notebook' }))
        ),

        el('div', { className: 'nb-home-sec' },
          el('span', { className: 'nb-meta', children: shown.length === notebooks.length
            ? 'All notebooks' : `${shown.length} of ${notebooks.length} notebooks` }),
          el('span', { className: 'nb-hint', children: 'newest activity first' }),
          el('span', { style: { flex: 1 } })),

        shown.length === 0
          ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '30px 8px' } },
              el('div', null,
                el('h3', { children: notebooks.length ? 'Nothing matches' : 'No notebooks yet' }),
                el('p', { children: notebooks.length
                  ? 'Try a different search.'
                  : 'A notebook is a set of sources. Create one, then describe what you need — Hermes finds, labels and grounds everything in them.' }),
                !notebooks.length
                  ? el('div', { style: { marginTop: '14px' } },
                      jsx(Btn, { variant: 'primary', icon: 'plus', onClick: onNew, children: 'New notebook' }))
                  : null))
          : el('div', { className: 'nb-home-grid', role: 'list' },
              shown.map((n) => el('div', { key: n.id, className: 'nb-nbcard-wrap', role: 'listitem' },
                el('button', {
                  type: 'button', className: 'nb-nbcard',
                  style: { '--kc': `hsl(${sigHue(n.id)} 68% 62%)` },
                  onClick: () => onOpen(n.id),
                  'aria-label': `Open notebook ${n.title}`,
                  children: [
                    el('div', { className: 'nb-nbcard-top' },
                      el('span', { className: 'nb-nbcard-emoji', 'aria-hidden': 'true',
                        children: (n.emoji && String(n.emoji).trim())
                          ? emojiFor(n.id, n.emoji)
                          : jsx(Sigil, { seed: n.id, size: 32 }) }),
                      el('div', { className: 'nb-nbcard-head' },
                        el('span', { className: 'nb-nbcard-title', children: n.title }),
                        el('span', { className: 'nb-nbcard-when',
                          children: n.updated_at ? ago(n.updated_at) : 'Never touched' }))),
                    jsx(NotebookDescription, { description: n.description, sources: n.sources }),
                    el('div', { className: 'nb-nbcard-foot' },
                      jsx(CountChip, { icon: 'layers', n: n.sources || 0, noun: 'source' }),
                      jsx(CountChip, { icon: 'sparkle', n: n.artifacts || 0, noun: 'output' }),
                      n.threads ? jsx(CountChip, { icon: 'note', n: n.threads, noun: 'chat' }) : null,
                      el('span', { className: 'nb-nbcard-open', 'aria-hidden': 'true' },
                        'Open', jsx(Glyph, { name: 'arrowRight', size: 13 })))
                  ]
                }, n.id),
                jsx(IconBtn, {
                  icon: 'note', label: `Rename notebook ${n.title}`, size: 14,
                  className: 'nb-nbcard-ren',
                  onClick: (e) => { e.stopPropagation(); setRen(n) }
                }),
                jsx(IconBtn, {
                  icon: 'trash', label: `Delete notebook ${n.title}`, size: 14,
                  className: 'nb-nbcard-del',
                  onClick: (e) => { e.stopPropagation(); setDel(n) }
                })
              )))
      )
    ),

    del ? jsx(Dialog, {
      open: true, onClose: () => setDel(null), title: 'Delete notebook', width: 420,
      children: el('div', null,
        el('p', { style: { margin: '0 0 16px', color: T.text2, fontSize: '14px', lineHeight: 1.55 },
          children: `“${del.title}” and its sources, thread and artifacts will be removed. This cannot be undone.` }),
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
          jsx(Btn, { onClick: () => setDel(null), children: 'Cancel' }),
          jsx(Btn, {
            variant: 'primary', icon: 'trash',
            onClick: () => { const id = del.id; setDel(null); onDelete(id) },
            children: 'Delete'
          })))
    }) : null,

    ren ? jsx(RenameDialog, {
      notebook: ren, onClose: () => setRen(null),
      onDone: async (title, desc, emoji) => { setRen(null); await onRename(ren.id, title, desc, emoji) },
      onDuplicate: onDuplicate ? async () => { const n = ren; setRen(null); await onDuplicate(n.id) } : null
    }) : null
  )
}

function RenameDialog({ notebook, onClose, onDone, onDuplicate }) {
  const [title, setTitle] = useState(notebook.title || '')
  const [desc, setDesc] = useState(notebook.description || '')
  const [emoji, setEmoji] = useState(notebook.emoji || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return jsx(Dialog, {
    open: true, onClose, title: 'Notebook settings', width: 480,
    children: el('div', null,
      el('div', { className: 'nb-emgrid', role: 'radiogroup', 'aria-label': 'Notebook icon' },
        el('button', {
          type: 'button', className: 'nb-em' + (emoji ? '' : ' is-on'),
          onClick: () => setEmoji(''), title: 'Auto icon', 'aria-pressed': !emoji,
          children: jsx(Sigil, { seed: notebook.id, size: 30 })
        }),
        NB_EMOJI.map((e) => el('button', {
          key: e, type: 'button',
          className: 'nb-em' + (emoji === e ? ' is-on' : ''),
          onClick: () => setEmoji(e), title: `Icon ${e}`, 'aria-pressed': emoji === e,
          children: e
        }))),
      el('div', { className: 'nb-field', style: { height: '40px', marginTop: '12px', marginBottom: '10px' } },
        jsx(Glyph, { name: 'notebook', size: 14 }),
        el('input', {
          value: title, onChange: (e) => setTitle(e.target.value), autoFocus: true,
          placeholder: 'Notebook title', 'aria-label': 'Notebook title'
        })),
      el('div', { className: 'nb-field', style: { height: '40px' } },
        jsx(Glyph, { name: 'doc', size: 14 }),
        el('input', {
          value: desc, onChange: (e) => setDesc(e.target.value),
          placeholder: 'Description (optional)', 'aria-label': 'Notebook description'
        })),
      err ? el('div', { style: { marginTop: '10px', color: T.danger, fontSize: '13px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '16px' } },
        onDuplicate
          ? jsx(Btn, { icon: 'copy', onClick: onDuplicate, children: 'Make a copy' })
          : el('span'),
        el('span', { style: { display: 'flex', gap: '8px' } },
          jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, {
          variant: 'primary', disabled: busy || !title.trim(),
          onClick: async () => {
            setBusy(true); setErr('')
            try { await onDone(title.trim(), desc.trim(), emoji) }
            catch (e) { setErr(e.message || String(e)); setBusy(false) }
          },
          children: busy ? 'Saving…' : 'Save'
        }))))
  })
}

/* --------------------------------------------------------------- panel tog */

function PanelToggles({ side, onShow }) {
  // A folded panel has to advertise itself. One 36px chevron on an empty 44px
  // gutter read as decoration; the icon it opens plus a two-word label makes the
  // affordance unmistakable at a glance.
  const left = side === 'left'
  return el('div', { className: 'nb-paneltog' },
    el('button', {
      type: 'button', className: 'nb-paneltog-btn',
      onClick: onShow,
      'aria-label': left ? 'Show the sources panel' : 'Show the Make panel',
      title: left ? 'Show the sources panel' : 'Show the Make panel'
    },
    jsx(Glyph, { name: left ? 'arrowRight' : 'arrowLeft', size: 14 }),
    jsx(Glyph, { name: left ? 'book' : 'sparkle', size: 16 }),
    el('span', { children: left ? 'Sources' : 'Make' }))
  )
}

/* -------------------------------------------------------------------- rail */

/* The sources panel is three zones and nothing else:
 *   1 header  title + count, one primary "+ Add", and the three quiet tools
 *   2 filter  one search field and one horizontally scrolling tag row
 *   3 list    the sources as one flat column of rows (a topic is a section
 *             label, not a folding checkbox tree)
 *
 * The notebook switcher card, the dashed second Add button, the web-search box,
 * the second search field, the tag wrapper, the triple-nested checkboxes and
 * the decorative footer pill are gone: each of them was a duplicate or a
 * decoration, and together they took ~380px above the ~120px where the sources
 * actually were. Adding a source (URL, file, pasted text, or a web search) is
 * one dialog, opened from the one button that says "+ Add". */
function Rail({ notebook, onAddSource, onOpenSource, onToggleSource,
               onToggleAll, onDeleteSource, onLabel, onCollapse, onSay, onDropFiles,
               loading, error, reload }) {
  const sources = (notebook && notebook.sources) || []
  const labels = (notebook && notebook.labels) || []
  const [q, setQ] = useState('')
  const [srcFilter, setSrcFilter] = useState('all')
  const [dragOver, setDragOver] = useState(false)
  const [closed, setClosed] = useState({})

  const shown = useMemo(() => {
    const needle = (q || '').trim().toLowerCase().replace(/^#/, '')
    return sources.filter((s) => {
      if (srcFilter !== 'all' && !(s.labels || []).some((l) => l.toLowerCase() === srcFilter)) return false
      if (!needle) return true
      return (s.title + ' ' + (s.origin || '') + ' ' + (s.labels || []).join(' '))
        .toLowerCase().includes(needle)
    })
  }, [sources, q, srcFilter])

  // A topic still orders the list — the first auto-label is the topic — but it
  // is a quiet section label now, not a fourth checkbox and a fold.
  const groups = useMemo(() => {
    const map = new Map()
    for (const s of shown) {
      const g = (((s.labels || [])[0]) || kindLabel(s.kind) || 'other').toLowerCase()
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(s)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [shown])

  const allOn = sources.length > 0 && sources.every((s) => s.active !== false)
  const activeCount = sources.filter((s) => s.active !== false).length
  // one topic grouping is noise: with fewer than 8 sources the flat list reads
  // better than a label over every other row
  const grouped = sources.length >= 8

  const srcRow = (s) => {
    const on = s.active !== false
    return el('div', {
      className: 'nb-src', key: s.id,
      'data-on': pickedCite === s.n ? 'true' : 'false',
      'data-off': on ? 'false' : 'true'
    },
      el('button', {
        type: 'button', className: 'nb-srccheck', role: 'checkbox',
        'aria-checked': on,
        'aria-label': `${on ? 'Exclude' : 'Include'} “${s.title}” ${on ? 'from' : 'in'} answers`,
        title: on ? 'Included in answers — click to exclude' : 'Excluded from answers — click to include',
        onClick: () => onToggleSource(s),
        children: on ? jsx(Glyph, { name: 'check', size: 13 }) : null
      }),
      el('button', {
        type: 'button', className: 'nb-src-open',
        onClick: () => onOpenSource(s),
        'aria-label': `Open source ${s.n} — ${s.title}`,
        title: s.summary || s.origin || s.title,
        children: [
          el('span', { className: 'nb-src-ico', 'aria-hidden': 'true' },
            jsx(Glyph, { name: SRC_ICON[s.kind] || 'file', size: 14 }),
            el('b', { className: 'nb-cite', children: `S${s.n}` })),
          el('span', { className: 'nb-src-body' },
            el('span', { className: 'nb-src-title', children: s.title }),
            el('span', { className: 'nb-src-meta' },
              el('span', { className: 'nb-chip', children: `${kindLabel(s.kind)} · ${nfmt(s.chars)}` }),
              (s.labels || []).length
                ? el('span', { className: 'nb-chip', children: s.labels[0] })
                : null,
              (s.labels || []).length > 1
                ? el('span', {
                    className: 'nb-chip',
                    title: `Also tagged: ${s.labels.slice(1).join(', ')}`,
                    children: `+${s.labels.length - 1}`
                  })
                : null))
        ]
      }),
      onDeleteSource ? jsx(IconBtn, {
        icon: 'trash', size: 13, className: 'nb-src-del',
        label: `Remove source “${s.title}”`,
        onClick: () => onDeleteSource(s)
      }) : null
    )
  }

  return el('aside', {
    className: 'nb-col nb-rail', 'aria-label': 'Sources',
    'data-drop': dragOver ? 'true' : 'false',
    onDragOver: (e) => {
      const types = e.dataTransfer && e.dataTransfer.types
      if (types && Array.prototype.indexOf.call(types, 'Files') >= 0) {
        e.preventDefault(); setDragOver(true)
      }
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => {
      e.preventDefault(); setDragOver(false)
      const files = e.dataTransfer && e.dataTransfer.files
      if (files && files.length && onDropFiles) onDropFiles(Array.from(files))
    }
  },
    el('div', { className: 'nb-rail-head' },
      el('span', { className: 'nb-rail-title' },
        'Sources',
        el('span', { className: 'nb-rail-count',
          children: sources.length ? `${activeCount}/${sources.length}` : '0' })),
      jsx(Btn, {
        icon: 'plus', onClick: onAddSource, disabled: !notebook,
        className: 'nb-addsrc', children: 'Add',
        'aria-label': notebook ? 'Add sources — link, file, pasted text, or a web search' : 'Add sources (open a notebook first)'
      }),
      el('div', { className: 'nb-rail-tools' },
        jsx(IconBtn, {
          icon: 'sparkle', label: 'Auto-label unlabelled sources', onClick: onLabel,
          disabled: !(notebook && notebook.stats && notebook.stats.unlabeled)
        }),
        jsx(IconBtn, { icon: 'refresh', label: 'Refresh sources', onClick: () => reload(true) }),
        jsx(IconBtn, { icon: 'arrowLeft', label: 'Hide sources panel', onClick: onCollapse }))
    ),

    el('div', { className: 'nb-rail-filter' },
      jsx(SearchField, { value: q || '', onChange: setQ,
        placeholder: 'Filter sources or #tags', label: 'Filter sources' }),
      el('div', { className: 'nb-tagrow', role: 'group', 'aria-label': 'Filter sources by tag' },
        labels.length
          ? labels.slice(0, 8).map((l) =>
              jsx(Chip, {
                key: l.label, tone: srcFilter === l.label.toLowerCase() ? 'accent' : undefined,
                pressed: srcFilter === l.label.toLowerCase(),
                onClick: () => setSrcFilter(srcFilter === l.label.toLowerCase() ? 'all' : l.label.toLowerCase()),
                title: `${l.count} source${l.count === 1 ? '' : 's'} tagged ${l.label}`,
                children: `${l.label} ${l.count}`
              }))
          : el('span', { className: 'nb-tagrow-empty', children: 'No tags yet — labelling adds them' }))
    ),

    el('div', { className: 'nb-scroll nb-rail-list', 'aria-label': 'Source list' },
      error
        ? el('div', { className: 'nb-hint', style: { padding: '10px 14px', color: T.danger }, children: error })
        : !notebook
          ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '24px 14px' } },
              el('div', null,
                el('h3', { style: { fontSize: 'var(--nb-fs-title)' }, children: 'No notebook open' }),
                el('p', { style: { fontSize: 'var(--nb-fs-label)' },
                  children: 'Sources belong to a notebook. Open one from Home to see what is in it.' })))
          : loading && !sources.length
            ? el('div', { className: 'nb-hint', style: { padding: '14px' }, children: 'reading sources…' })
            : sources.length === 0
              ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '24px 14px' } },
                  el('div', null,
                    el('h3', { style: { fontSize: 'var(--nb-fs-title)' }, children: 'No sources yet' }),
                    el('p', { style: { fontSize: 'var(--nb-fs-label)' },
                      children: 'Add a file, a link or pasted text — or describe the topic and let Hermes find sources for you.' })))
              : shown.length === 0
                ? el('div', { className: 'nb-void', style: { height: 'auto', padding: '24px 14px' } },
                    el('div', null,
                      el('h3', { style: { fontSize: 'var(--nb-fs-title)' }, children: 'Nothing matches' }),
                      el('p', { style: { fontSize: 'var(--nb-fs-label)' },
                        children: 'Clear the filter or the search to see every source.' })))
                : el('div', { className: 'nb-src-list' },
                    // one bulk control, one row — "all sources" is a filter over
                    // the list, not a checkbox above a tree of checkboxes
                    sources.length > 1
                      ? el('div', { className: 'nb-selall' },
                          el('button', {
                            type: 'button', className: 'nb-srccheck', role: 'checkbox',
                            'aria-checked': allOn,
                            'aria-label': allOn ? 'Exclude all sources from answers' : 'Include all sources in answers',
                            title: allOn ? 'Exclude every source' : 'Include every source',
                            onClick: onToggleAll,
                            children: allOn ? jsx(Glyph, { name: 'check', size: 13 }) : null
                          }),
                          el('span', { className: 'nb-src-title',
                            children: allOn ? 'All included' : `${activeCount} of ${sources.length} included` }),
                          el('span', { style: { flex: 1 } }),
                          srcFilter !== 'all'
                            ? jsx(Chip, {
                                onClick: () => setSrcFilter('all'),
                                title: 'Clear the tag filter',
                                children: `#${srcFilter} ×`
                              })
                            : null)
                      : null,
                    grouped
                      ? groups.map(([g, list]) => el('div', { key: g },
                          el('button', {
                            type: 'button', className: 'nb-srcgroup',
                            'aria-expanded': !closed[g],
                            onClick: () => setClosed((c) => ({ ...c, [g]: !c[g] })),
                            children: [
                              el('span', { children: g }),
                              el('em', { children: closed[g] ? String(list.length) : '' }),
                              el('span', { style: { flex: 1 } }),
                              jsx(Glyph, { name: 'chevron', size: 11 })
                            ]
                          }),
                          closed[g] ? null : el('div', { className: 'nb-src-flat' }, list.map(srcRow))))
                      : el('div', { className: 'nb-src-flat' }, shown.map(srcRow))
                  )
    ),
    dragOver
      ? el('div', {
          style: {
            position: 'absolute', inset: '12px', zIndex: 5, borderRadius: '18px',
            border: `2px dashed ${T.accent}`, background: 'color-mix(in srgb, #0a0b10 78%, transparent)',
            display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center',
            color: T.text, fontSize: '14px', fontWeight: 600, pointerEvents: 'none'
          },
          children: [
            jsx(Glyph, { name: 'plus', size: 22 }),
            'Drop files to add them as sources'
          ]
        })
      : null
  )
}

// citation focus is shared state: a [S3] click in the answer highlights S3 here
let pickedCite = 0
const setPickedCite = (n) => { pickedCite = n }

/* -------------------------------------------------------------------- main */

/* A chat question is a turn: idle → asking → (answered) idle | failed. It carries
 * its own clock, so the "13s" the page shows is the machine's, not a second timer
 * racing a boolean. It can be cancelled — the request continues on the server, but
 * the page stops waiting instead of pretending a spinner is progress. */
const TURN = Machine('turn', {
  initial: 'idle',
  context: { q: '', since: 0, now: 0 },
  states: {
    idle: {
      on: { ASK: { target: 'asking', guard: (c, p) => !!(p && p.q),
                   action: (c, p) => ({ q: p.q, since: p.since || Date.now(), now: p.since || Date.now() }) } }
    },
    asking: {
      tags: ['busy'],
      enter: () => {
        const t = setInterval(() => TURN.set({ now: Date.now() }), 500)
        return () => clearInterval(t)
      },
      on: {
        ANSWER: 'idle',
        FAIL: 'failed',
        CANCEL: { target: 'idle', action: (c) => ({ q: '' }) }
      }
    },
    failed: {
      on: { ASK: { target: 'asking', action: (c, p) => ({ q: p.q, since: p.since || Date.now(), now: Date.now() }) },
            DISMISS: { target: 'idle', action: () => ({ q: '' }) } }
    }
  }
})

/* The notebook opener: two parallel loads that were expressed as four variables
 * (ov/ovErr, sugg/suggErr) and a retry counter. Two machines, one per load. */
const OVERVIEW = Machine('overview', {
  initial: 'idle',
  context: { text: '', gen: 0 },
  states: {
    idle: { on: { LOAD: 'loading',
                  HYDRATE: { target: 'ready', guard: (c, p) => !!(p && p.text),
                             action: (c, p) => ({ text: p.text }) } } },
    loading: {
      tags: ['busy'],
      on: {
        READY: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                 action: (c, p) => ({ text: p.text }) },
        EMPTY: { target: 'empty', guard: (c, p) => !!p && p.gen === c.gen },
        FAIL: { target: 'failed', guard: (c, p) => !!p && p.gen === c.gen },
        HYDRATE: { target: 'ready', guard: (c, p) => !!(p && p.text),
                   action: (c, p) => ({ text: p.text }) }
      }
    },
    ready: { on: { LOAD: 'loading',
                   HYDRATE: { target: 'ready', action: (c, p) => ({ text: (p && p.text) || c.text }) } } },
    empty: { on: { LOAD: 'loading', HYDRATE: { target: 'ready', action: (c, p) => ({ text: (p && p.text) || '' }) } } },
    failed: { on: { LOAD: 'loading',
                    HYDRATE: { target: 'ready', guard: (c, p) => !!(p && p.text),
                               action: (c, p) => ({ text: p.text }) } } }
  }
})

const SUGGEST_M = Machine('suggest', {
  initial: 'idle',
  context: { list: null, gen: 0, hydrated: false },
  states: {
    idle: { on: { LOAD: 'loading',
                  HYDRATE: { target: 'ready', action: (c, p) => ({ list: (p && p.list) || null, hydrated: true }) } } },
    loading: {
      tags: ['busy'],
      on: {
        READY: { target: 'ready', guard: (c, p) => !!p && p.gen === c.gen,
                 action: (c, p) => ({ list: p.list }) },
        FAIL: { target: 'failed', guard: (c, p) => !!p && p.gen === c.gen },
        HYDRATE: { target: 'ready', action: (c, p) => ({ list: (p && p.list) || null, hydrated: true }) }
      }
    },
    ready: { on: { LOAD: 'loading', HYDRATE: { target: 'ready', action: (c, p) => ({ list: (p && p.list) || c.list }) } } },
    failed: { on: { LOAD: 'loading', HYDRATE: { target: 'ready', action: (c, p) => ({ list: (p && p.list) || null }) } } }
  }
})

function Main({ notebook, kinds, tab, setTab, picked, setPicked, busy, generate, onAsk,
                askOpen, onSay, reload, modelReady, error, loading,
                peek, setPeek, onOpenSource, onRefreshSource, onAddSource, onNewNotebook, onFindSources,
                refreshArtifact }) {
  const sources = (notebook && notebook.sources) || []
  const [askScope, setAskScope] = useState(null)   // chat scoped to one source

  if (loading && !notebook) {
    return el('main', { className: 'nb-col nb-main-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Opening the notebook' }),
          el('p', { children: 'Reading sources and artifacts from the plugin store…' }))))
  }
  if (error && !notebook) {
    return el('main', { className: 'nb-col nb-main-col' },
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
    return el('main', { className: 'nb-col nb-main-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: 'Start a notebook' }),
          el('p', { children: 'A notebook is a set of sources. Everything the studio makes — answers, a podcast, a mind map, slides — is derived from those sources and cites them by number.' }),
          el('div', { style: { marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' } },
            jsx(Btn, { variant: 'primary', icon: 'plus', onClick: onNewNotebook, children: 'New notebook' }),
            jsx(Btn, { icon: 'sparkle', onClick: () => onAddSource && onAddSource(), disabled: true,
              title: 'Create a notebook first', children: 'Add sources' })
          )
        )
      )
    )
  }

  const viewName = picked ? picked.label : ''
  const stats = notebook.stats || {}
  const activeCount = stats.active !== undefined ? stats.active : sources.length
  const hasArts = (notebook.artifacts || []).length > 0

  // a notebook with nothing in it gets a guided empty state, not dead panels
  if (!sources.length && !hasArts) {
    return el('main', { className: 'nb-col nb-main-col' },
      el('div', { className: 'nb-void' },
        el('div', null,
          el('h3', { children: `“${notebook.title}” has no sources yet` }),
          el('p', { children: 'Everything here is grounded in your sources — answers cite them, and every studio output is built from them. Add the material first.' }),
          el('div', { style: { marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } },
            jsx(Btn, { variant: 'primary', icon: 'sparkle', onClick: () => onAddSource && onAddSource({ mode: 'find' }), children: 'Find sources' }),
            jsx(Btn, { icon: 'link', onClick: () => onAddSource && onAddSource({ mode: 'url' }), children: 'Add a link' }),
            jsx(Btn, { icon: 'note', onClick: () => onAddSource && onAddSource({ mode: 'note' }), children: 'Paste notes' })
          )
        )
      )
    )
  }

  return el('main', { className: 'nb-col nb-main-col' },
    el('div', { className: 'nb-main-head' },
      // ONE header line: sigil, title, one meta line, the grounded chip, and the
      // view switcher on the same baseline. The old block was a 52px sigil +
      // two-line h1 + two meta paragraphs + a chip row, then a 38px tab row
      // below it — ~180px of vertically stacked titles before any content, and
      // the notebook's title was printed four times in one viewport (breadcrumb,
      // rail switcher card, this h1, and the artifact's own markdown h1).
      el('div', { className: 'nb-head-top' },
        el('span', { className: 'nb-head-sigil', 'aria-hidden': 'true',
          children: (notebook.emoji && String(notebook.emoji).trim())
            ? emojiFor(notebook.id, notebook.emoji)
            : jsx(Sigil, { seed: notebook.id, size: 26 }) }),
        el('div', { className: 'nb-head-main' },
          el('h1', { className: 'nb-h1', children: notebook.title,
            title: notebook.title }),
          el('p', { className: 'nb-sub', title: notebook.description || undefined,
            children: notebook.description
              ? notebook.description
              : `${sources.length} source${sources.length === 1 ? '' : 's'} · ${stats.labels || 0} topics · updated ${ago(notebook.updated_at) || 'recently'}` })),
        el('div', { className: 'nb-hero-side' },
          el('span', {
            className: 'nb-chip', 'data-tone': modelReady ? 'ok' : 'warn',
            children: modelReady ? 'grounded' : 'model offline'
          }))),
      // The view switcher gets its own row: sharing one line with the sigil, the
      // title and the meta block meant the h1 was truncated even at 1330px
      // ("Commercial Fusion Energy in 2…") and the active tab competed with the
      // grounded chip for the same corner.
      el('div', { className: 'nb-tabs-row' },
        el('div', { className: 'nb-tabs', role: 'tablist', 'aria-label': 'Notebook views' },
          el('button', {
            type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'chat',
            onClick: () => setTab('chat'),
            children: [jsx(Glyph, { name: 'faq', size: 14 }), el('span', { children: 'Chat' })]
          }),
          el('button', {
            type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'tensions',
            onClick: () => setTab('tensions'), disabled: !sources.length,
            title: 'Where the sources disagree, and whether they corroborate each other',
            children: [jsx(Glyph, { name: 'shield', size: 14 }), el('span', { children: 'Tensions' })]
          }),
          el('button', {
            type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'view',
            onClick: () => setTab('view'), disabled: !picked,
            title: picked ? `${picked.label} — ${picked.title || picked.primary}` : 'No artifact open',
            children: [jsx(Glyph, { name: picked ? (KIND_ICON[picked.kind] || 'doc') : 'doc', size: 14 }),
                       el('span', { children: viewName || 'Viewer' })]
          }),
          peek ? el('button', {
            type: 'button', role: 'tab', className: 'nb-tab', 'aria-selected': tab === 'peek',
            onClick: () => setTab('peek'), title: peek.title,
            children: [jsx(Glyph, { name: 'book', size: 14 }),
                       el('span', { children: `S${peek.n} · ${peek.title}` })]
          }) : null
        ))
    ),

    tab === 'peek' && peek
      ? (() => {
          const pi = sources.findIndex((s) => s.id === peek.id)
          return jsx(SourcePeek, {
            source: peek, notebook, onSay,
            onClose: () => { setPeek(null); setTab('chat') },
            onAskAbout: (s) => { setAskScope({ ids: [s.id], title: s.title }); setTab('chat') },
            onRefresh: onRefreshSource ? () => onRefreshSource(peek) : null,
            onPrev: pi > 0 ? () => setPeek(sources[pi - 1]) : null,
            onNext: pi >= 0 && pi < sources.length - 1 ? () => setPeek(sources[pi + 1]) : null
          })
        })()
      : tab === 'tensions'
        ? jsx(TensionsPanel, {
            notebook, onSay, modelReady,
            onOpenSource,
            onCite: (n, cite) => {
              const src = sources.find((s) => (cite && cite.id && s.id === cite.id) || s.n === n)
              if (src) { setPeek({ ...src, citeSnippet: (cite && cite.snippet) || '' }); setTab('peek') }
            }
          })
      : tab === 'view' && picked
        ? (() => {
            // sibling runs of the same kind, oldest first — ‹ › flips versions
            const sibs = (notebook.artifacts || []).filter((a) => a.kind === picked.kind)
              .slice().sort((a, b) => String(a.modified).localeCompare(String(b.modified)))
            const si = sibs.findIndex((a) => a.key === picked.key)
            return jsx(Viewer, {
              artifact: picked, notebook, onSay,
              regenerating: !!(busy && busy[picked.kind]),
              onRegenerate: () => generate(picked.kind, picked.opts || {}),
              onChanged: refreshArtifact || (() => reload && reload(true)),
              onPrevRun: si > 0 ? () => setPicked(sibs[si - 1]) : null,
              onNextRun: si >= 0 && si < sibs.length - 1 ? () => setPicked(sibs[si + 1]) : null,
              runPos: sibs.length > 1 ? `${si + 1} of ${sibs.length}` : '',
              onClose: () => { setPicked(null); setTab('chat') },
              onCite: (n, cite) => {
                const src = sources.find((s) => (cite && cite.id && s.id === cite.id) || s.n === n)
                if (src) { setPeek({ ...src, citeSnippet: (cite && cite.snippet) || '' }); setTab('peek') }
              }
            })
          })()
        : jsx(Chat, {
            notebook, kinds, askOpen, onSay, modelReady, reload, askScope, setAskScope,
            generate,
            onCite: (n, cite) => {
              const src = sources.find((s) => (cite && cite.id && s.id === cite.id) || s.n === n)
              if (src) { setPeek({ ...src, citeSnippet: (cite && cite.snippet) || '' }); setTab('peek') }
            },
            onOpenSource,
            onFindSources
          })
  )
}

/* ------------------------------------------------------------------- chat */

const SUGGEST = [
  'Summarise the strongest claim in the sources, with citations.',
  'Where do the sources disagree?',
  'What is missing that I should go and find?'
]

/* overview + suggestions are fetched once per notebook-content version and
   cached for the session — tab switches must not re-bill the model. */
const ovCache = new Map()
/* conversations survive Chat unmounts (peek/viewer tabs swap it out) — the
   module-level cache is the source of truth once a thread has been opened. */
const threadCache = new Map()

function Chat({ notebook, kinds, askOpen, onSay, modelReady, onCite, onOpenSource, onFindSources, reload, askScope, setAskScope, generate }) {
  const nbKey = `${notebook.id}:default`
  const [thread, setThread] = useState('default')
  const [threads, setThreads] = useState(() => notebook.threads || [])
  const [thrOpen, setThrOpen] = useState(false)
  // The composer's pill: what "send" means. Grounded is read-only, agent may run
  // a tool, council wants more than one model to answer.
  const [agentMode, setAgentMode] = useState(() => persist.get('composerMode', 'grounded'))
  const setMode = (m) => { setAgentMode(m); persist.set('composerMode', m) }
  const curThread = useRef('default')
  curThread.current = thread
  const [msgs, setMsgs] = useState(() =>
    threadCache.get(nbKey) || (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` })))
  const [text, setText] = useState('')
  const turn = useMachine(TURN)
  const overview = useMachine(OVERVIEW)
  const suggest = useMachine(SUGGEST_M)
  const pending = turn.matches('asking')
    ? { since: turn.ctx.since, now: turn.ctx.now, q: turn.ctx.q, cancel: () => TURN.send('CANCEL') }
    : null
  const ov = overview.ctx.text
  const ovErr = overview.matches('failed')
  const sugg = suggest.ctx.list
  const suggErr = suggest.matches('failed')
  const [ovRetry, setOvRetry] = useState(0)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [cfg, setCfg] = useState({})
  const [cfgBusy, setCfgBusy] = useState(false)
  const threadRef = useRef(null)
  const boxRef = useRef(null)
  const stickRef = useRef(true)
  const [showLatest, setShowLatest] = useState(false)
  const stats = notebook.stats || {}
  const activeCount = stats.active !== undefined ? stats.active : (notebook.sources || []).length
  const cacheKey = `${notebook.id}:${stats.sources || 0}:${activeCount}`

  const cacheMsgs = (key, list) => { threadCache.set(key, list); return list }

  // a different notebook → back to its default conversation
  useEffect(() => {
    setThread('default')
    if (setAskScope) setAskScope(null)
    setThreads(notebook.threads || [])
    const key = `${notebook.id}:default`
    const cached = threadCache.get(key)
    const mapped = cached || (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }))
    cacheMsgs(key, mapped)
    setMsgs(mapped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook.id])

  // /state refreshes the thread list (a first message creates the file)
  useEffect(() => { setThreads(notebook.threads || []) }, [notebook.threads])

  // switching conversations: cache hit is instant, otherwise fetch the thread
  useEffect(() => {
    stickRef.current = true
    setShowLatest(false)
    const key = `${notebook.id}:${thread}`
    const cached = threadCache.get(key)
    if (cached) { setMsgs(cached); return undefined }
    if (thread === 'default') {
      const mapped = (notebook.thread || []).map((m, i) => ({ ...m, k: `t${i}` }))
      cacheMsgs(key, mapped)
      setMsgs(mapped)
      return undefined
    }
    let live = true
    setMsgs([])
    api(`/thread?${qs({ notebook: notebook.id, name: thread })}`, { timeoutMs: 30000 })
      .then((out) => {
        if (!live) return
        const mapped = (out.messages || []).map((m, i) => ({ ...m, k: `t${i}` }))
        cacheMsgs(key, mapped)
        setMsgs(mapped)
      })
      .catch(() => { if (live && onSay) onSay('could not load that conversation — try again') })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook.id, thread])

  useEffect(() => {
    const cached = ovCache.get(notebook.id)
    if (cached && cached.key === cacheKey) {
      OVERVIEW.send('HYDRATE', { text: cached.ov || '' })
      SUGGEST_M.send('HYDRATE', { list: cached.sugg || null })
      return undefined
    }
    let live = true
    const ovGen = OVERVIEW.ctx.gen + 1
    const sgGen = SUGGEST_M.ctx.gen + 1
    OVERVIEW.set({ gen: ovGen, text: '' })
    SUGGEST_M.set({ gen: sgGen })
    OVERVIEW.send('LOAD')
    SUGGEST_M.send('LOAD')
    api('/overview', { method: 'POST', body: { notebook: notebook.id }, timeoutMs: 120000 })
      .then((o) => {
        if (!live) return
        const text = o.overview || ''
        OVERVIEW.send(text ? 'READY' : 'EMPTY', { text, gen: ovGen })
        const c = ovCache.get(notebook.id) || {}
        ovCache.set(notebook.id, { key: cacheKey, ov: text, sugg: c.sugg || null })
      })
      .catch(() => { if (live) OVERVIEW.send('FAIL', { gen: ovGen }) })
    api('/suggest', { method: 'POST', body: { notebook: notebook.id }, timeoutMs: 120000 })
      .then((o) => {
        if (!live) return
        const list = o.suggestions || null
        SUGGEST_M.send(list ? 'READY' : 'FAIL', { list, gen: sgGen })
        const c = ovCache.get(notebook.id) || {}
        ovCache.set(notebook.id, { key: cacheKey, ov: c.ov || '', sugg: list })
      })
      .catch(() => { if (live) SUGGEST_M.send('FAIL', { gen: sgGen }) })
    return () => { live = false }
  }, [notebook.id, cacheKey, ovRetry])

  const saveNote = async () => {
    if (!ov.trim()) return
    try {
      await api('/note', {
        method: 'POST',
        body: { notebook: notebook.id, text: ov, title: `Overview — ${notebook.title}` },
        timeoutMs: 60000
      })
      if (onSay) onSay('overview saved as a note — it is searchable now')
      if (reload) await reload(true)
    } catch (e) { if (onSay) onSay(`could not save note: ${e.message || e}`) }
  }

  const copyOv = () => copyText(ov, onSay)

  useEffect(() => { if (askOpen) { const n = boxRef.current; if (n) n.focus() } }, [askOpen])

  // stick to the newest message only while the reader is already there —
  // yanking someone back mid-history on every tick is hostile
  const onThreadScroll = () => {
    const node = threadRef.current
    if (!node) return
    const near = node.scrollHeight - node.scrollTop - node.clientHeight < 90
    stickRef.current = near
    setShowLatest(!near)
  }

  useEffect(() => {
    const node = threadRef.current
    if (node && stickRef.current) node.scrollTop = node.scrollHeight
  }, [msgs.length, pending && pending.since])

  const send = async (question, opts) => {
    if (!TURN.can('ASK')) return
    stickRef.current = true
    setShowLatest(false)
    const retry = !!(opts && opts.retry)
    const t = thread
    const key = `${notebook.id}:${t}`
    let q
    if (retry) {
      // regenerate the last exchange: keep through the last user message,
      // drop the answer(s) after it — the backend pops the stored pair too
      const cur = threadCache.get(key) || msgs
      let lastUser = -1
      for (let i = cur.length - 1; i >= 0; i--) { if (cur[i].role === 'user') { lastUser = i; break } }
      if (lastUser < 0) return
      q = String(cur[lastUser].content || '').trim()
      if (!q) return
      const cut = cur.slice(0, lastUser + 1)
      cacheMsgs(key, cut)
      setMsgs(cut)
    } else {
      q = (question || text).trim()
      if (!q) return
      setText('')
      setMsgs((m) => cacheMsgs(key, [...m, { role: 'user', content: q, k: `u${Date.now()}` }]))
    }
    const started = Date.now()
    TURN.send('ASK', { q, since: started })
    try {
      const agentRun = (agentMode === 'agent' || agentMode === 'council') && !retry
      const out = await api(agentRun ? '/agent/run' : '/ask', {
        method: 'POST',
        body: {
          notebook: notebook.id, question: q, thread: t,
          ...(agentRun ? { mode: agentMode } : {}),
          ...(retry ? { retry: true } : {}),
          ...(!agentRun && askScope && (askScope.ids || askScope.id)
            ? { source_ids: askScope.ids || [askScope.id] }
            : {})
        },
        timeoutMs: 240000
      })
      const answer = {
        role: 'assistant', content: out.answer, k: `a${Date.now()}`,
        citations: out.citations || [], seconds: out.seconds,
        actions: out.actions || [], council: out.council || null,
        meta: (out.actions || []).length
          ? `${out.actions.length} tool${out.actions.length === 1 ? '' : 's'} ran`
          : `${out.chunks_used || 0} of ${out.total_chunks || 0} passages`
      }
      const prev = threadCache.get(key) || []
      const next = cacheMsgs(key, [...prev, answer])
      if (curThread.current === t) setMsgs(next)
      // refresh /state so the thread list + default thread stay truthful
      if (reload) reload(true)
    } catch (e) {
      // A 404 here is not the model failing: /agent/* is served by the gateway,
      // which loads a plugin's routes once at start. Say which step is missing
      // instead of letting a fresh deploy look like a broken feature.
      const raw = String(e.message || e)
      const stale = agentMode === 'agent' && /404|not found|unauthenticated/i.test(raw)
      const errMsg = {
        role: 'assistant',
        content: stale
          ? '**Agent mode is not running yet.**\n\nThe page is the new build, but the gateway still has the old routes: restart it once (`hermes gateway restart` from a shell outside it) and this will go through. Powered Q&A keeps working meanwhile.'
          : `**That question did not get an answer.**\n\n${raw}`,
        k: `e${Date.now()}`, error: true
      }
      const prev = threadCache.get(key) || []
      const next = cacheMsgs(key, [...prev, errMsg])
      if (curThread.current === t) setMsgs(next)
      if (onSay) onSay(e.message || 'ask failed')
      TURN.send('FAIL')
    } finally {
      TURN.send('ANSWER')
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const elapsed = pending ? Math.round(((pending.now || Date.now()) - pending.since) / 1000) : 0
  const thrMeta = (threads || []).find((x) => x.name === thread)
  const thrLabel = (thrMeta && thrMeta.title) || (thread === 'default' ? 'Chat' : 'New chat')

  return el('div', { className: 'nb-chat' },
    el('div', { className: 'nb-chatscroll' },
    el('div', { className: 'nb-thread', ref: threadRef, onScroll: onThreadScroll, role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' },
      ov
        ? el('div', { className: 'nb-overview' },
            el('div', { className: 'nb-overview-head' },
              jsx(Glyph, { name: 'sparkle', size: 14 }),
              el('span', { className: 'nb-meta', children: 'Overview' }),
              el('span', { style: { flex: 1 } }),
              jsx(Btn, { size: 'sm', icon: 'copy', onClick: copyOv, children: 'Copy' }),
              jsx(Btn, { size: 'sm', icon: 'pin', onClick: saveNote, children: 'Save to note' })
            ),
            el('div', { className: 'nb-overview-body' },
              jsx(Markdown, { text: ov, onCite })))
        : null,
      !ov && ovErr
        ? el('div', { className: 'nb-overview' },
            el('div', { className: 'nb-overview-head' },
              jsx(Glyph, { name: 'sparkle', size: 14 }),
              el('span', { className: 'nb-meta', children: 'Overview' }),
              el('span', { style: { flex: 1 } }),
              jsx(Btn, {
                size: 'sm', icon: 'refresh',
                onClick: () => { ovCache.delete(notebook.id); setOvErr(false); setOvRetry((n) => n + 1) },
                children: 'Retry'
              })),
            el('div', { className: 'nb-overview-body' },
              el('div', { className: 'nb-hint',
                children: 'the briefing could not be generated — the model may be busy. retry, or ask a question below.' })))
        : null,
      msgs.length === 0 && !pending
        ? el('div', { style: { margin: msgs.length || ov ? '0' : 'auto', textAlign: 'center', maxWidth: '54ch' } },
            el('div', { style: { display: 'grid', placeItems: 'center', gap: '10px' } },
              el('span', { className: 'nb-mark', style: { width: '38px', height: '38px' } },
                jsx(Glyph, { name: 'sparkle', size: 19 })),
              el('div', { style: { fontSize: '20px', fontWeight: 650, letterSpacing: '-.015em' }, children: 'Ask the sources' }),
              el('div', {
                style: { color: T.text3, fontSize: '14px', lineHeight: 1.6 },
                children: 'Every answer is built from this notebook and cites the source it came from. If the sources do not cover it, the answer says so.'
              })))
        : null,
      msgs.length === 0 && !pending && sugg && (sugg.questions || []).length
        ? el('div', { style: { marginTop: ov ? '18px' : '0' } },
            el('div', { className: 'nb-meta', style: { marginBottom: '10px' }, children: 'Suggested questions' }),
            el('div', { className: 'nb-suggest-grid' },
              sugg.questions.slice(0, 3).map((question) => el('button', {
                key: question, type: 'button', className: 'nb-suggest',
                onClick: () => send(question),
                'aria-label': `Ask: ${question}`,
                children: [
                  el('span', { className: 'nb-suggest-q', children: question }),
                  el('span', { className: 'nb-suggest-go', 'aria-hidden': 'true' },
                    jsx(Glyph, { name: 'arrowRight', size: 14 }))
                ]
              }, question))),
            (sugg.gaps || []).length
              ? el('div', { className: 'nb-gaprow', style: { marginTop: '14px' } },
                  el('span', { className: 'nb-meta', children: 'Source gaps' }),
                  sugg.gaps.slice(0, 3).map((g) => jsx(Chip, {
                    key: g, onClick: () => onFindSources && onFindSources(g),
                    title: 'Find sources for this gap', children: g
                  })))
              : null,
            (sugg.artifacts || []).length
              ? el('div', { className: 'nb-gaprow', style: { marginTop: '14px' } },
                  el('span', { className: 'nb-meta', children: 'Worth making' }),
                  sugg.artifacts.slice(0, 4).map((a) => {
                    const [kid, ...rest] = String(a).split(':')
                    const kindId = (kid || '').trim()
                    const known = (kinds || []).some((k) => k.id === kindId)
                    const reason = rest.join(':').trim() || kindId
                    return jsx(Chip, {
                      key: a,
                      onClick: known && generate ? () => generate(kindId) : undefined,
                      title: known ? `Generate ${kindLabel(kindId)}` : 'unknown output kind',
                      children: reason
                    })
                  }))
              : null)
        : null,
      msgs.length === 0 && !pending && !sugg && suggErr
        ? el('div', { className: 'nb-gaprow', style: { marginTop: ov ? '18px' : '0' } },
            el('span', { className: 'nb-hint', children: 'suggestions could not be generated — the model may be busy.' }),
            jsx(Btn, {
              size: 'sm', icon: 'refresh', children: 'Retry',
              onClick: () => { ovCache.delete(notebook.id); setOvRetry((n) => n + 1) }
            }))
        : null,
      msgs.map((m, i) => jsx(Msg, {
        msg: m, onCite, onOpenSource, notebook, onSay, reload,
        canRetry: !pending && m.role === 'assistant' && i === msgs.length - 1 &&
                  msgs.slice(0, i).some((x) => x.role === 'user'),
        onRetry: () => send(null, { retry: true })
      }, m.k)),
      pending
        ? el('div', { className: 'nb-msg', 'data-role': 'assistant' },
            el('span', { className: 'nb-avatar', 'aria-hidden': 'true' },
              jsx(Glyph, { name: 'sparkle', size: 14 })),
            el('div', { className: 'nb-msg-body' },
              el('div', { className: 'nb-who', children: 'Reading sources' }),
              el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', color: T.text3, fontSize: '14px' } },
                el('span', { className: 'nb-dot', style: { background: T.accent, boxShadow: `0 0 8px ${T.accent}` } }),
                `retrieving passages · ${elapsed}s`,
                // a spinner that cannot be dismissed is a lie about control; the
                // server keeps working, the page stops waiting
                el('button', {
                  type: 'button', className: 'nb-linkbtn', 'aria-label': 'Stop waiting for the answer',
                  onClick: () => { TURN.send('CANCEL'); if (onSay) onSay('stopped waiting — the answer may still arrive on the server') },
                  style: { marginLeft: '4px', fontSize: '13px', color: T.text3, background: 'none',
                           border: 'none', cursor: 'pointer', textDecoration: 'underline' },
                  children: 'stop waiting'
                }))))
        : null
    ),
    showLatest
      ? el('button', {
          type: 'button', className: 'nb-latest',
          'aria-label': 'Jump to the newest message',
          onClick: () => {
            const node = threadRef.current
            if (node) node.scrollTop = node.scrollHeight
            stickRef.current = true
            setShowLatest(false)
          },
          children: [jsx(Glyph, { name: 'chevron', size: 13 }), ' latest']
        })
      : null),

    el('div', { className: 'nb-composer' },
      msgs.length === 0 && !pending
        ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' } },
            SUGGEST.map((s) => jsx(Chip, {
              key: s, onClick: () => { setText(s); const n = boxRef.current; if (n) n.focus() },
              title: 'Use this question', children: s
            })))
        : null,
      el('div', { className: 'nb-askbox' },
        // What "send" is allowed to do. The pill is the consent control for
        // agent mode: nothing runs a query or a script until the reader picks it.
        el('div', { className: 'nb-modes', role: 'group', 'aria-label': 'Answer mode' },
          [['grounded', 'Grounded', 'Answers only from your sources, with citations'],
           ['agent', 'Agent + tools', 'May run one SQL query or a short script, grounded in the sources'],
           ['council', 'Council', 'Answer, then re-read the passages trying to break that answer']]
            .map(([id, label, title]) => el('button', {
              key: id, type: 'button', className: 'nb-mode',
              'data-active': agentMode === id ? 'true' : 'false',
              'aria-pressed': agentMode === id,
              title,
              onClick: () => setMode(id),
              children: [jsx(Glyph, { name: id === 'agent' ? 'terminal' : id === 'council' ? 'shield' : 'lock', size: 13 }),
                         el('span', { children: label })]
            }))),
        el('textarea', {
          ref: boxRef, value: text, onChange: (e) => setText(e.target.value), onKeyDown: onKey,
          placeholder: agentMode === 'agent'
            ? 'Ask something, and Hermes may run a query or a script'
            : agentMode === 'council'
              ? 'Ask something, and Hermes will try to break its own answer'
              : 'Ask a question or create something',
          'aria-label': 'Ask the notebook',
          rows: 2
        }),
        el('div', { className: 'nb-askfoot' },
          // The conversation title is a QUESTION ("What does the sources say about
          // funding?"), so this chip is as wide as the question. Unshrunk it
          // pushed the Send button 21px past the column edge at 1330px; capped
          // and ellipsized it stays a chip and the primary action keeps its slot.
          el('button', {
            type: 'button', className: 'nb-chip nb-thrchip',
            title: 'Conversations — switch or start a new chat',
            onClick: () => setThrOpen(true)
          }, el('span', { children: `💬 ${thrLabel}` })),
          jsx(Chip, {
            title: `${activeCount} of ${stats.sources || 0} sources are in context`,
            children: `${activeCount} source${activeCount === 1 ? '' : 's'}`
          }),
          askScope
            ? jsx(Chip, {
                tone: 'accent',
                title: `Answering from ${askScope.title} only — click to clear`,
                onClick: () => setAskScope && setAskScope(null),
                children: `only: ${String(askScope.title || 'sources').slice(0, 28)}`
              })
            : null,
          jsx(IconBtn, {
            icon: 'layers', label: 'Choose which sources to answer from',
            onClick: () => setScopeOpen(true)
          }),
          jsx(IconBtn, {
            icon: 'sliders', label: 'Configure chat',
            onClick: () => {
              const o = notebook.options || {}
              setCfg({
                chat_style: o.chat_style || 'default',
                chat_length: o.chat_length || 'medium',
                chat_custom: o.chat_custom || ''
              })
              setCfgOpen(true)
            }
          }),
          jsx(IconBtn, {
            icon: 'download', label: 'Export this chat (.md)', disabled: !msgs.length,
            onClick: () => {
              const lines = [
                `# ${notebook.title} — chat`, '',
                `*${thrLabel} · exported ${new Date().toISOString().slice(0, 10)}*`, ''
              ]
              for (const m of msgs) {
                lines.push(m.role === 'user' ? '## You' : '## Hermes Notebook', '', m.content || '', '')
                if (m.citations && m.citations.length) {
                  lines.push('Sources: ' + m.citations.map((c) => `[S${c.n}] ${c.title}`).join(' · '), '')
                }
              }
              const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `${String(notebook.title || 'chat').replace(/[^\w]+/g, '-').toLowerCase()}-chat.md`
              document.body.appendChild(a); a.click(); a.remove()
              setTimeout(() => URL.revokeObjectURL(a.href), 4000)
            }
          }),
          el('span', { className: 'nb-hint', style: { marginLeft: 'auto' },
            children: modelReady ? '↵ Send · ⇧↵ New line' : 'model offline — enable the plugin and restart the gateway' }),
          el('button', {
            type: 'button', className: 'nb-sendbtn',
            onClick: () => send(), disabled: !text.trim() || !!pending,
            'aria-label': pending ? 'Asking…' : 'Send question',
            title: pending ? 'Asking…' : 'Send (↵ — ⇧↵ for a new line)',
            children: jsx(Glyph, { name: 'send', size: 15 })
          }))
      ),
      el('div', { className: 'nb-disclaimer',
        children: 'Hermes Notebook can make mistakes — double-check it.' }),
      cfgOpen
        ? jsx(Dialog, {
            open: true,
            title: 'Configure chat',
            onClose: () => setCfgOpen(false),
            children: el('div', { style: { display: 'grid', gap: '16px' } },
              el('div', null,
                el('div', { className: 'nb-meta', style: { marginBottom: '8px' }, children: 'Response style' }),
                jsx(Seg, {
                  label: 'Response style', fill: true,
                  value: cfg.chat_style || 'default',
                  onChange: (v) => setCfg((c) => ({ ...c, chat_style: v })),
                  options: [
                    { id: 'default', label: 'Default' },
                    { id: 'learning_guide', label: 'Learning guide' },
                    { id: 'custom', label: 'Custom' }
                  ]
                }),
                cfg.chat_style === 'custom'
                  ? el('input', {
                      className: 'nb-genopt-text', type: 'text',
                      placeholder: 'e.g. always end with a checklist',
                      value: cfg.chat_custom || '',
                      onChange: (e) => setCfg((c) => ({ ...c, chat_custom: e.target.value })),
                      style: { marginTop: '8px', width: '100%' }
                    })
                  : null),
              el('div', null,
                el('div', { className: 'nb-meta', style: { marginBottom: '8px' }, children: 'Response length' }),
                jsx(Seg, {
                  label: 'Response length', fill: true,
                  value: cfg.chat_length || 'medium',
                  onChange: (v) => setCfg((c) => ({ ...c, chat_length: v })),
                  options: [
                    { id: 'short', label: 'Short' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'long', label: 'Long' }
                  ]
                })),
              el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
                jsx(Btn, { onClick: () => setCfgOpen(false), children: 'Cancel' }),
                jsx(Btn, {
                  variant: 'primary', disabled: cfgBusy,
                  onClick: async () => {
                    setCfgBusy(true)
                    try {
                      await api('/options', {
                        method: 'POST',
                        body: {
                          notebook: notebook.id,
                          options: {
                            chat_style: cfg.chat_style === 'custom' ? 'custom' : cfg.chat_style,
                            chat_length: cfg.chat_length,
                            chat_custom: cfg.chat_style === 'custom' ? cfg.chat_custom : ''
                          }
                        },
                        timeoutMs: 30000
                      })
                      setCfgOpen(false)
                      if (reload) reload()
                    } catch (e) {
                      onSay && onSay(`could not save chat options: ${e.message || e}`)
                    } finally {
                      setCfgBusy(false)
                    }
                  },
                  children: 'Save'
                })))
            })
        : null,
      scopeOpen
        ? jsx(ScopeDialog, {
            notebook, current: askScope,
            onClose: () => setScopeOpen(false),
            onPick: (scope) => { if (setAskScope) setAskScope(scope); setScopeOpen(false) }
          })
        : null,
      thrOpen
        ? jsx(ThreadDialog, {
            notebook, threads, current: thread,
            onClose: () => setThrOpen(false),
            onPick: (name) => { setThread(name); setThrOpen(false) },
            onNew: async (title) => {
              try {
                const out = await api('/thread/new', {
                  method: 'POST',
                  body: { notebook: notebook.id, title: title || '' },
                  timeoutMs: 30000
                })
                const name = (out && out.thread && out.thread.name) || `chat-${Date.now().toString(36)}`
                threadCache.set(`${notebook.id}:${name}`, [])
                setThreads((ts) => [{ name, title: (out && out.thread && out.thread.title) || 'New chat',
                                      count: 0, updated: '' }, ...ts])
                setThread(name); setThrOpen(false)
              } catch (e) { onSay && onSay(`could not start a chat: ${e.message || e}`) }
            },
            onRename: async (name, title) => {
              try {
                const out = await api('/thread/rename', {
                  method: 'POST',
                  body: { notebook: notebook.id, thread: name, title },
                  timeoutMs: 30000
                })
                const fresh = (out && out.thread) || {}
                setThreads((ts) => ts.map((t) => (t.name === name
                  ? { ...t, title: fresh.title || title } : t)))
                if (reload) reload(true)
              } catch (e) { onSay && onSay(`could not rename: ${e.message || e}`) }
            },
            onDelete: async (name) => {
              try {
                await api('/thread/delete', {
                  method: 'POST',
                  body: { notebook: notebook.id, thread: name, confirm: true },
                  timeoutMs: 30000
                })
                const key = `${notebook.id}:${name}`
                threadCache.delete(key)
                setThreads((ts) => ts.filter((t) => t.name !== name))
                if (name === thread) {
                  if (name === 'default') { cacheMsgs(key, []); setMsgs([]) }
                  else setThread('default')
                }
                if (reload) reload(true)
                if (onSay) onSay('conversation deleted')
              } catch (e) { onSay && onSay(`could not delete chat: ${e.message || e}`) }
            }
          })
        : null
    )
  )
}

/* pick which sources the next answers draw from — NotebookLM's per-chat
   source selection. Scope rides /ask's source_ids (max 12 server-side). */
function ScopeDialog({ notebook, current, onClose, onPick }) {
  const sources = (notebook && notebook.sources) || []
  const curIds = new Set((current && (current.ids || (current.id ? [current.id] : []))) || [])
  const [sel, setSel] = useState(() => new Set(curIds))
  const toggle = (id) => setSel((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const ids = [...sel]
  const title = ids.length === 1
    ? (sources.find((s) => s.id === ids[0]) || {}).title || '1 source'
    : `${ids.length} sources`
  return jsx(Dialog, {
    open: true, onClose, title: 'Answer from', width: 480,
    children: el('div', { style: { display: 'grid', gap: '8px' } },
      sources.length > 12
        ? el('div', { className: 'nb-hint', style: { marginBottom: '4px' },
            children: 'At most 12 sources can scope one answer — pick the most relevant.' })
        : null,
      sources.map((s) => el('button', {
        key: s.id, type: 'button', className: 'nb-thrrow',
        onClick: () => toggle(s.id),
        'aria-pressed': sel.has(s.id) ? 'true' : 'false'
      },
        el('span', {
          className: 'nb-scope-check' + (sel.has(s.id) ? ' on' : ''),
          'aria-hidden': 'true',
          children: sel.has(s.id) ? '✓' : ''
        }),
        el('span', { className: 'nb-chip', 'data-tone': 'accent', children: `S${s.n}` }),
        el('span', { style: { flex: 1, minWidth: 0, textAlign: 'left' } },
          el('div', { style: { fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            children: s.title }),
          el('div', { className: 'nb-meta', children: kindLabel(s.kind) })))),
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '10px' } },
        jsx(Btn, {
          size: 'sm', onClick: () => onPick(null),
          children: 'All sources'
        }),
        jsx(Btn, {
          size: 'sm', variant: 'primary', disabled: !ids.length,
          onClick: () => onPick({ ids: ids.slice(0, 12), title }),
          children: ids.length ? `Use ${ids.length} source${ids.length === 1 ? '' : 's'}` : 'Pick sources'
        })))
  })
}

function ThreadDialog({ notebook, threads, current, onClose, onPick, onNew, onDelete, onRename }) {
  const list = threads && threads.length ? threads : [{ name: 'default', title: 'Chat', count: 0 }]
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState('')
  const [confirming, setConfirming] = useState('')

  const commit = (name) => {
    const next = draft.trim()
    setEditing('')
    if (next && onRename) onRename(name, next)
  }

  return jsx(Dialog, {
    open: true, onClose, title: 'Conversations', width: 560,
    children: el('div', { style: { display: 'grid', gap: '12px' } },
      el('div', { className: 'nb-newthread' },
        el('input', {
          className: 'nb-genopt-text', type: 'text',
          placeholder: 'Name a new conversation (optional)',
          'aria-label': 'New conversation name',
          value: title,
          onChange: (e) => setTitle(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter') { onNew(title); setTitle('') } }
        }),
        jsx(Btn, {
          size: 'sm', variant: 'primary', icon: 'plus',
          onClick: () => { onNew(title); setTitle('') },
          children: 'Start'
        })),
      el('div', { className: 'nb-thrlist', role: 'list', 'aria-label': 'Conversations' },
        list.map((t) => {
          const on = t.name === current
          const isEditing = editing === t.name
          return el('div', { key: t.name, className: 'nb-thrwrap', role: 'listitem',
                             'data-on': on ? 'true' : 'false' },
            isEditing
              ? el('div', { className: 'nb-thredit' },
                  el('input', {
                    className: 'nb-genopt-text', type: 'text', autoFocus: true,
                    'aria-label': `Rename ${t.title || t.name}`,
                    value: draft,
                    onChange: (e) => setDraft(e.target.value),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter') commit(t.name)
                      if (e.key === 'Escape') setEditing('')
                    }
                  }),
                  jsx(Btn, { size: 'sm', onClick: () => commit(t.name), children: 'Save' }))
              : el('div', { style: { display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 } },
                  el('button', {
                    type: 'button',
                    className: 'nb-thrrow' + (on ? ' is-current' : ''),
                    onClick: () => onPick(t.name),
                    'aria-current': on ? 'true' : undefined,
                    children: [
                      el('div', { style: { flex: 1, minWidth: 0 } },
                        el('div', { style: { fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                          children: t.title || t.name }),
                        el('div', { className: 'nb-meta',
                          children: `${t.count || t.messages || 0} messages`
                                   + (t.updated ? ` · ${ago(t.updated)}` : '') })),
                      on ? jsx(Glyph, { name: 'check', size: 15 }) : null
                    ]
                  }),
                  jsx(IconBtn, {
                    icon: 'note', size: 13, label: `Rename conversation — ${t.title || t.name}`,
                    onClick: () => { setEditing(t.name); setDraft(t.title || ''); setConfirming('') }
                  }),
                  confirming === t.name
                    ? jsx(Btn, {
                        size: 'sm', className: 'nb-danger',
                        label: `Confirm delete — ${t.title || t.name}`,
                        onClick: () => { setConfirming(''); onDelete(t.name) },
                        children: 'Really delete'
                      })
                    : jsx(IconBtn, {
                        icon: 'trash', size: 13, label: `Delete conversation — ${t.title || t.name}`,
                        onClick: () => setConfirming(t.name)
                      })))
        })),
      el('div', { className: 'nb-hint',
        children: 'Each conversation keeps its own history; answers still cite the same sources.' }))
  })
}

function tidyQuote(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^(skip to (main )?content[\s:.—-]*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const CITE_TEXT_CACHE = new Map()

function Msg({ msg, onCite, notebook, canRetry, onRetry, onSay, reload }) {
  const isUser = msg.role === 'user'
  const [citePop, setCitePop] = useState(null)

  const citeFor = (n) => (msg.citations || []).find((c) => c.n === n)
  // hand the whole citation up — its snippet lets the source open at the
  // exact passage the answer cited
  const citeClick = (n) => onCite && onCite(n, citeFor(n))

  const onMouseOver = (e) => {
    const b = e.target && e.target.closest ? e.target.closest('.nb-inline-cite, .nb-citechip') : null
    if (!b || !notebook) return
    const n = Number(b.getAttribute('data-n'))
    const c = citeFor(n)
    if (!c) return
    const r = b.getBoundingClientRect()
    // citations carry the passage they were built from — show it instantly;
    // older messages without snippets fall back to the source's head
    const raw = c.snippet ? String(c.snippet).replace(/\s+/g, ' ').trim() : ''
    // a snippet that is only the marker ("[S1]") or a stub is worse than none:
    // it reads as the quote. Fall through to the source's own opening passage.
    const usable = raw.replace(/\[S\d+\]/gi, '').trim().length >= 40
    const snippet = usable ? raw.slice(0, 420) : ''
    setCitePop({ n, x: r.left, y: r.bottom + 8, title: c.title, kind: c.kind, id: c.id, text: snippet || null, loading: !snippet })
    if (snippet) return
    const key = `${notebook.id}:${c.id || n}`
    if (CITE_TEXT_CACHE.has(key)) {
      setCitePop((p) => (p && p.n === n ? { ...p, text: CITE_TEXT_CACHE.get(key), loading: false } : p))
      return
    }
    if (!c.id) { setCitePop((p) => (p && p.n === n ? { ...p, loading: false } : p)); return }
    api(`/source_text?${qs({ notebook: notebook.id, id: c.id, chars: 700 })}`, { timeoutMs: 20000 })
      .then((out) => {
        const passage = String(out.text || out.source_text || '').replace(/\s+/g, ' ').trim().slice(0, 420)
        CITE_TEXT_CACHE.set(key, passage)
        setCitePop((p) => (p && p.n === n ? { ...p, text: passage, loading: false } : p))
      })
      .catch(() => {
        CITE_TEXT_CACHE.set(key, '')
        setCitePop((p) => (p && p.n === n ? { ...p, text: '', loading: false } : p))
      })
  }
  const onMouseOut = (e) => {
    const b = e.target && e.target.closest ? e.target.closest('.nb-inline-cite, .nb-citechip') : null
    if (b) setCitePop(null)
  }

  return el('div', { className: 'nb-msg', 'data-role': isUser ? 'user' : 'assistant' },
    isUser ? null : el('span', { className: 'nb-avatar', 'aria-hidden': 'true' },
              jsx(Glyph, { name: 'sparkle', size: 14 })),
    el('div', { className: 'nb-msg-body', onMouseOver: isUser ? undefined : onMouseOver, onMouseOut: isUser ? undefined : onMouseOut },
      isUser
        ? el('div', { className: 'nb-bubble' },
            el('div', { className: 'nb-who', children: 'You' }),
            el('div', { children: msg.content }))
        : el('div', null,
            msg.council ? jsx(CouncilBand, { council: msg.council, onSay }) : null,
            (msg.actions || []).length
              ? el('div', { className: 'nb-acts' }, msg.actions.map((a, i) => jsx(ActionCard, {
                  key: i, action: a, notebook, onSay,
                  onSaved: reload ? () => reload(true) : null
                })))
              : null,
            el('div', { className: 'nb-who' },
              'Hermes Notebook',
              msg.meta ? el('span', { style: { marginLeft: '8px', color: T.text4, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }, children: `· ${msg.meta}` }) : null,
              jsx(IconBtn, {
                icon: 'copy', size: 13, label: 'Copy answer',
                onClick: () => copyText(msg.content, onSay)
              }),
              canRetry
                ? jsx(IconBtn, { icon: 'refresh', size: 13, label: 'Regenerate this answer', onClick: onRetry })
                : null,
              notebook ? jsx(IconBtn, {
                icon: 'pin', size: 13, label: 'Save this answer as a note',
                onClick: async () => {
                  try {
                    const first = String(msg.content || '').split('\n').find((l) => l.trim()) || 'Notebook answer'
                    await api('/note', {
                      method: 'POST',
                      body: { notebook: notebook.id, text: msg.content, title: first.slice(0, 90) },
                      timeoutMs: 30000
                    })
                    if (onSay) onSay('saved as a note — it is a source now')
                    if (reload) await reload(true)
                  } catch (e) { if (onSay) onSay(`could not save the note: ${e.message || e}`) }
                }
              }) : null),
            el('div', { className: 'nb-bubble' },
              jsx(Markdown, { text: msg.content, onCite: citeClick })),
            (msg.citations || []).length
              ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }, role: 'list', 'aria-label': 'Citations' },
                  msg.citations.map((c) => el('button', {
                    key: `${c.n}-${c.title}`, type: 'button', className: 'nb-chip nb-citechip',
                    'data-n': c.n,
                    onClick: () => citeClick(c.n),
                    title: c.origin || c.title,
                    'aria-label': `Citation ${c.n} — ${c.title}`,
                    children: [el('b', { children: `S${c.n}` }), el('span', { children: c.title })]
                  })))
              : null)),
    citePop
      ? el('div', {
          className: 'nb-citepop', role: 'tooltip',
          style: { left: `${Math.min(citePop.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 340)}px`, top: `${citePop.y}px` },
          children: [
            el('div', { className: 'nb-citepop-head' },
              el('b', { children: `S${citePop.n}` }),
              el('span', { children: citePop.title || 'source' }),
              citePop.kind ? el('span', { className: 'nb-meta', children: citePop.kind }) : null),
            el('div', { className: 'nb-citepop-body',
              children: citePop.loading
                ? 'reading the passage…'
                : citePop.text
                  // a scraped page opens with nav: "[Skip to main content](…)".
                  // Show the words, not the markdown that wrapped them.
                  ? `“${tidyQuote(citePop.text)}${citePop.text.length >= 420 ? '…' : ''}”`
                  : 'passage unavailable — click the citation to open the source' })
          ]
        })
      : null
  )
}

/* ---------------------------------------------------------------- peek */

function SourcePeek({ source, notebook, onClose, onAskAbout, onRefresh, onPrev, onNext, onSay }) {
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [hi, setHi] = useState(null)
  useEffect(() => {
    let live = true
    setText('')
    setHi(null)
    api(`/source_text?${qs({ notebook: notebook.id, id: source.id, chars: 24000 })}`)
      .then((out) => { if (live) setText(out.text || '') })
      .catch((e) => { if (live) setErr(e.message || String(e)) })
    return () => { live = false }
  }, [source.id, notebook.id, source.chars, source.refreshed_at])

  // a citation carries the passage it was built from — find it in the stored
  // text (whitespace-normalized, since chunks reflow) and mark it
  const citeSnippet = source.citeSnippet || ''
  useEffect(() => {
    setHi(null)
    const h = String(citeSnippet).replace(/\s+/g, ' ').trim()
    if (!text || h.length < 20) return undefined
    const norm = []
    const map = []
    let ws = false
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i]
      if (/\s/.test(c)) {
        if (!ws) { norm.push(' '); map.push(i) }
        ws = true
      } else { norm.push(c); map.push(i); ws = false }
    }
    const ntext = norm.join('')
    for (const len of [h.length, 240, 140, 80]) {
      if (len > h.length) continue
      const needle = h.slice(0, len)
      const ni = ntext.indexOf(needle)
      if (ni < 0) continue
      const start = map[ni]
      const end = map[Math.min(ni + needle.length - 1, map.length - 1)] + 1
      setHi({ start, end })
      break
    }
    return undefined
  }, [text, citeSnippet])

  useEffect(() => {
    if (!hi) return undefined
    const n = document.querySelector('.nb-hl')
    if (n) n.scrollIntoView({ block: 'center' })
    return undefined
  }, [hi])
  return el('div', { className: 'nb-view' },
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: `S${source.n}` }),
      jsx(Sigil, { seed: source.id || source.title, size: 26 }),
      el('div', { style: { flex: '1 1 auto', minWidth: 0 } },
        el('div', { className: 'nb-view-title', title: source.title, children: source.title }),
        el('div', { className: 'nb-view-sub',
          children: `${kindLabel(source.kind)} · ${nfmt(source.chars)} chars · ${source.origin || 'stored text'}` +
            (source.refreshed_at ? ` · refreshed ${ago(source.refreshed_at)}` : '') })),
      el('div', { className: 'nb-view-acts' },
      source.origin && source.origin.startsWith('http')
        ? jsx(IconBtn, { icon: 'external', label: 'Open the original', onClick: () => host.openLink ? host.openLink(source.origin) : window.open(source.origin, '_blank') })
        : null,
      text
        ? jsx(IconBtn, {
            icon: 'copy', label: 'Copy source text',
            onClick: () => copyText(text, onSay)
          })
        : null,
      onRefresh && !['note', 'text'].includes(source.kind)
        ? jsx(IconBtn, {
            icon: 'refresh', label: 'Refresh source — re-fetch it from its origin',
            active: refreshing, disabled: refreshing,
            onClick: async () => {
              setRefreshing(true)
              try { await onRefresh() } finally { setRefreshing(false) }
            }
          })
        : null,
      onPrev ? jsx(IconBtn, { icon: 'arrowLeft', label: `Previous source — S${source.n - 1}`, onClick: onPrev }) : null,
      onNext ? jsx(IconBtn, { icon: 'arrowRight', label: `Next source — S${source.n + 1}`, onClick: onNext }) : null,
      jsx(IconBtn, { icon: 'close', label: 'Close source', onClick: onClose }))
    ),
    el('div', { className: 'nb-view-body' },
      onAskAbout
        ? el('div', { style: { marginBottom: '14px' } },
            jsx(Btn, {
              size: 'sm', icon: 'faq',
              onClick: () => onAskAbout(source),
              children: 'Ask about this source'
            }))
        : null,
      (source.labels || []).length || source.summary
        ? el('div', { style: { marginBottom: '14px', display: 'grid', gap: '8px' } },
            source.summary
              ? el('div', { style: { fontSize: '14px', color: T.text2, lineHeight: 1.55 }, children: source.summary })
              : null,
            (source.labels || []).length
              ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
                  jsx(Glyph, { name: 'tag', size: 13 }),
                  source.labels.map((l) => jsx(Chip, { key: l, children: l })))
              : null)
        : null,
      err
        ? el('div', { style: { color: T.danger }, children: err })
        : text
          ? el('pre', {
              className: 'nb-mono',
              style: { whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7, color: T.text2, margin: 0 },
              children: hi
                ? [text.slice(0, hi.start),
                   el('mark', { key: 'hl', className: 'nb-hl', children: text.slice(hi.start, hi.end) }),
                   text.slice(hi.end)]
                : text
            })
          : el('div', { className: 'nb-hint', children: 'reading…' }))
  )
}

/* --------------------------------------------------------------- studio panel */

function StudioPanel({ kinds, notebook, busy, generate, filter, setFilter, onOpen, onDelete, onCollapse, onAddNote }) {
  const ready = latestByKind(notebook ? notebook.artifacts : [])
  const arts = (notebook && notebook.artifacts) || []
  const kindGroup = {}
  for (const k of kinds) kindGroup[k.id] = k.group || 'other'
  const shownArts = arts.filter((a) => filter === 'all' || kindGroup[a.kind] === filter)
  const scrollRef = useRef(null)
  const [canScroll, setCanScroll] = useState(false)
  const readyCount = Object.keys(ready).length
  const runningCount = Object.keys(busy || {}).length

  // A list taller than the panel is fine, but a row sliced at the panel edge
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
  }, [shownArts.length, filter])

  /* The workbench reads top to bottom in the order work actually happens:
   * what can be made (grouped by what it makes), then what has been made.
   * The old panel was one undifferentiated 2-col grid followed by a list, so
   * "Video Overview" and "Data Table" sat at the same weight even though one
   * is a 60-second render and the other is a spreadsheet. */
  const groups = useMemo(() => {
    const order = ['media', 'docs', 'study', 'visual', 'other']
    const label = { media: 'Listen & watch', docs: 'Read', study: 'Study', visual: 'Visualise', other: 'More' }
    const map = {}
    for (const k of kinds) {
      const g = k.group || 'other'
      if (!map[g]) map[g] = []
      map[g].push(k)
    }
    return order.filter((g) => map[g] && map[g].length)
      .map((g) => ({ id: g, label: label[g] || 'More', kinds: map[g] }))
  }, [kinds])

  const [openGroups, setOpenGroups] = useState({})
  const isOpen = (id) => openGroups[id] !== false

  /* The workbench's first half: every output kind, grouped by what it makes.
   * A group header is a real button (aria-expanded) so a crowded panel can be
   * folded down to the one family being worked in. */
  const groupBlocks = groups.map((g) => el('div', { key: g.id, className: 'nb-group' },
    el('button', {
      type: 'button', className: 'nb-group-head',
      'aria-expanded': isOpen(g.id) ? 'true' : 'false',
      onClick: () => setOpenGroups((o) => ({ ...o, [g.id]: o[g.id] === false })),
      children: [
        jsx(Glyph, { name: GROUP_ICON[g.id] || 'grid', size: 13 }),
        el('span', { className: 'nb-group-name', children: g.label }),
        el('span', { className: 'nb-group-count',
          children: `${g.kinds.filter((k) => ready[k.id]).length} of ${g.kinds.length}` }),
        el('span', { className: 'nb-group-chev', 'aria-hidden': 'true',
          children: jsx(Glyph, { name: 'chevron', size: 13 }) })
      ]
    }),
    isOpen(g.id)
      ? el('div', { className: 'nb-gen-grid' },
          g.kinds.map((k) => jsx(GenPill, {
            key: k.id, kind: k, art: ready[k.id], started: busy[k.id],
            nbId: notebook && notebook.id,
            onOpen: () => { const art = ready[k.id]; if (art) onOpen(art); else generate(k.id) },
            onGenerate: (opts) => generate(k.id, opts)
          })))
      : null
  ))

  return el('aside', { className: 'nb-col nb-studio', 'aria-label': 'Studio' },
    el('div', { className: 'nb-pane-head nb-studio-head' },
      el('span', { className: 'nb-pane-title', children: 'Make' }),
      el('span', {
        className: 'nb-chip',
        'data-tone': readyCount ? 'ok' : undefined,
        title: `${readyCount} of ${kinds.length} outputs have a latest run`,
        children: readyCount === kinds.length ? 'All ready' : `${readyCount} of ${kinds.length} ready`
      }),
      runningCount ? el('span', { className: 'nb-chip', 'data-tone': 'accent',
        children: `${runningCount} writing` }) : null,
      jsx(IconBtn, { icon: 'arrowRight', label: 'Hide the make panel (Ctrl+\\)', onClick: onCollapse })
    ),

    el('div', { className: 'nb-studio-body nb-scroll', ref: scrollRef,
      'data-scrollable': canScroll ? 'true' : 'false' },
      // the pane already says "Make · n of m"; this row only earns its space
      // when there is nothing to open yet
      readyCount
        ? null
        : el('div', { className: 'nb-studio-sec' },
            el('div', { className: 'nb-studio-sec-head' },
              el('span', { className: 'nb-hint', children: 'Nothing made yet — pick an output below.' }))),
      groupBlocks,
      el('div', { className: 'nb-studio-sec-head nb-studio-runs' },
        el('span', { className: 'nb-meta', children: 'Every run' }),
        el('span', { className: 'nb-hint', children: `· ${shownArts.length}` }),
        el('span', { style: { flex: 1 } }),
        jsx(IconBtn, { icon: 'note', size: 14, label: 'Add a note as a source', onClick: onAddNote, disabled: !notebook }),
        el('span', { className: 'nb-hint', title: 'every run on disk', children: 'newest first' })),
      el('div', { className: 'nb-chiprow nb-studio-filters' },
        FILTERS.map((f) => jsx(Chip, {
          key: f.id, tone: filter === f.id ? 'accent' : undefined,
          pressed: filter === f.id,
          onClick: () => setFilter(f.id),
          title: `${f.label} artifacts`, children: f.label
        }))),
      el('div', { className: 'nb-artlist' },
        shownArts.length === 0
            ? el('div', { className: 'nb-empty-out' },
                jsx(Glyph, { name: notebook && notebook.sources && notebook.sources.length ? 'sparkle' : 'layers', size: 18 }),
                el('span', { children: notebook && notebook.sources && notebook.sources.length
                  ? 'Nothing generated yet — pick an output above.'
                  : 'Add sources first — every output is built from them.' }))
            : shownArts.map((a, i) => el('div', { key: a.key || a.primary || i, className: 'nb-artrow' },
                el('button', {
                  type: 'button', className: 'nb-art',
                  'data-kind': a.kind,
                  onClick: () => onOpen(a),
                  'aria-label': `Open ${a.title || a.label || a.kind}`,
                  title: `${a.title || a.primary || a.label}${optsSummary(a.opts) ? ` — ${optsSummary(a.opts)}` : ''}`,
                  'data-ready': 'true',
                  children: [
                    el('span', { className: 'nb-art-ico', 'aria-hidden': 'true' },
                      i < 12 ? jsx(ArtThumb, { run: a, nbId: notebook && notebook.id })
                        : jsx(Glyph, { name: KIND_ICON[a.kind] || 'doc', size: 17 })),
                    el('span', { className: 'nb-art-main' },
                      el('span', { className: 'nb-art-title', children: a.title || a.label || a.kind }),
                      el('span', { className: 'nb-art-sub',
                        children: `Ready · ${ago(a.modified)}${a.opts && Object.keys(a.opts).length ? ' · tailored' : ''}` })),
                    // a finished run is distinguishable from a not-yet-made one at a
                    // glance: green accent + an open affordance that appears on hover
                    el('span', { className: 'nb-art-go', 'aria-hidden': 'true' },
                      jsx(Glyph, { name: 'arrowRight', size: 14 }))
                  ]
                }, a.key || a.primary || i),
                onDelete ? jsx(IconBtn, {
                  icon: 'trash', size: 13, className: 'nb-art-del',
                  label: `Delete ${a.label || a.kind} artifact`,
                  onClick: () => onDelete(a)
                }) : null))),
      canScroll ? jsx('div', { className: 'nb-fade', 'aria-hidden': 'true' }) : null)
  )
}

function GenPill({ kind, art, started, nbId, onOpen, onGenerate }) {
  const [, force] = useState(0)
  const [opts, setOpts] = useState({})
  const [cfgOpen, setCfgOpen] = useState(false)
  const [notes, setNotes] = useState(null)
  const [notesBusy, setNotesBusy] = useState(false)
  const optSpecs = kind.options || []
  useEffect(() => {
    if (!started) return undefined
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [started])
  // prefill the customize popover with the knobs the latest run actually used
  useEffect(() => {
    if (art && art.opts && Object.keys(art.opts).length && !Object.keys(opts).length) {
      setOpts({ ...art.opts })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art && art.key])
  const secs = started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : 0
  const state = started ? `writing · ${secs}s` : art ? `ready · ${ago(art.modified)}` : 'Generate'
  const pick = (id, v) => setOpts((o) => ({ ...o, [id]: v }))
  /* The pill answers three questions in the order a person asks them: what is
   * this, what does it make, and is there one already. The name is the label,
   * the blurb is the promise (it comes from the backend, so it is true), and the
   * footer is the state of the last run — with the run's own timestamp rather
   * than the word "ready", because "ready" alone does not say how stale it is. */
  return el('div', { className: 'nb-gen', 'data-kind': kind.id },
    el('button', {
      type: 'button', className: 'nb-card',
      'data-kind': kind.id,
      'data-ready': art ? 'true' : 'false', 'data-busy': started ? 'true' : 'false',
      onClick: started ? undefined : (art ? onOpen : () => onGenerate(opts)),
      'aria-label': `${kind.label} — ${state}. ${art ? 'Open it' : 'Generate it'}`,
      title: `${kind.label} — ${kind.blurb || 'generate it'}${art ? ` · ${art.primary}` : ''}`,
      children: [
        el('span', { className: 'nb-card-ico', 'aria-hidden': 'true' },
          jsx(Glyph, { name: KIND_ICON[kind.id] || 'doc', size: 16 })),
        el('span', { className: 'nb-card-main' },
          el('span', { className: 'nb-card-name', children: kind.label }),
          kind.blurb
            ? el('span', { className: 'nb-card-blurb', children: kind.blurb })
            : null,
          el('span', { className: 'nb-card-state', 'data-kind': started ? 'busy' : art ? 'ready' : 'idle' },
            el('span', {
              className: 'nb-dot',
              style: { background: started ? 'var(--kc)' : art ? T.ok : undefined }
            }),
            started ? `writing · ${secs}s`
              : art ? ago(art.modified)
                : `~${kind.secs || 15}s`)),
        started
          ? el('span', { className: 'nb-bar-track nb-card-bar' },
              el('span', {
                className: 'nb-bar-fill',
                style: { width: `${Math.min(96, 12 + secs * 2.2)}%`, opacity: 0.9 }
              }))
          : null
      ]
    }),
    optSpecs.length
      ? jsx(IconBtn, {
          icon: 'sliders', label: `${kind.label} options`,
          className: 'nb-gen-cfg', active: cfgOpen,
          onClick: () => setCfgOpen((o) => !o)
        })
      : null,
    // Options live in a DIALOG, not in an absolutely-positioned popover.
    // The popover measured 394x354 inside a card and covered six cards below it —
    // "form fields rendering on top of the artifact tiles", which is exactly what
    // it was. A modal has its own layer, its own scroll and a close button.
    cfgOpen && optSpecs.length
      ? jsx(Dialog, {
          open: true, title: `${kind.label} options`,
          onClose: () => setCfgOpen(false), width: 460,
          children: el('div', { style: { display: 'grid', gap: '14px' } },
          optSpecs.map((spec) => el('div', { key: spec.id, className: 'nb-genopt' },
            el('div', { className: 'nb-genopt-label', children: spec.label }),
            spec.kind === 'text'
              ? el('input', {
                  className: 'nb-genopt-text', type: 'text',
                  placeholder: spec.placeholder || '',
                  value: opts[spec.id] || '',
                  onChange: (e) => pick(spec.id, e.target.value)
                })
              : el(Seg, {
                  // The backend may name a choice ('Vector · exact'). Title-casing
                  // the id is the fallback, not the rule: an engine called
                  // 'imagen_blueprint' should not read as 'Imagen Blueprint' to
                  // someone deciding whether to spend money on a render.
                  value: opts[spec.id] || spec.default || spec.choices[0],
                  onChange: (v) => pick(spec.id, v),
                  options: spec.choices.map((c) => ({
                    id: c,
                    label: (spec.labels && spec.labels[c]) ||
                      c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
                  }))
                }))),
          kind.id === 'video_overview' && nbId
            ? el('div', { style: { borderTop: `1px solid ${T.lineSoft}`, paddingTop: '10px', display: 'grid', gap: '8px' } },
                jsx(Btn, {
                  size: 'sm', icon: 'doc', disabled: notesBusy || started,
                  onClick: async () => {
                    setNotesBusy(true)
                    try {
                      const out = await api('/video_notes', {
                        method: 'POST',
                        body: { notebook: nbId, style: opts.style || 'cinematic', length: opts.length || 'short', language: opts.language || '', focus: opts.focus || '' },
                        timeoutMs: 180000
                      })
                      setNotes(out)
                    } catch (e) {
                      setNotes({ error: e.message || String(e) })
                    } finally {
                      setNotesBusy(false)
                    }
                  },
                  children: notesBusy ? 'Writing script…' : 'Review script first'
                }),
                notes && !notes.error
                  ? jsx(Btn, {
                      size: 'sm', variant: 'primary', disabled: started,
                      onClick: () => { setCfgOpen(false); onGenerate({ ...opts, notes }) },
                      children: `Render with these notes (${(notes.beats || []).length} beats)`
                    })
                  : null)
            : null,
          // one obvious way out that also does the thing
          el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
            jsx(Btn, { onClick: () => setCfgOpen(false), children: 'Cancel' }),
            jsx(Btn, {
              variant: 'primary', disabled: started,
              onClick: () => { setCfgOpen(false); onGenerate(opts) },
              children: started ? 'Making…' : `Make ${kind.label}`
            })))
        })
      : null,
    notes
      ? jsx(Dialog, {
          open: true, title: notes.title || 'Video producer notes',
          onClose: () => setNotes(null), width: 640,
          children: notes.error
            ? el('div', { style: { color: T.danger }, children: notes.error })
            : el('div', { style: { display: 'grid', gap: '10px' } },
                el('div', { className: 'nb-meta', children: `${(notes.beats || []).length} beats · ${notes.style} · ${notes.length}` }),
                (notes.beats || []).map((b, i) => el('div', {
                  key: i, style: {
                    border: `1px solid ${T.lineSoft}`, borderRadius: '12px', padding: '10px 12px'
                  }
                },
                  el('div', { style: { fontSize: '12.5px', fontWeight: 650, color: T.accent, marginBottom: '4px' },
                    children: `${String(i + 1).padStart(2, '0')} · ${b.headline || 'beat'}` }),
                  el('div', { style: { fontSize: '13px', color: T.text2, lineHeight: 1.5 }, children: b.text }))))
        })
      : null
  )
}

/* ------------------------------------------------------------- art thumbs
 * Cheap previews inside the 40px artifact tile: infographic fetches its png
 * once, audio gets a seeded waveform (no bytes), everything else is the kind
 * glyph on its colour wash. Nothing here fabricates content.
 */
function ArtThumb({ run, nbId }) {
  const ext = String(run.ext || (run.primary || '').split('.').pop() || '').toLowerCase()
  if (ext === 'png') return jsx(ThumbImg, { nbId, name: run.primary, alt: run.label || '' })
  if (ext === 'mp3') return jsx(WaveThumb, { seed: `${run.kind}:${run.key || run.primary}` })
  return jsx(Glyph, { name: KIND_ICON[run.kind] || 'doc', size: 17 })
}

function ThumbImg({ nbId, name, alt }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!nbId || !name) return undefined
    let live = true
    let made = ''
    api(`/artifact?${qs({ notebook: nbId, name, b64: 1 })}`, { timeoutMs: 30000 })
      .then((out) => {
        if (!live) return
        const raw = atob(out.b64 || '')
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
        made = URL.createObjectURL(new Blob([bytes], { type: out.mime || 'image/png' }))
        setUrl(made)
      })
      .catch(() => {})
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [nbId, name])
  return url ? el('img', { className: 'nb-thumb-img', src: url, alt: alt || '' }) : null
}

function WaveThumb({ seed }) {
  const bars = useMemo(() => {
    const n = 22
    let x = 0
    for (let i = 0; i < seed.length; i += 1) x = (x * 31 + seed.charCodeAt(i)) % 100000
    const out = []
    for (let i = 0; i < n; i += 1) {
      x = (x * 1103515245 + 12345) % 2147483648
      out.push(0.25 + ((x % 100) / 100) * 0.75)
    }
    return out
  }, [seed])
  return el('span', { className: 'nb-thumb-wave' },
    bars.map((h, i) => jsx('i', { key: `w${i}`, style: { height: `${Math.round(h * 100)}%` } })))
}

/* -------------------------------------------------------------- status bar */

function StatusBar({ mode, notebook, data, note, opsStats }) {
  const ready = data && data.model_ready
  const ops = mode === 'ops'
  const home = mode === 'home'
  const notebooks = (data && data.notebooks) || []
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
      : home
        ? el('span', null,
            jsx('span', { className: 'nb-sdot', style: { background: ready ? T.ok : T.warn } }),
            `${notebooks.length} notebook${notebooks.length === 1 ? '' : 's'} · `,
            ready ? 'model ready' : 'model offline')
        : el('span', null,
            jsx('span', { className: 'nb-sdot', style: { background: ready ? T.ok : T.warn } }),
            ready ? 'model ready · answering only from your sources' : 'model offline — enable the plugin'),
    !ops && !home && notebook
      ? el('span', null, jsx('b', { children: notebook.stats.sources }), ' sources · ',
          jsx('b', { children: nfmt(notebook.stats.chars) }), ' chars · ',
          jsx('b', { children: notebook.stats.labels }), ' labels')
      : null,
    !ops && !home && notebook && notebook.stats.unlabeled
      ? jsx('span', {
          style: { color: T.warn },
          children: `${notebook.stats.unlabeled} source${notebook.stats.unlabeled === 1 ? '' : 's'} unlabeled — press “label” on the rail`
        })
      : null,
    // Every action's outcome ("copied", "downloaded", "could not rename") lands
    // here. It was a visual-only sentence: a screen-reader user pressed Copy and
    // heard nothing at all. role=status + aria-live makes the reply audible
    // without stealing focus.
    note
      ? jsx('span', { role: 'status', 'aria-live': 'polite', style: { color: T.accent }, children: note })
      : null,
    el('span', { style: { flex: 1 } }),
    jsx('span', { className: 'nb-mono', style: { fontSize: '11.5px' },
      children: ops ? 'ssh · audited transport' : (notebook ? notebook.id : 'no notebook') }),
    data && !ops ? jsx('span', { className: 'nb-mono', style: { fontSize: '11.5px' },
      children: `synced ${clock(data.generated_at)}` }) : null
  )
}

/* ---------------------------------------------------------------- dialogs */

const SOURCE_MODES = [
  { id: 'find', label: 'Find for me', icon: 'sparkle' },
  { id: 'url', label: 'Web URL', icon: 'link' },
  { id: 'path', label: 'File path', icon: 'file' },
  { id: 'text', label: 'Paste text', icon: 'note' }
]

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

/* notebook-wide passage search — deterministic BM25 over every source,
   results open the owning source in the peek pane.

   Debounce and request live in the machine's states, not in a component effect:
   `typing` owns the 260ms timer, `searching` owns the in-flight request and its
   cancellation. Closing the dialog mid-search cancels it by leaving the state. */
const SEARCH = Machine('search', {
  initial: 'closed',
  context: { query: '', hits: null, error: '', nb: '' },
  states: {
    closed: { on: { OPEN: { target: 'idle', action: (c, p) => ({ query: '', hits: null, error: '', nb: (p && p.nb) || c.nb }) } } },
    idle: {
      on: {
        QUERY: { target: 'typing', guard: (c, p) => !!(p && p.query && p.query.trim().length >= 2),
                 action: (c, p) => ({ query: p.query, hits: null, error: '', nb: (p && p.nb) || c.nb }) },
        SHORT: { target: 'idle', action: (c, p) => ({ query: (p && p.query) || '', hits: null, error: '' }) },
        CLOSE: { target: 'closed', action: () => ({ query: '', hits: null, error: '' }) }
      }
    },
    typing: {
      enter: (c, m) => {
        const t = setTimeout(() => m.send('FIRE'), 260)
        return () => clearTimeout(t)
      },
      on: {
        FIRE: 'searching',
        QUERY: { target: 'typing', action: (c, p) => ({ query: p.query, nb: (p && p.nb) || c.nb }) },
        SHORT: { target: 'idle', action: () => ({ query: '', hits: null }) },
        CLOSE: { target: 'closed', action: () => ({ query: '', hits: null, error: '' }) }
      }
    },
    searching: {
      tags: ['busy'],
      enter: (c, m) => {
        let live = true
        api('/search', { method: 'POST', body: { notebook: c.nb, query: c.query, limit: 12 }, timeoutMs: 30000 })
          .then((out) => { if (live) m.send('RESULTS', { hits: (((out || {}).result || {}).hits) || [] }) })
          .catch((e) => { if (live) m.send('FAIL', { message: e.message || String(e) }) })
        return () => { live = false }
      },
      on: {
        RESULTS: { target: 'results', action: (c, p) => ({ hits: (p && p.hits) || [], error: '' }) },
        FAIL: { target: 'error', action: (c, p) => ({ hits: [], error: (p && p.message) || 'search failed' }) },
        QUERY: { target: 'typing', action: (c, p) => ({ query: p.query, nb: (p && p.nb) || c.nb }) },
        CLOSE: { target: 'closed', action: () => ({ query: '', hits: null, error: '' }) }
      }
    },
    results: {
      on: {
        QUERY: { target: 'typing', guard: (c, p) => !!(p && p.query && p.query.trim().length >= 2),
                 action: (c, p) => ({ query: p.query, nb: (p && p.nb) || c.nb }) },
        SHORT: { target: 'idle', action: () => ({ query: '', hits: null, error: '' }) },
        CLOSE: { target: 'closed', action: () => ({ query: '', hits: null, error: '' }) }
      }
    },
    error: {
      on: {
        QUERY: { target: 'typing', guard: (c, p) => !!(p && p.query && p.query.trim().length >= 2),
                 action: (c, p) => ({ query: p.query, nb: (p && p.nb) || c.nb }) },
        SHORT: { target: 'idle', action: () => ({ query: '', hits: null, error: '' }) },
        CLOSE: { target: 'closed', action: () => ({ query: '', hits: null, error: '' }) }
      }
    }
  }
})

function SearchDialog({ open, onClose, notebook, onPick }) {
  const search = useMachine(SEARCH)
  const nbId = notebook && notebook.id
  const q = search.ctx.query
  const hits = search.ctx.hits
  const err = search.ctx.error
  const busy = search.matches('searching')

  useEffect(() => {
    if (open) SEARCH.send('OPEN', { nb: nbId })
    else if (SEARCH.can('CLOSE')) SEARCH.send('CLOSE')
  }, [open, nbId])

  const onQuery = (value) => {
    const short = value.trim().length < 2
    SEARCH.send(short ? 'SHORT' : 'QUERY', { query: value, nb: nbId })
  }

  const query = q.trim()
  const mark = (text) => {
    if (!query) return text
    const parts = String(text || '').split(
      new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
    return parts.map((p, i) => (i % 2 ? el('mark', { key: i, children: p }) : p))
  }

  return jsx(Dialog, {
    open, onClose, title: 'Search this notebook', width: 640,
    children: [
      jsx(SearchField, {
        value: q, onChange: onQuery, autoFocus: open,
        placeholder: 'Search across every source…', label: 'Search this notebook'
      }),
      el('div', { style: { marginTop: '14px', display: 'grid', gap: '8px' } },
        err ? el('div', { style: { color: T.danger, fontSize: '13px' }, children: err }) : null,
        query.length < 2
          ? el('div', { className: 'nb-hint', children: 'Type at least two characters — results are ranked passages from your sources.' })
          : null,
        query.length >= 2 && !busy && hits && hits.length === 0
          ? el('div', { className: 'nb-hint', children: `No passages match “${query}”.` })
          : null,
        busy ? el('div', { className: 'nb-hint', children: 'searching…' }) : null,
        (hits || []).map((h) => el('button', {
          key: `${h.source_id}-${h.chunk_index}`, type: 'button', className: 'nb-search-hit',
          onClick: () => { if (onPick) onPick(h); onClose() },
          children: [
            el('div', { className: 'nb-search-hit-head' },
              el('b', { children: h.title || h.source_id }),
              h.kind ? el('span', { className: 'nb-meta', children: kindLabel(h.kind) }) : null),
            el('div', { className: 'nb-search-hit-snip', children: mark(h.snippet) })
          ]
        })))
    ]
  })
}

function AddSourceDialog({ open, onClose, notebook, onDone, initialMode, seedQuery, noteOnly }) {
  const [mode, setMode] = useState(noteOnly ? 'note' : (initialMode || 'find'))
  const [value, setValue] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // the find flow: describe -> candidates -> pick -> batch ingest -> summary
  const [cands, setCands] = useState(null)
  const [sel, setSel] = useState({})
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(null)
  const wasOpen = useRef(false)
  const fileRef = useRef(null)

  // real file pick: Electron exposes .path (ingest the file itself); anywhere
  // else small text-ish files are read and sent as pasted text
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f || !notebook || busy) return
    setBusy(true); setErr('')
    try {
      let body
      if (f.path) {
        body = { notebook: notebook.id, path: f.path, title: f.name }
      } else if (f.size <= 1500000) {
        body = { notebook: notebook.id, text: await f.text(), title: f.name }
      } else {
        setErr('That file is too large to read here — switch to File path and give its location.')
        return
      }
      const out = await api('/source', { method: 'POST', body, timeoutMs: 120000 })
      await onDone(out.source && out.source.title ? `added ${out.source.title}` : 'file added')
    } catch (err2) {
      setErr(err2.message || String(err2))
    } finally {
      setBusy(false)
    }
  }

  // fresh state on every open; the find box starts from the caller's seed (a
  // source gap, a describe prompt) or the notebook's own topic
  useEffect(() => {
    if (open && !wasOpen.current) {
      setMode(noteOnly ? 'note' : (initialMode || 'find')); setValue(''); setTitle(''); setErr('')
      setCands(null); setSel({}); setAdded(null)
      setBusy(false); setAdding(false)
      const seed = (seedQuery || '').trim()
      if (seed) { setValue(seed); return }
      if (notebook && !noteOnly) {
        const t = `${notebook.title || ''}${notebook.description ? ` — ${notebook.description}` : ''}`.trim()
        if (t) setValue(t)
      }
    }
    wasOpen.current = open
  }, [open, notebook, initialMode, seedQuery, noteOnly])

  const pickMode = (m) => {
    setMode(m)
    if (m !== 'find') { setCands(null); setAdded(null); setErr('') }
  }

  const find = async () => {
    const q = value.trim()
    if (!q || busy || !notebook) return
    setBusy(true); setErr(''); setAdded(null)
    try {
      const out = await api('/discover', {
        method: 'POST',
        body: { notebook: notebook.id, query: q, max_results: 8 },
        timeoutMs: 90000
      })
      const list = out.candidates || []
      setCands(list)
      const all = {}
      for (const c of list) all[c.url] = true
      setSel(all)
      if (!list.length) setErr('The search came back empty — try a broader description.')
    } catch (e) {
      setCands(null)
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const addPicked = async () => {
    const urls = (cands || []).filter((c) => sel[c.url]).map((c) => c.url)
    if (!urls.length || adding || !notebook) return
    setAdding(true); setErr('')
    try {
      const out = await api('/sources', {
        method: 'POST', body: { notebook: notebook.id, urls }, timeoutMs: 300000
      })
      setAdded(out)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setAdding(false)
    }
  }

  const submit = async () => {
    if (!value.trim() || busy || !notebook) return
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

  const pickedCount = (cands || []).filter((c) => sel[c.url]).length
  const finish = () => onDone(added && added.added
    ? `added ${added.added} source${added.added === 1 ? '' : 's'}${added.duplicates ? ` · ${added.duplicates} already here` : ''}`
    : null)

  const findBody = () => {
    if (added) {
      const failed = (added.results || []).filter((r) => !r.ok)
      return el('div', { style: { display: 'grid', gap: '12px' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '11px' } },
          el('span', { className: 'nb-avatar', 'aria-hidden': 'true',
            style: { background: 'color-mix(in srgb, var(--ui-success, #3fb950) 16%, transparent)', color: 'var(--ui-success, #3fb950)' },
            children: jsx(Glyph, { name: 'check', size: 16 }) }),
          el('div', null,
            el('div', { style: { fontWeight: 650, fontSize: '15px' },
              children: `${added.added} source${added.added === 1 ? '' : 's'} added` }),
            el('div', { className: 'nb-hint', children: added.duplicates
              ? `${added.duplicates} candidate${added.duplicates === 1 ? '' : 's'} turned out to be already here — nothing was duplicated.`
              : 'They are extracted, labelled and indexed — ask or generate away.' }))),
        failed.length
          ? el('div', { style: { display: 'grid', gap: '6px' } },
              el('div', { className: 'nb-meta', children: 'Did not make it' }),
              failed.map((r) => el('div', {
                key: r.url, className: 'nb-hint',
                style: { color: 'var(--ui-danger, #f85149)' },
                children: `${hostOf(r.url) || r.url} — ${r.error || 'failed'}`
              })))
          : null,
        el('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '6px' } },
          jsx(Btn, { variant: 'primary', icon: 'check', onClick: finish, children: 'Done' }))
      )
    }
    if (cands) {
      return el('div', { style: { display: 'grid', gap: '10px' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          el('span', { className: 'nb-meta', children: `Candidates · ${pickedCount} of ${cands.length} picked` }),
          el('span', { style: { flex: 1 } }),
          jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => { setCands(null); setErr('') },
            children: 'Refine search' })),
        el('div', { className: 'nb-cand-list', role: 'group', 'aria-label': 'Candidate sources' },
          cands.map((c) => {
            const on = !!sel[c.url]
            const host = hostOf(c.url)
            return el('button', {
              type: 'button', className: 'nb-cand', 'data-on': on ? 'true' : 'false',
              role: 'checkbox', 'aria-checked': on,
              'aria-label': `${on ? 'Remove' : 'Add'} source: ${c.title || c.url}`,
              onClick: () => setSel((s) => ({ ...s, [c.url]: !s[c.url] })),
              children: [
                el('span', { className: 'nb-cand-check', 'aria-hidden': 'true' },
                  on ? jsx(Glyph, { name: 'check', size: 12 }) : null),
                el('span', { style: { minWidth: 0, flex: 1 } },
                  el('span', { className: 'nb-cand-title', children: c.title || c.url }),
                  el('span', { className: 'nb-cand-sub' },
                    host ? el('span', { className: 'nb-chip', children: host }) : null,
                    el('span', { children: (c.snippet || '').slice(0, 200) })))
              ]
            }, c.url)
          })),
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
          jsx(Btn, { onClick: onClose, children: 'Cancel' }),
          jsx(Btn, {
            variant: 'primary', icon: 'plus', onClick: addPicked,
            disabled: adding || !pickedCount,
            children: adding ? 'Adding…' : `Add ${pickedCount} source${pickedCount === 1 ? '' : 's'}`
          }))
      )
    }
    return el('div', { style: { display: 'grid', gap: '10px' } },
      el('div', { className: 'nb-field', style: { height: '42px' } },
        jsx(Glyph, { name: 'sparkle', size: 15 }),
        el('input', {
          value, onChange: (e) => setValue(e.target.value), autoFocus: true,
          onKeyDown: (e) => { if (e.key === 'Enter') find() },
          placeholder: 'Describe what this notebook should know…',
          'aria-label': 'Describe the sources to find'
        })),
      el('div', { className: 'nb-hint', style: { padding: '0 2px' },
        children: 'Hermes searches the web and offers candidate sources — nothing joins the notebook until you pick it. Already-covered urls are skipped automatically.' }),
      err ? el('div', { style: { color: T.danger, fontSize: '14px' }, children: err }) : null,
      el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' } },
        jsx(Btn, { onClick: onClose, children: 'Cancel' }),
        jsx(Btn, {
          variant: 'primary', icon: 'search', onClick: find,
          disabled: busy || !value.trim() || !notebook,
          children: busy ? 'Searching…' : 'Find sources'
        }))
    )
  }

  const submitNote = async () => {
    if (!value.trim() || busy || !notebook) return
    setBusy(true); setErr('')
    try {
      const body = { notebook: notebook.id, text: value.trim() }
      if (title.trim()) body.title = title.trim()
      await api('/note', { method: 'POST', body, timeoutMs: 60000 })
      setValue(''); setTitle('')
      await onDone('note saved — it is searchable now')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const noteBody = () => el('div', null,
    el('p', { style: { margin: '0 0 14px', color: T.text3, fontSize: '14px', lineHeight: 1.55 },
      children: 'A note becomes a first-class source — searchable, citable, and included in every answer and artifact.' }),
    el('div', { style: { display: 'grid', gap: '10px' } },
      el('textarea', {
        value, onChange: (e) => setValue(e.target.value), autoFocus: true,
        placeholder: 'Jot down the key points, a quote, a decision…',
        'aria-label': 'Note text',
        style: {
          minHeight: '150px', borderRadius: '12px', border: `1px solid ${T.line}`,
          background: T.cardDeep, color: T.text, padding: '12px', fontSize: '14px',
          lineHeight: 1.55, resize: 'vertical', outline: 'none'
        }
      }),
      el('div', { className: 'nb-field', style: { height: '40px' } },
        jsx(Glyph, { name: 'note', size: 14 }),
        el('input', {
          value: title, onChange: (e) => setTitle(e.target.value),
          placeholder: 'Title (optional)',
          'aria-label': 'Note title'
        }))),
    err ? el('div', { style: { marginTop: '12px', color: T.danger, fontSize: '14px' }, children: err }) : null,
    el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' } },
      jsx(Btn, { onClick: onClose, children: 'Cancel' }),
      jsx(Btn, {
        variant: 'primary', icon: 'check', onClick: submitNote,
        disabled: busy || !value.trim() || !notebook,
        children: busy ? 'Saving…' : 'Save note'
      }))
  )

  return jsx(Dialog, {
    open, onClose, title: noteOnly ? 'Add a note' : 'Add a source',
    width: mode === 'find' && !noteOnly ? 620 : 520,
    children: noteOnly
      ? noteBody()
      : el('div', null,
      el('p', { style: { margin: '0 0 14px', color: T.text3, fontSize: '14px', lineHeight: 1.55 },
        children: mode === 'find'
          ? 'Describe what this notebook should know — Hermes searches the web and offers candidates. Nothing joins until you pick it.'
          : 'A source is anything the notebook can cite: a URL, a file on this machine, or text you paste. It is extracted, labelled and indexed on the way in.' }),
      jsx(Seg, { label: 'Source kind', value: mode, onChange: pickMode, options: SOURCE_MODES }),
      el('div', { style: { marginTop: '14px' } },
        mode === 'find'
          ? findBody()
          : el('div', null,
              el('div', { style: { display: 'grid', gap: '10px' } },
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
              el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', alignItems: 'center' } },
                el('input', {
                  ref: fileRef, type: 'file', hidden: true,
                  onChange: onFile,
                  accept: '.pdf,.docx,.pptx,.xlsx,.epub,.ipynb,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a'
                }),
                jsx(Btn, {
                  icon: 'folder', disabled: busy || !notebook,
                  onClick: () => fileRef.current && fileRef.current.click(),
                  children: 'Upload file'
                }),
                el('span', { style: { flex: 1 } }),
                jsx(Btn, { onClick: onClose, children: 'Cancel' }),
                jsx(Btn, {
                  variant: 'primary', icon: 'plus', onClick: submit,
                  disabled: busy || !value.trim() || !notebook,
                  children: busy ? 'Ingesting…' : 'Add source'
                })))
      )
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
            background: T.cardDeep, color: T.text, padding: '12px', fontSize: '14px',
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

/* ============================================================================
   Discover — a source scout, not a search box.

   The difference from Google is the input: this panel already has the notebook.
   It asks the model what the notebook is *missing*, turns those gaps into
   queries, fans them out across the search providers, ranks the union (with a
   per-domain cap so six results are six sources, not one blog), and explains
   every card. Picking one ingests it through the same path as an uploaded file.
   ============================================================================ */

function DiscoverCard({ c, on, onToggle }) {
  return el('label', { className: 'nb-disc-card', 'data-on': on ? 'true' : 'false' },
    el('input', {
      type: 'checkbox', checked: !!on, onChange: onToggle,
      'aria-label': `Select ${c.title}`
    }),
    el('div', { className: 'nb-disc-main' },
      el('div', { className: 'nb-disc-top' },
        el('span', { className: 'nb-disc-dom', children: c.domain }),
        c.provider && c.provider !== 'web'
          ? el('span', { className: 'nb-chip', 'data-tone': 'accent', children: c.provider })
          : null,
        el('span', {
          className: 'nb-meta', style: { marginLeft: 'auto' },
          children: `${Math.round((c.score || 0) * 100)}% fit`
        })),
      el('div', { className: 'nb-disc-title', children: c.title }),
      c.snippet ? el('div', { className: 'nb-disc-snip', children: c.snippet }) : null,
      el('div', { className: 'nb-disc-why' },
        jsx(Glyph, { name: 'sparkle', size: 12 }),
        el('span', { children: c.why || 'new material' }))))
}

/* Discovery was five variables describing two operations at once (`busy` covered
 * both scouting and adding, so the button said "searching" while it was ingesting).
 * Two machines: `scout` (idle → searching → results | error) and `ingest`
 * (idle → adding → done | failed). One cannot be mistaken for the other. */
const SCOUT = Machine('discover', {
  initial: 'idle',
  context: { result: null, error: '', queries: 0 },
  states: {
    idle: { on: { RUN: 'searching', RESET: { target: 'idle', action: () => ({ result: null, error: '' }) } } },
    searching: {
      tags: ['busy'],
      on: {
        RESULTS: { target: 'results', action: (c, p) => ({ result: (p && p.result) || null, error: '' }) },
        FAIL: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'discovery failed' }) },
        CANCEL: 'idle'
      }
    },
    results: { on: { RUN: 'searching', RESET: { target: 'idle', action: () => ({ result: null, error: '' }) } } },
    error: { on: { RUN: 'searching', RESET: { target: 'idle', action: () => ({ result: null, error: '' }) } } }
  }
})

const INGEST = Machine('ingest', {
  initial: 'idle',
  context: { error: '', added: 0, asked: 0 },
  states: {
    idle: { on: { ADD: 'adding' } },
    adding: {
      tags: ['busy'],
      on: {
        DONE: { target: 'idle', action: (c, p) => ({ added: (p && p.landed) || 0, asked: (p && p.asked) || 0, error: '' }) },
        FAIL: { target: 'failed', action: (c, p) => ({ error: (p && p.message) || 'adding failed' }) }
      }
    },
    failed: { on: { ADD: 'adding', DISMISS: { target: 'idle', action: () => ({ error: '' }) } } }
  }
})

function DiscoverPanel({ notebook, onSay, reload }) {
  const scout = useMachine(SCOUT)
  const ingest = useMachine(INGEST)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState({})
  /* Deep research: a second (and third) round that reads what round one found
   * and asks different questions. It costs more and takes longer, so it is an
   * explicit choice the person makes, not a default the panel decides. */
  const [deep, setDeep] = useState(false)
  const res = scout.ctx.result
  const busy = scout.matches('searching')
  const adding = ingest.matches('adding')
  const err = scout.ctx.error

  const nbId = notebook && notebook.id
  const candidates = (res && res.candidates) || []
  const chosen = candidates.filter((c) => picked[c.canonical || c.url])

  const toggle = (c) => {
    const key = c.canonical || c.url
    setPicked((p) => ({ ...p, [key]: !p[key] }))
  }

  const run = async (query) => {
    if (!nbId || !SCOUT.can('RUN')) return
    SCOUT.send('RUN')
    setPicked({})
    try {
      const out = await api('/discover', {
        method: 'POST',
        body: { notebook: nbId, query: (query != null ? query : q) || '', max_results: 12, deep },
        timeoutMs: 180000
      })
      SCOUT.send('RESULTS', { result: out })
    } catch (e) {
      SCOUT.send('FAIL', { message: String(e.message || e) })
      if (onSay) onSay(`discover failed: ${e.message || e}`)
    }
  }

  const addChosen = async () => {
    if (!chosen.length || !INGEST.can('ADD')) return
    INGEST.send('ADD')
    try {
      const out = await api('/sources', {
        method: 'POST',
        body: { notebook: nbId, urls: chosen.map((c) => c.url) },
        timeoutMs: 300000
      })
      const landed = ((out && out.results) || []).filter((r) => r.ok).length
      if (onSay) onSay(`${landed} of ${chosen.length} sources added`)
      setPicked({})
      INGEST.send('DONE', { landed, asked: chosen.length })
      if (reload) await reload()
      await run(res && res.query)
    } catch (e) {
      INGEST.send('FAIL', { message: String(e.message || e) })
      if (onSay) onSay(`adding failed: ${e.message || e}`)
    }
  }

  const emptyState = () => {
    if (busy && !candidates.length) {
      return el('div', { className: 'nb-disc-empty' },
        el('span', { className: 'nb-dot', style: { background: T.accent } }),
        el('div', { children: 'planning queries and searching…' }))
    }
    if (res && !candidates.length) {
      return el('div', { className: 'nb-disc-empty' },
        el('div', { children: 'No new sources came back.' }),
        el('div', {
          className: 'nb-hint',
          children: `${res.searched || 0} results seen — already here, noise, or over the per-domain cap.`
        }))
    }
    if (res) return null
    return el('div', { className: 'nb-disc-empty' },
      jsx(Glyph, { name: 'globe', size: 26 }),
      el('div', { children: 'Nothing scouted yet.' }),
      el('div', {
        className: 'nb-hint',
        children: 'Press Search — it asks the model what this notebook lacks, then looks for it.'
      }))
  }

  return el('div', { className: 'nb-disc' },
    el('div', { className: 'nb-disc-head' },
      el('h1', { className: 'nb-h1', children: 'Discover sources' }),
      el('p', {
        className: 'nb-sub',
        children: 'It reads this notebook first, then looks for what is missing — not just what matches your words.'
      })),

    el('div', { className: 'nb-disc-search' },
      el('input', {
        className: 'nb-input', value: q, onChange: (e) => setQ(e.target.value),
        placeholder: 'Describe what you want — or leave it blank and it will hunt the gaps',
        'aria-label': 'Discovery query',
        onKeyDown: (e) => { if (e.key === 'Enter') run() }
      }),
      jsx(Btn, {
        variant: 'primary', icon: 'search', onClick: () => run(), disabled: busy || !nbId,
        children: busy ? 'Scouting…' : 'Search'
      }),
      jsx(Chip, {
        tone: deep ? 'accent' : undefined, pressed: deep,
        onClick: () => setDeep((d) => !d),
        title: deep
          ? 'Deep research is on: later rounds read what the last round found'
          : 'Deep research: a second and third round that read what round one found',
        children: deep ? 'Deep · on' : 'Deep research'
      })),

    ((res && res.gaps) || []).length
      ? el('div', { className: 'nb-disc-gaps' },
          el('span', { className: 'nb-meta', children: 'Gaps it found' }),
          (res.gaps || []).map((g) => jsx(Chip, {
            key: g, onClick: () => { setQ(g); run(g) },
            title: 'Search for this gap', children: g
          })))
      : null,

    err ? el('div', { className: 'nb-disc-err', children: err }) : null,

    el('div', { className: 'nb-disc-body' },
      emptyState(),
      candidates.map((c) => {
        const key = c.canonical || c.url
        return jsx(DiscoverCard, { key, c, on: !!picked[key], onToggle: () => toggle(c) }, key)
      })),

    chosen.length
      ? el('div', { className: 'nb-disc-foot' },
          jsx(Btn, {
            variant: 'primary', icon: 'plus', onClick: addChosen, disabled: adding,
            children: adding ? 'Adding…' : `Add ${chosen.length} source${chosen.length === 1 ? '' : 's'}`
          }),
          el('span', { className: 'nb-hint', children: 'each one is extracted, deduped and labelled' }))
      : null,

    res
      ? el('div', { className: 'nb-disc-meta' },
          el('span', { children: `${res.searched || 0} results → ${candidates.length} kept` }),
          (res.rounds || 0) > 1 ? el('span', { children: `${res.rounds} rounds` }) : null,
          el('span', { children: `providers: ${(res.providers || ['web']).join(' · ')}` }),
          ((res.queries) || []).length
            ? el('span', { children: `queries: ${res.queries.slice(0, 3).join(' | ')}` })
            : null)
      : null)
}

/* ------------------------------------------------------------------- study
 *
 * Flashcards and quizzes were already generated; nothing remembered whether a card
 * had been answered, so "study" meant re-reading a deck you already knew. This
 * surface is a session: the notebook's own cards, ordered by what is about to be
 * forgotten, with the schedule kept on the server so the page, the CLI and an agent
 * see the same memory (see `hermes_notebook/study.py` and `notebook_study`).
 */

const STUDY = Machine('study', {
  initial: 'idle',
  context: { queue: [], stats: null, idx: 0, error: '', review: 0, limit: 12 },
  states: {
    idle: { on: { OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) } } },
    loading: {
      tags: ['busy'],
      enter: (c, m) => {
        let live = true
        api(`/study?${qs({ notebook: c.notebook, limit: c.limit })}`)
          .then((out) => {
            if (!live) return
            const queue = (out && out.queue) || []
            m.set({ queue, stats: (out && out.stats) || null })
            m.send(queue.length ? 'LOADED' : 'EMPTY')
          })
          .catch((e) => { if (live) m.send('FAIL', { message: e.message || String(e) }) })
        return () => { live = false }
      },
      on: {
        LOADED: { target: 'reviewing', action: () => ({ error: '' }) },
        EMPTY: { target: 'done', action: () => ({ idx: 0 }) },
        FAIL: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'could not load the deck' }) },
        CLOSE: 'idle'
      }
    },
    reviewing: {
      on: {
        REVEAL: 'revealed',
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    },
    revealed: {
      enter: () => null,
      on: {
        RATE: { target: 'saving', guard: (c, p) => !!(p && p.rating), action: (c, p) => ({ rating: p.rating }) },
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    },
    saving: {
      tags: ['busy'],
      enter: (c, m) => {
        let live = true
        const card = c.queue[c.idx]
        const rating = c.rating
        api('/study/review', {
          method: 'POST', timeoutMs: 20000,
          body: { notebook: c.notebook, card: card && card.id, rating }
        })
          .then((out) => {
            if (!live) return
            m.set({ stats: (out && out.stats) || c.stats, review: c.review + 1 })
            m.send('RATED')
          })
          .catch((e) => { if (live) m.send('FAIL', { message: e.message || String(e) }) })
        return () => { live = false }
      },
      on: { RATED: 'advance', FAIL: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'could not save that review' }) } }
    },
    advance: {
      enter: (c, m) => {
        const next = c.idx + 1
        m.set({ idx: next })
        m.send(next < c.queue.length ? 'NEXT' : 'FINISHED')
        return null
      },
      on: { NEXT: 'reviewing', FINISHED: 'done' }
    },
    done: {
      on: {
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    },
    error: {
      on: {
        OPEN: { target: 'loading', action: (c, p) => ({ idx: 0, error: '', limit: (p && p.limit) || c.limit }) },
        CLOSE: 'idle'
      }
    }
  }
})

const RATING_HINT = {
  again: 'in a minute', hard: 'a bit sooner', good: 'as scheduled', easy: 'much later'
}

function StudyPanel({ notebook, onSay, onOpenSource }) {
  const m = useMachine(STUDY)
  const nbId = notebook && notebook.id
  const card = m.ctx.queue[m.ctx.idx] || null
  const stats = m.ctx.stats || {}
  const total = m.ctx.queue.length
  const done = m.matches('done')
  const revealed = m.matches('revealed')

  useEffect(() => {
    if (!nbId) return undefined
    STUDY.set({ notebook: nbId })
    if (STUDY.matches('idle', 'done', 'error')) STUDY.send('OPEN', { limit: 12 })
    return () => { if (STUDY.can('CLOSE')) STUDY.send('CLOSE') }
  }, [nbId])

  const rate = (rating) => { if (STUDY.can('RATE')) STUDY.send('RATE', { rating }) }

  useEffect(() => {
    const onKey = (e) => {
      if (!nbId || m.matches('idle', 'loading', 'saving', 'error')) return
      if (e.target && /input|textarea/i.test(e.target.tagName || '')) return
      if ((e.code === 'Space' || e.key === 'Enter') && STUDY.can('REVEAL')) {
        e.preventDefault(); STUDY.send('REVEAL')
      } else if (/^[1-4]$/.test(e.key) && STUDY.can('RATE')) {
        e.preventDefault(); STUDY.send('RATE', { rating: ['again', 'hard', 'good', 'easy'][Number(e.key) - 1] })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [nbId, m.state])

  const counts = stats.counts || {}
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const chip = (label, value, tone) => el('span', {
    key: label, className: 'nb-chip', 'data-tone': tone || undefined,
    children: `${value} ${label}`
  })

  // The phases are the four buckets a card can sit in, and they must add up to
  // the notebook's cards. `young` was missing from this row, so a deck of 3
  // showed "3 due · 2 new · 0 learning · 0 mastered" — the numbers did not
  // reconcile and the reader had no way to know one bucket was hidden. Zero
  // buckets are noise, so only non-zero ones are shown.
  const phases = [['new', counts.new], ['learning', counts.learning],
                  ['scheduled', counts.young], ['mastered', counts.mastered]]
    .filter(([, v]) => Number(v) > 0)

  const header = el('div', { className: 'nb-study-head' },
    el('div', null,
      el('div', { className: 'nb-study-title', children: 'Study' }),
      el('div', { className: 'nb-hint', children: stats.cards
        ? `${plural(stats.cards, 'card', 'cards')} in this notebook · ${stats.due || 0} due · ${stats.mastered_pct || 0}% mastered`
        : 'No flashcards or quiz in this notebook yet — generate one, then come back.' }),
      el('div', { className: 'nb-study-chips' },
        chip('due', stats.due || 0, stats.due ? 'accent' : undefined),
        phases.map(([label, value]) => chip(label, value, label === 'mastered' ? 'ok' : undefined)),
        stats.streak ? chip('day streak', stats.streak) : null,
        stats.reviews_today ? chip('today', stats.reviews_today) : null)),
    el('div', { className: 'nb-spacer' }),
    el('div', { className: 'nb-study-actions' },
      jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => STUDY.send('OPEN', { limit: 12 }),
        children: m.matches('loading') ? 'Loading…' : 'Reload deck' }),
      jsx(Btn, { size: 'sm', icon: 'plus', onClick: () => STUDY.send('OPEN', { limit: 30 }),
        children: 'Study 30' })))

  if (!nbId) {
    return el('div', { className: 'nb-study' }, header,
      el('div', { className: 'nb-study-empty', children: 'Pick a notebook first.' }))
  }

  if (m.matches('loading') || m.matches('idle')) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        el('span', { className: 'nb-dot', style: { background: T.accent } }),
        el('div', { children: 'Building today’s queue…' })))
  }

  if (m.matches('error')) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        el('div', { style: { color: T.danger }, children: m.ctx.error }),
        jsx(Btn, { size: 'sm', icon: 'refresh', onClick: () => STUDY.send('OPEN'), children: 'Try again' })))
  }

  if (done && !total) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        jsx(Glyph, { name: 'check', size: 26 }),
        el('div', { children: stats.cards
          ? 'Nothing is due right now.'
          : 'Generate flashcards or a quiz for this notebook, then come back to study.' }),
        el('div', { className: 'nb-hint', children: stats.cards
          ? `${counts.mastered || 0} mastered · ${counts.young || 0} scheduled ahead · reinforces itself as you review.`
          : 'Studio → Flashcards, or Studio → Quiz.' })))
  }

  if (done && total) {
    return el('div', { className: 'nb-study', 'data-study-state': m.state }, header,
      el('div', { className: 'nb-study-empty' },
        jsx(Glyph, { name: 'check', size: 26 }),
        el('div', { children: `Session done — ${total} cards reviewed.` }),
        el('div', { className: 'nb-hint', children: 'The queue reorders itself by when each card is due; nothing to keep track of by hand.' }),
        jsx(Btn, { size: 'sm', icon: 'refresh', variant: 'primary', onClick: () => STUDY.send('OPEN'), children: 'Check for due cards' })))
  }

  return el('div', { className: 'nb-study', 'data-study-state': m.state, 'data-study-card': card && card.id },
    header,
    el('div', { className: 'nb-study-progress' },
      el('div', { className: 'nb-study-bar' },
        el('i', { style: { width: `${total ? Math.round((m.ctx.idx / total) * 100) : 0}%` } })),
      el('span', { className: 'nb-hint', children: `${m.ctx.idx + 1} of ${total} · ${card && card.kind === 'quiz' ? 'quiz' : 'flashcard'}` })),
    el('div', { className: 'nb-study-card', 'data-phase': card && card.phase, 'aria-live': 'polite' },
      el('div', { className: 'nb-study-q', children: card && card.front }),
      card && card.kind === 'quiz' && card.choices && card.choices.length
        ? el('div', { className: 'nb-study-choices' },
            card.choices.map((c, i) => el('div', {
              key: `ch${i}`,
              className: 'nb-study-choice',
              'data-right': revealed && normAnswer(c) === normAnswer(card.back) ? 'true' : undefined,
              children: c
            })))
        : null,
      revealed
        ? el('div', { className: 'nb-study-a' },
            el('div', { className: 'nb-study-a-label', children: 'Answer' }),
            el('div', { children: card && card.back }),
            card && card.explanation ? el('div', { className: 'nb-hint', children: card.explanation }) : null,
            card && card.source
              ? el('button', {
                  type: 'button', className: 'nb-study-src', onClick: () => onOpenSource && onOpenSource(card.source),
                  children: [`Source: ${card.source}`]
                })
              : null)
        : el('div', { className: 'nb-study-reveal' },
            jsx(Btn, { variant: 'primary', icon: 'eye', onClick: () => STUDY.send('REVEAL'), children: 'Show answer' }),
            el('span', { className: 'nb-hint', children: 'space' }))),
    el('div', { className: 'nb-study-ratings' },
      revealed
        ? [
            ['again', 'Again', '1', T.danger],
            ['hard', 'Hard', '2', T.warn],
            ['good', 'Good', '3', T.ok],
            ['easy', 'Easy', '4', T.accent]
          ].map(([id, label, key, tone]) => el('button', {
            key: id, type: 'button', className: 'nb-study-rate', 'data-tone': id,
            style: { borderColor: tone },
            onClick: () => rate(id),
            children: [el('b', { children: label }), el('span', { children: `${key} · ${RATING_HINT[id]}` })]
          }))
        : el('span', { className: 'nb-hint', children: 'Rate the card after you see the answer — that is what schedules it.' }))
  )
}

/* ============================================================================
   Tensions — the audit nobody else runs.

   Every grounded-answer tool stops at "here is what the sources say". This
   screen answers the question that decides whether to believe that: *do they
   agree, and are they actually different sources?*

   Two halves, deliberately separate:
   - Independence is MEASURED here, not asked of a model: sources that repeat
     one another's opening text are grouped, so "6 sources" can honestly read
     "4 independent". It answers with no model bound.
   - Conflict is the model's job: each position must cite a real S<n> and quote
     the wording. A position with no valid source is dropped by the backend, not
     repaired here — this screen renders only what survived that check.
   ============================================================================ */

/* Two operations that used to share one `busy` flag (so the panel said "auditing"
 * while it was really re-measuring): the audit (model) and the measurement
 * (deterministic). Separate machines, so a model failure still shows the counts. */
const TENSION_AUDIT = Machine('tensions:audit', {
  initial: 'idle',
  context: { report: null, error: '' },
  states: {
    idle: { on: { RUN: 'running' } },
    running: {
      tags: ['busy'],
      on: {
        DONE: { target: 'done', action: (c, p) => ({ report: (p && p.report) || null, error: '' }) },
        FAIL: { target: 'failed', action: (c, p) => ({ error: (p && p.message) || 'audit failed' }) }
      }
    },
    done: { on: { RUN: 'running' } },
    failed: { on: { RUN: 'running' } }
  }
})

function SidePill({ side }) {
  return el('div', { className: 'nb-tension-side' },
    el('div', { className: 'nb-tension-claim', children: side.claim }),
    side.quote
      ? el('blockquote', { className: 'nb-tension-quote', children: side.quote })
      : null,
    el('div', { className: 'nb-tension-src' },
      (side.sources || []).map((n, i) => jsx(Chip, {
        key: `s${n}`,
        tone: 'accent',
        title: (side.titles || [])[i] || `Source ${n}`,
        children: `S${n}`
      })))
  )
}

function TensionsPanel({ notebook, onSay, onOpenSource, modelReady, onCite }) {
  const audit = useMachine(TENSION_AUDIT)
  const [reported, setReported] = useState(null)
  const nbId = notebook && notebook.id
  const busy = audit.matches('running')
  const report = audit.ctx.report || reported
  const err = audit.ctx.error
  const indep = report && report.independence
  const items = (report && report.items) || []

  const run = async () => {
    if (!nbId || !TENSION_AUDIT.can('RUN')) return
    TENSION_AUDIT.send('RUN')
    try {
      const out = await api('/tensions', {
        method: 'POST',
        body: { notebook: nbId, max_items: 6 },
        timeoutMs: 240000
      })
      setReported(out)
      TENSION_AUDIT.send('DONE', { report: out })
      if (out && out.degraded && onSay) onSay(`audit limited: ${out.degraded}`)
    } catch (e) {
      TENSION_AUDIT.send('FAIL', { message: String(e.message || e) })
      if (onSay) onSay(`tension audit failed: ${e.message || e}`)
    }
  }

  /* The measured verdict is a sentence, not a chart: it has to be readable in
   * one glance and quotable in a summary. */
  const verdict = (() => {
    if (!indep) return null
    const total = indep.sources || 0
    const independent = indep.independent || 0
    if (!total) return null
    const dupes = (indep.clusters || [])
    if (independent === total) {
      return { tone: 'ok', text: `${total} sources, all independent — agreement between them is real corroboration.` }
    }
    const syn = dupes.map((c) => `${c.members.map((m) => `S${m}`).join(' + ')}`).join(', ')
    return {
      tone: 'warn',
      text: `${total} sources, ${independent} independent${syn ? ` — ${syn} repeat the same text` : ''}. Treat agreement among the copies as one voice.`
    }
  })()

  const emptyState = () => {
    if (busy) {
      return el('div', { className: 'nb-disc-empty' },
        el('span', { className: 'nb-dot', style: { background: T.accent } }),
        el('div', { children: 'reading every source and comparing claims…' }))
    }
    if (!modelReady) {
      return el('div', { className: 'nb-disc-empty' },
        jsx(Glyph, { name: 'shield', size: 26 }),
        el('div', { children: 'The model is offline, so disagreements cannot be read.' }),
        el('div', { className: 'nb-hint', children: 'The independence count is measured from text and still runs.' }))
    }
    return el('div', { className: 'nb-disc-empty' },
      jsx(Glyph, { name: 'shield', size: 26 }),
      el('div', { children: 'No audit yet.' }),
      el('div', { className: 'nb-hint',
        children: 'It compares every source against every other: where they conflict, what they agree on, and how many of them are actually independent.' }))
  }

  /* The stable ground: claims the sources state the same way. Kept as its own
   * variable so the return stays flat enough to read (deep nesting is where
   * this file's bracket bugs came from). */
  const agreeList = (report && report.agreements) || []
  const agreeBlock = agreeList.length
    ? el('div', { className: 'nb-tension-agree' },
        el('div', { className: 'nb-home-sec' },
          el('span', { className: 'nb-meta', children: 'Stable ground' }),
          el('span', { className: 'nb-hint', children: 'claims two or more sources state the same way' }),
          el('span', { style: { flex: 1 } })),
        agreeList.map((a, i) => el('div', { key: `a${i}`, className: 'nb-tension-agree-row' },
          jsx(Glyph, { name: 'check', size: 13 }),
          el('span', { className: 'nb-tension-agree-claim', children: a.claim }),
          el('span', {
            className: 'nb-tension-agree-src',
            children: (a.sources || []).map((n) => `S${n}`).join(' · ')
          })))
      )
    : null

  return el('div', { className: 'nb-tensions' },
    el('div', { className: 'nb-disc-head' },
      el('h1', { className: 'nb-h1', children: 'Where the sources disagree' }),
      el('p', { className: 'nb-disc-sub',
        children: 'A grounded answer is only as trustworthy as the agreement behind it. This reads all the sources and reports the conflicts, the consensus, and the duplicated ones.' })),
    el('div', { className: 'nb-tension-bar' },
      jsx(Btn, {
        variant: 'primary', icon: 'shield', onClick: run, disabled: busy || !nbId,
        children: busy ? 'Auditing…' : (report ? 'Audit again' : 'Audit the sources')
      }),
      indep
        ? el('span', { className: 'nb-tension-counts' },
            el('span', { className: 'nb-count' }, el('b', { children: String(indep.sources || 0) }), el('span', { children: 'active sources' })),
            el('span', { className: 'nb-count' }, el('b', { children: String(indep.independent || 0) }), el('span', { children: 'independent' })),
            el('span', { className: 'nb-count' }, el('b', { children: String(items.length) }), el('span', { children: 'tensions' })))
        : null),

    verdict
      ? el('div', { className: 'nb-tension-verdict', 'data-tone': verdict.tone, children: verdict.text })
      : null,

    (report && report.degraded)
      ? el('div', { className: 'nb-disc-err', children: `Audit limited: ${report.degraded}` })
      : null,
    err ? el('div', { className: 'nb-disc-err', children: err }) : null,

    emptyState(),

    items.length
      ? el('div', { className: 'nb-tension-list' },
          items.map((it, i) => el('article', { key: `t${i}`, className: 'nb-tension' },
            el('header', { className: 'nb-tension-head' },
              el('span', { className: 'nb-tension-n', children: String(i + 1) }),
              el('h3', { className: 'nb-tension-topic', children: it.topic || 'disagreement' })),
            el('div', { className: 'nb-tension-sides' },
              it.sides.map((side, j) => jsx(SidePill, { key: `t${i}s${j}`, side }, `t${i}s${j}`))),
            it.why ? el('div', { className: 'nb-tension-why', children: it.why }) : null,
            it.resolution
              ? el('div', { className: 'nb-tension-res', children: [
                  el('b', { children: /^unresolved/i.test(it.resolution) ? 'Unresolved · ' : 'Weighs to · ' }),
                  it.resolution.replace(/^unresolved[:\s—-]*/i, '')
                ] })
              : null)))
      : (report ? el('div', { className: 'nb-disc-empty' },
          jsx(Glyph, { name: 'check', size: 26 }),
          el('div', { children: 'No cross-source conflicts found.' }),
          el('div', { className: 'nb-hint',
            children: 'That is a result, not a failure — the sources make different points rather than opposing ones.' }))
        : null),

    agreeBlock
  )
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

function Viewer({ artifact, notebook, onCite, onRegenerate, regenerating, onChanged, onPrevRun, onNextRun, runPos, onClose, onSay }) {
  const [renOpen, setRenOpen] = useState(false)
  const [renVal, setRenVal] = useState('')
  const [renBusy, setRenBusy] = useState(false)
  const files = artifact.files || []
  const saveRename = async () => {
    setRenBusy(true)
    try {
      await api('/artifact/rename', {
        method: 'POST',
        body: { notebook: notebook.id, key: artifact.key, title: renVal.trim() },
        timeoutMs: 30000
      })
      setRenOpen(false)
      if (onSay) onSay('renamed')
      if (onChanged) onChanged()
    } catch (e) {
      // A rename that fails must NOT close the dialog: the old code swallowed
      // the error, closed the panel and left the title unchanged, which reads
      // as "the app ignored me" rather than "that did not save".
      if (onSay) onSay(`could not rename: ${e.message || e}`)
    } finally { setRenBusy(false) }
  }
  const jsonName = (files.find((f) => f.ext === 'json') || {}).name || ''
  const txtName = (files.find((f) => f.ext === 'txt') || {}).name || ''
  const primary = useFile(notebook.id, artifact.primary)
  const asJson = useFile(notebook.id, jsonName)
  const asTxt = useFile(notebook.id, txtName)

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
    body = jsx(AudioView, { src: primary.url, json: asJson.json, text: asTxt.text, notebook, onChanged })
  } else if (artifact.kind === 'mind_map') {
    body = jsx(MindMapView, { data: asJson.json, text: primary.text, onCite })
  } else if (artifact.kind === 'flashcards') {
    body = jsx(FlashcardsView, { data: asJson.json, text: primary.text, key: artifact.key, deckId: artifact.key })
  } else if (artifact.kind === 'quiz') {
    body = jsx(QuizView, { data: asJson.json, text: primary.text, deckId: artifact.key })
  } else if (artifact.kind === 'slides') {
    body = jsx(SlidesView, { data: asJson.json, text: primary.text, notebook, jsonName, onCite, onSay,
                             htmlUrl: primary.url && artifact.ext === 'html' ? primary.url : '' })
  } else if (artifact.kind === 'infographic' || artifact.kind === 'blueprint_evolution') {
    // The blueprint is an SVG poster like an infographic: same stage, same
    // zoom, same style chip. A separate viewer would be the same code twice.
    body = jsx(InfographicView, { src: primary.url, data: asJson.json })
  } else if (artifact.kind === 'data_table') {
    body = jsx(DataTableView, { text: primary.text, name: artifact.primary, data: asJson.json,
                                notebookId: notebook && notebook.id, onSay })
  } else if (artifact.kind === 'summary' || artifact.kind === 'briefing_doc') {
    // A document, not a chat reply: BLUF banner, KPI strip, then sections.
    body = jsx(DocView, { text: primary.text, kind: artifact.kind, onCite })
  } else if (artifact.kind === 'faq') {
    body = jsx(FaqView, { text: primary.text, onCite })
  } else if (artifact.kind === 'study_guide') {
    body = jsx(StudyGuideView, { text: primary.text, onCite })
  } else if (artifact.kind === 'timeline') {
    body = jsx(TimelineView, { text: primary.text, onCite })
  } else {
    body = el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-doc' }, jsx(Markdown, { text: primary.text, onCite })))
  }

  return el('div', { className: 'nb-view' },
    // ONE 44px toolbar: category badge, the artifact's name, a human-readable
    // provenance line, then the icon actions. There is no second sub-header and
    // no "<notebook> — <kind>" H1 anywhere below it: the tab above already names
    // the kind, and the file's size in bytes is not something a reader needs.
    el('div', { className: 'nb-view-head' },
      el('span', { className: 'nb-chip', 'data-tone': 'accent', children: artifact.label }),
      el('div', { style: { flex: '1 1 auto', minWidth: 0 } },
        el('div', { className: 'nb-view-title',
          title: artifact.title || (asJson.json && (asJson.json.title || asJson.json.topic)) || artifact.primary,
          children: artifact.title || (asJson.json && (asJson.json.title || asJson.json.topic)) || prettyFile(artifact.primary) }),
        el('div', { className: 'nb-view-sub',
          title: optsSummary(artifact.opts) || undefined,
          children: `Updated ${ago(artifact.modified) || 'just now'} · ${artifact.files.length} file${artifact.files.length === 1 ? '' : 's'}${runPos ? ` · version ${runPos}` : ''}${optsSummary(artifact.opts) ? ` · ${optsSummary(artifact.opts)}` : ''}` })),
      el('div', { className: 'nb-view-acts' },
        primary.text
          ? jsx(IconBtn, {
              icon: 'copy', label: 'Copy artifact text',
              onClick: () => copyText(primary.text, onSay || (host.say ? (m) => host.say(m) : null))
            })
          : null,
        jsx(IconBtn, {
          icon: 'download', label: `Download ${artifact.label}`,
          onClick: () => downloading(primary.url, artifact.primary)
        }),
        onPrevRun ? jsx(IconBtn, { icon: 'arrowLeft', label: 'Older version', onClick: onPrevRun }) : null,
        onNextRun ? jsx(IconBtn, { icon: 'arrowRight', label: 'Newer version', onClick: onNextRun }) : null,
        onRegenerate ? jsx(IconBtn, {
          icon: 'refresh', label: `Regenerate ${artifact.label}`,
          active: !!regenerating, disabled: !!regenerating,
          onClick: onRegenerate
        }) : null,
        jsx(IconBtn, {
          icon: 'pencil', label: 'Rename this artifact',
          onClick: () => { setRenVal(artifact.title || ''); setRenOpen(true) }
        }),
        onClose ? jsx(IconBtn, {
          icon: 'close', label: 'Close this tab — back to chat', onClick: onClose
        }) : null)
    ),
    body,
    renOpen
      ? jsx(Dialog, {
          open: true, onClose: () => setRenOpen(false), title: 'Name this artifact', width: 420,
          children: el('div', { style: { display: 'grid', gap: '12px' } },
            el('input', {
              className: 'nb-genopt-text', type: 'text', autoFocus: true,
              placeholder: prettyFile(artifact.primary), value: renVal,
              onChange: (e) => setRenVal(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter' && !renBusy) saveRename() }
            }),
            el('div', { className: 'nb-hint', children: 'A display name only — the files keep their generated names.' }),
            el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
              jsx(Btn, { size: 'sm', onClick: () => setRenOpen(false), children: 'Cancel' }),
              jsx(Btn, {
                size: 'sm', variant: 'primary', disabled: renBusy,
                onClick: saveRename,
                children: renBusy ? 'Saving…' : 'Save'
              })))
        })
      : null
  )
}

const prettyFile = (name) => {
  const stem = String(name || '').replace(/\.[a-z0-9]+$/i, '')
  return stem.replace(/^\d{8}-\d{6}-/, '').replace(/_/g, ' ')
}

/* --------------------------------------------------------------- video */

function VideoView({ src, json, text }) {
  const segs = (json && (json.segments || json.beats || json.scenes)) || []
  const videoRef = useRef(null)
  const [t, setT] = useState(0)
  // timed segments (newer scripts) make chapters seekable + highlight the beat
  const timed = segs.length > 0 && segs.every((s) => s && typeof s.start === 'number')
  const activeSeg = timed
    ? segs.reduce((acc, s, i) => (s.start <= t ? i : acc), -1)
    : -1
  const seekSeg = (i) => {
    const v = videoRef.current
    const seg = segs[i]
    if (v && seg) { v.currentTime = seg.start; setT(seg.start) }
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', { className: 'nb-screen' },
        src
          ? el('video', {
              ref: videoRef, src, controls: true, playsInline: true, preload: 'metadata',
              onTimeUpdate: (e) => setT(e.currentTarget.currentTime)
            })
          : el('div', { className: 'nb-hint', children: 'the video file did not load' })),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        el('span', { className: 'nb-chip', 'data-tone': 'ok', children: 'mp4 · h264' }),
        json && json.title ? el('span', { style: { fontSize: '15px', fontWeight: 600 }, children: json.title }) : null,
        el('span', { style: { flex: 1 } }),
        el('span', { className: 'nb-hint', children: segs.length ? `${segs.length} beats` : 'narrated slideshow' })),
      segs.length
        ? el('ol', { className: 'nb-timeline', 'aria-label': 'Video chapters' },
            segs.map((s, i) => el('li', {
              className: 'nb-tl', key: `s${i}`,
              role: timed ? 'button' : undefined,
              tabIndex: timed ? 0 : undefined,
              'aria-label': timed ? `Play from ${fmtTime(s.start)}` : undefined,
              onClick: timed ? () => seekSeg(i) : undefined,
              onKeyDown: timed ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekSeg(i) } } : undefined,
              style: timed ? { cursor: 'pointer' } : undefined,
              children: [
                el('span', { className: 'nb-tl-when',
                  style: timed && i === activeSeg ? { color: T.accent } : undefined,
                  children: timed ? fmtTime(s.start) : `BEAT ${i + 1}` }),
                el('span', { className: 'nb-tl-what',
                  style: timed && i === activeSeg ? { color: T.text } : undefined,
                  children: [
                    el('b', { children: s.headline || s.title || s.label || '' }),
                    s.sub || s.subline ? el('span', { style: { color: T.text3 }, children: ` — ${s.sub || s.subline}` }) : null,
                    s.text || s.narration
                      ? el('span', { style: { display: 'block', color: T.text3, marginTop: '3px', fontSize: '14px' }, children: s.text || s.narration })
                      : null] })
              ]
            })))
        : (text ? el('pre', { className: 'nb-mono', style: { whiteSpace: 'pre-wrap', color: T.text3, fontSize: '13px' }, children: text }) : null))
  )
}

/* One media element plays at a time in this page, so playback is one machine:
 * idle → loading → playing → paused | ended, plus error. The element's own events
 * drive it, and `playing` is read from the state instead of mirrored in a boolean
 * that can disagree with what the audio is actually doing. */
const PLAYER = Machine('player', {
  initial: 'idle',
  context: { duration: 0, error: '' },
  states: {
    idle: { on: { LOAD: 'loading', RESET: 'idle' } },
    loading: {
      tags: ['busy'],
      on: {
        META: { target: 'paused', action: (c, p) => ({ duration: (p && p.duration) || 0 }) },
        PLAY: 'playing',
        ERROR: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'this file could not be played' }) },
        RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) }
      }
    },
    playing: {
      on: {
        PAUSE: 'paused',
        END: 'ended',
        PLAY: 'playing',
        ERROR: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'playback stopped' }) },
        RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) }
      }
    },
    paused: {
      on: {
        PLAY: 'playing',
        END: 'ended',
        ERROR: { target: 'error', action: (c, p) => ({ error: (p && p.message) || 'playback stopped' }) },
        RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) }
      }
    },
    ended: { on: { PLAY: 'playing', RESET: { target: 'idle', action: () => ({ duration: 0, error: '' }) } } },
    error: { on: { LOAD: 'loading', RESET: { target: 'idle', action: () => ({ error: '' }) } } }
  }
})

/* Re-voicing a script is its own machine: idle → rendering → done | failed, with
 * the script text kept so a failure does not lose the edit. */
const REVOICE = Machine('revoice', {
  initial: 'idle',
  context: { error: '' },
  states: {
    idle: { on: { RENDER: 'rendering', DISCARD: 'idle' } },
    rendering: {
      tags: ['busy'],
      on: {
        DONE: { target: 'idle', action: () => ({ error: '' }) },
        FAIL: { target: 'failed', action: (c, p) => ({ error: (p && p.message) || 'the voice render failed' }) },
        DISCARD: 'idle'
      }
    },
    failed: { on: { RENDER: 'rendering', DISCARD: { target: 'idle', action: () => ({ error: '' }) } } }
  }
})

/* --------------------------------------------------------------- audio */

function AudioView({ src, json, text, notebook, onChanged }) {
  const audioRef = useRef(null)
  const player = useMachine(PLAYER)
  const revoice = useMachine(REVOICE)
  const playing = player.matches('playing')
  const [t, setT] = useState(0)
  const dur = player.ctx.duration
  const [rate, setRate] = useState(1)
  // script stage: edit the generated dialogue, then re-voice it — a new run
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const rendering = revoice.matches('rendering')
  const renderErr = revoice.ctx.error
  const speakers = new Set(((json && json.segments) || []).map((s) => s && s.speaker).filter(Boolean))
  const hostLabel = speakers.size > 1 ? 'TWO HOSTS' : speakers.size === 1 ? 'ONE NARRATOR' : 'AUDIO'
  // segments carry start/end once audio.py stamps them — old artifacts don't
  const segsTimed = useMemo(() => {
    const segs = (json && json.segments) || []
    return segs.length && segs.every((s) => s && typeof s.start === 'number') ? segs : null
  }, [json])

  const lines = useMemo(() => {
    const out = []
    let segN = -1
    for (const raw of String(text || '').split('\n')) {
      let l = raw.trim()
      if (!l) continue
      if (/^#\s/.test(l)) { out.push({ who: '', text: l.replace(/^#\s*/, ''), head: true, seg: -1 }); continue }
      if (/^[_*]{1,2}[^_*].*[_*]{1,2}$/.test(l) && l.length < 160) {
        out.push({ who: '', text: l.replace(/^[_*]+|[_*]+$/g, ''), meta: true, seg: -1 })
        continue
      }
      // "**Host A:** text" and "Host A: text" both appear in the transcript file
      l = l.replace(/\*\*/g, '')
      const m = /^\[?\s*(host\s*[ab]|speaker\s*\d+)\s*\]?\s*[:—-]\s*(.*)$/i.exec(l)
      if (m) {
        segN += 1
        const who = /b|2/i.test(m[1]) ? 'B' : 'A'
        out.push({ who, text: m[2], seg: segN })
        continue
      }
      if (out.length) out.push({ who: out[out.length - 1].who, text: l, seg: out[out.length - 1].seg })
    }
    return out
  }, [text])

  const activeSeg = useMemo(() => {
    if (!segsTimed) return -1
    let idx = -1
    for (let i = 0; i < segsTimed.length; i += 1) {
      if (segsTimed[i].start <= t) idx = i
      else break
    }
    return idx
  }, [segsTimed, t])

  const seekSeg = (i) => {
    const a = audioRef.current
    const seg = segsTimed && segsTimed[i]
    if (!a || !seg) return
    a.currentTime = seg.start
    setT(seg.start)
    if (a.paused) { a.play(); PLAYER.send('PLAY') }
  }

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

  const scriptSegs = (json && Array.isArray(json.segments)) ? json.segments : []
  const canEditScript = !!(notebook && notebook.id && scriptSegs.length && !editing)

  const startEdit = () => {
    const segs = scriptSegs
      .map(s => ({ speaker: s.speaker === 'host_b' ? 'host_b' : 'host_a', text: String(s.text || '') }))
      .filter(s => s.text.trim())
    if (!segs.length) return
    setDraft({ title: (json && json.title) || 'Audio Overview', segments: segs })
    setEditing(true)
    REVOICE.send('DISCARD')
  }
  const patchSeg = (i, patch) =>
    setDraft(d => ({ ...d, segments: d.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const delSeg = (i) =>
    setDraft(d => ({ ...d, segments: d.segments.filter((_, j) => j !== i) }))
  const addSeg = () =>
    setDraft(d => {
      const last = d.segments[d.segments.length - 1]
      const speaker = last ? (last.speaker === 'host_a' ? 'host_b' : 'host_a') : 'host_a'
      return { ...d, segments: [...d.segments, { speaker, text: '' }] }
    })
  const renderScript = async () => {
    if (!notebook || !draft) return
    if (!REVOICE.can('RENDER')) return
    REVOICE.send('RENDER')
    try {
      await api('/audio_render', {
        method: 'POST', timeoutMs: 600000,
        body: { notebook: notebook.id, script: { ...draft, voices: (json && json.voices) || {} } }
      })
      setEditing(false)
      REVOICE.send('DONE')
      if (onChanged) onChanged()
    } catch (e) {
      REVOICE.send('FAIL', { message: String((e && e.message) || e) })
    }
  }

  const scriptEditor = editing && draft
    ? el('div', { className: 'nb-doc', style: { maxWidth: '100%' } },
        el('div', {
          className: 'nb-meta',
          style: { marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }
        },
          'Script — edit lines, then re-voice',
          el('span', { style: { flex: 1 } }),
          el('button', {
            type: 'button', className: 'nb-chip', 'data-click': 'true',
            disabled: rendering,
            onClick: () => setEditing(false),
            children: 'Cancel'
          }),
          el('button', {
            type: 'button', className: 'nb-btn', 'data-variant': 'primary',
            disabled: rendering || !draft.segments.some(s => s.text.trim()),
            onClick: renderScript,
            children: rendering ? 'Rendering…' : 'Render audio'
          })),
        el('input', {
          type: 'text', value: draft.title,
          'aria-label': 'Episode title',
          style: {
            width: '100%', boxSizing: 'border-box', marginBottom: '10px',
            background: 'rgba(255,255,255,.06)', border: `1px solid ${T.lineSoft}`,
            borderRadius: '10px', color: T.text, padding: '8px 12px', fontSize: '14px'
          },
          onChange: (e) => setDraft(d => ({ ...d, title: e.target.value }))
        }),
        draft.segments.map((s, i) => el('div', {
          key: `seg${i}`,
          style: {
            display: 'grid', gridTemplateColumns: '34px 1fr 30px', gap: '8px',
            alignItems: 'start', padding: '8px 0',
            borderTop: i === 0 ? 'none' : `1px solid ${T.lineSoft}`
          }
        },
          jsx('button', {
            type: 'button',
            'aria-label': `Speaker ${s.speaker === 'host_a' ? 'A' : 'B'} — click to switch`,
            title: `Speaker ${s.speaker === 'host_a' ? 'A' : 'B'} — click to switch`,
            onClick: () => patchSeg(i, { speaker: s.speaker === 'host_a' ? 'host_b' : 'host_a' }),
            style: {
              width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer',
              border: `1px solid ${T.lineSoft}`, fontSize: '12.5px', fontWeight: 700,
              background: s.speaker === 'host_a'
                ? `color-mix(in srgb, ${T.accent} 18%, transparent)` : `color-mix(in srgb, ${T.purple} 18%, transparent)`,
              color: s.speaker === 'host_a' ? T.accent : T.purple
            },
            children: s.speaker === 'host_a' ? 'A' : 'B'
          }),
          el('textarea', {
            value: s.text, rows: Math.min(4, Math.max(2, Math.ceil(s.text.length / 70))),
            'aria-label': `Segment ${i + 1} text`,
            onChange: (e) => patchSeg(i, { text: e.target.value }),
            style: {
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'rgba(255,255,255,.05)', border: `1px solid ${T.lineSoft}`,
              borderRadius: '10px', color: T.text, padding: '8px 10px',
              fontSize: '13px', lineHeight: 1.5, fontFamily: 'inherit'
            }
          }),
          el('button', {
            type: 'button', className: 'nb-icon', 'aria-label': `Delete segment ${i + 1}`,
            onClick: () => delSeg(i),
            children: jsx(Glyph, { name: 'trash', size: 13 })
          }))),
        el('button', {
          type: 'button', className: 'nb-chip', 'data-click': 'true',
          style: { marginTop: '10px' },
          onClick: addSeg,
          children: '+ Add segment'
        }),
        renderErr
          ? el('div', {
              style: {
                marginTop: '10px', fontSize: '13px', color: T.danger,
                background: `color-mix(in srgb, ${T.danger} 10%, transparent)`,
                borderRadius: '10px', padding: '8px 12px'
              },
              children: renderErr
            })
          : null)
    : null

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', { className: 'nb-screen nb-screen-audio', style: { aspectRatio: 'auto' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          el('span', { className: 'nb-chip', 'data-tone': 'accent', children: hostLabel }),
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
              if (a.paused) { a.play(); PLAYER.send('PLAY') } else { a.pause(); PLAYER.send('PAUSE') }
            },
            style: { background: 'rgba(255,255,255,.1)', width: '40px', height: '40px' },
            children: jsx(Glyph, { name: playing ? 'pause' : 'play', size: 16 })
          }),
          el('div', { className: 'nb-scrub' },
          el('input', {
            type: 'range', min: 0, max: 100, value: Math.round(progress * 100),
            'aria-label': 'Scrub audio', style: { flex: 1, accentColor: T.accent },
            onChange: (e) => {
              const a = audioRef.current
              if (a && dur) { a.currentTime = (Number(e.target.value) / 100) * dur }
            }
          }),
          // one tick per speaker turn, positioned by its real timestamp — the
          // transcript is already timed, so a chapter list would be the same
          // information printed twice
          segsTimed && dur
            ? el('div', { className: 'nb-scrub-marks', 'aria-hidden': 'true' },
                segsTimed.map((seg, si) => el('button', {
                  key: `mk${si}`, type: 'button', className: 'nb-scrub-mark',
                  title: `${fmtTime(seg.start)} — ${String(seg.speaker || '').toUpperCase()}`,
                  'aria-label': `Jump to ${fmtTime(seg.start)}`,
                  style: { left: `${Math.min(100, (seg.start / dur) * 100)}%` },
                  onClick: () => seekSeg(si)
                })))
            : null),
          el('button', {
            type: 'button', className: 'nb-chip', 'data-click': 'true',
            'aria-label': 'Playback speed', title: 'Playback speed',
            style: { background: 'rgba(255,255,255,.12)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
            onClick: () => {
              const rates = [0.75, 1, 1.25, 1.5, 2]
              const next = rates[(rates.indexOf(rate) + 1) % rates.length]
              const a = audioRef.current
              if (a) a.playbackRate = next
              setRate(next)
            },
            children: `${rate}×`
          }),
          canEditScript
            ? el('button', {
                type: 'button', className: 'nb-chip', 'data-click': 'true',
                'aria-label': 'Edit script', title: 'Edit script, then re-voice',
                style: { background: 'rgba(255,255,255,.12)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
                onClick: startEdit,
                children: 'edit script'
              })
            : null),
        el('audio', {
          ref: audioRef, src: src || undefined, preload: 'metadata',
          onTimeUpdate: (e) => setT(e.currentTarget.currentTime),
          onLoadedMetadata: (e) => PLAYER.send('META', { duration: e.currentTarget.duration || 0 }),
          onEnded: () => PLAYER.send('END'),
          onPause: () => PLAYER.send('PAUSE'),
          onPlay: () => PLAYER.send('PLAY'),
          onError: () => PLAYER.send('ERROR'),
          style: { display: 'none' }
        })),
      scriptEditor
        ? scriptEditor
        : lines.length
        ? el('div', { className: 'nb-doc', style: { maxWidth: '100%' } },
            el('div', { className: 'nb-meta', style: { marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' } },
              'Transcript',
              canEditScript
                ? el('button', {
                    type: 'button', className: 'nb-chip', 'data-click': 'true',
                    style: { marginLeft: 'auto', fontSize: '11.5px' },
                    onClick: startEdit,
                    children: 'edit script → re-voice'
                  })
                : null),
            lines.map((l, i) => jsx(TranscriptLine, {
              line: l, first: i === 0,
              active: segsTimed && l.seg === activeSeg,
              seekable: !!segsTimed && l.seg >= 0,
              segStart: segsTimed && l.seg >= 0 ? segsTimed[l.seg].start : 0,
              onSeek: () => seekSeg(l.seg)
            }, `l${i}`)))
        : null)
  )
}

function TranscriptLine({ line, first, active, seekable, segStart, onSeek }) {
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
    role: seekable ? 'button' : undefined,
    tabIndex: seekable ? 0 : undefined,
    'aria-label': seekable ? `Play from ${fmtTime(segStart)}` : undefined,
    onClick: seekable ? onSeek : undefined,
    onKeyDown: seekable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeek() } } : undefined,
    style: {
      display: 'grid', gridTemplateColumns: seekable ? '26px 1fr 44px' : '26px 1fr', gap: '10px',
      padding: '7px 10px', margin: '0 -10px', borderRadius: '8px',
      borderTop: first ? 'none' : `1px solid ${T.lineSoft}`,
      cursor: seekable ? 'pointer' : undefined,
      background: active ? `color-mix(in srgb, ${T.accent} 12%, transparent)` : undefined
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
  jsx('span', { style: { fontSize: '15px', lineHeight: 1.55, color: T.text2 }, children: line.text }),
  seekable
    ? jsx('span', {
        style: {
          fontSize: '11.5px', color: T.text4, textAlign: 'right',
          fontFamily: 'var(--ui-font-mono, ui-monospace, monospace)',
          paddingTop: '3px', fontVariantNumeric: 'tabular-nums'
        },
        children: fmtTime(segStart)
      })
    : null)
}

const fmtTime = (s) => {
  const v = Math.max(0, Math.round(Number(s) || 0))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

/* --------------------------------------------------------------- mind map */

/** node_type → the colour and glyph the topology uses. A reader learns that
 *  rose means a tension and amber means a number after one graph. */
const MAP_TONE = {
  core_thesis: { ink: 'accent', label: 'thesis' },
  subsystem: { ink: 'accentSoft', label: 'subsystem' },
  metric_proof: { ink: 'warn', label: 'metric' },
  risk_bottleneck: { ink: 'danger', label: 'risk' },
  tension_conflict: { ink: 'danger', label: 'tension' },
  action_item: { ink: 'ok', label: 'action' }
}
const mapInk = (tone) => (tone === 'warn' ? T.warn
  : tone === 'danger' ? T.danger
    : tone === 'ok' ? T.ok
      : tone === 'accentSoft' ? `color-mix(in srgb, ${T.accent} 70%, ${T.text})`
        : T.accent)

/** Lay out a node/edge graph: depth by distance from `root`, leaves on a grid.
 *
 *  A force layout would be prettier and would also be different on every open,
 *  which is wrong for a map you learn: the same notebook must draw the same
 *  topology every time. Nodes are put in columns by BFS depth, spread evenly in
 *  their column, then nudged apart only if they actually overlap. */
function layoutGraph(graph) {
  const raw = (graph.nodes || []).filter((n) => n && n.id)
  if (!raw.length) return { nodes: [], edges: [], width: 900, height: 560 }
  const byId = new Map(raw.map((n) => [n.id, n]))
  const adj = new Map(raw.map((n) => [n.id, []]))
  for (const e of graph.edges || []) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    adj.get(e.source).push(e.target)
    adj.get(e.target).push(e.source)
  }
  const rootId = (graph.root && byId.has(graph.root)) ? graph.root : raw[0].id
  const depth = new Map([[rootId, 0]])
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()
    for (const next of adj.get(id) || []) {
      if (!depth.has(next)) { depth.set(next, depth.get(id) + 1); queue.push(next) }
    }
  }
  // anything unreachable from the root still has to be drawn
  for (const n of raw) if (!depth.has(n.id)) depth.set(n.id, 2)

  const columns = new Map()
  for (const n of raw) {
    const d = depth.get(n.id)
    if (!columns.has(d)) columns.set(d, [])
    columns.get(d).push(n)
  }
  const maxDepth = Math.max(...columns.keys())
  const COL_W = 268
  // A node is 46px tall and can carry a metric badge under its label, so rows
  // need more than the bare height. 92 gives a visible gap at 2x and keeps two
  // same-column nodes from touching (the old 82 did not).
  const ROW_H = 92
  const rows = Math.max(...[...columns.values()].map((c) => c.length), 1)
  const width = Math.max(720, (maxDepth + 1) * COL_W + 120)
  const height = Math.max(320, rows * ROW_H + 140)

  const nodes = []
  for (const [d, list] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    const span = (list.length - 1) * ROW_H
    const top = (height - span) / 2
    list.forEach((n, i) => {
      const label = String(n.label || n.id)
      const w = Math.min(196, 34 + label.length * 8.4)
      nodes.push({
        id: n.id, label, w, h: 46,
        x: 60 + d * COL_W + w / 2,
        y: top + i * ROW_H,
        nodeType: String(n.node_type || '').toLowerCase(),
        stat: String(n.key_stat || '').trim(),
        summary: String(n.summary || '').trim(),
        citations: (n.citations || []).map((c) => Number(c)).filter((c) => c > 0)
      })
    })
  }
  const at = new Map(nodes.map((n) => [n.id, n]))
  const edges = []
  for (const e of graph.edges || []) {
    const a = at.get(e.source)
    const b = at.get(e.target)
    if (!a || !b) continue
    edges.push({
      a, b,
      relation: String(e.relation || '').trim(),
      style: String(e.style || 'solid').trim()
    })
  }
  return { nodes, edges, width, height, columns: maxDepth + 1 }
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

/* ------------------------------------------------------- the mind map view */

/** The inspector for a hovered/selected node: its type, its metric, its
 *  summary and its citations. Built as explicit variables rather than one deep
 *  el() tree — the nesting is what made the previous version's brackets fail. */
function MapInspector({ node, onCite }) {
  if (!node) {
    return el('div', { className: 'nb-map-ins' },
      el('div', { className: 'nb-map-ins-hint', children: 'hover a node to inspect it' }))
  }
  const tone = MAP_TONE[node.nodeType]
  const rows = []
  rows.push(el('div', { className: 'nb-map-ins-head' },
    el('span', { className: 'nb-map-type', 'data-tone': tone ? tone.ink : 'accent',
      children: tone ? tone.label : 'node' }),
    el('span', { className: 'nb-map-ins-label', children: node.label })))
  if (node.stat) {
    rows.push(el('div', { className: 'nb-map-ins-stat', children: node.stat }))
  }
  if (node.summary) {
    rows.push(el('div', { className: 'nb-map-ins-sum', children: node.summary }))
  }
  if (node.citations.length) {
    const chip = (n) => (onCite
      ? el('button', { type: 'button', className: 'nb-srcchip', key: `i${n}`,
          'aria-label': `Open source S${n}`, onClick: () => onCite(n), children: `S${n}` })
      : el('span', { className: 'nb-srcchip', key: `i${n}`, children: `S${n}` }))
    rows.push(el('div', { className: 'nb-map-ins-src' }, node.citations.map(chip)))
  }
  return el('div', { className: 'nb-map-ins' }, rows)
}

function MindMapView({ data, text, onCite }) {
  // The schema describes a GRAPH (nodes + typed edges); the old viewer only
  // understood a nested `children` tree, so a generated mind map lost its node
  // types, its metric badges, its relation labels and every cross-link. The
  // tree path stays as the fallback for an artifact made before that schema.
  const graph = useMemo(
    () => (data && Array.isArray(data.nodes) && data.nodes.length ? data : null),
    [data])
  const tree = useMemo(
    () => (graph ? null : (data && data.children ? data : parseMindMapMd(text))),
    [data, text, graph])

  const laid = useMemo(() => (graph ? layoutGraph(graph) : layoutTree(tree)), [graph, tree])
  const nodes = laid.nodes || []
  const edges = laid.edges || []
  const width = laid.width
  const height = laid.height

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState(null)
  const drag = useRef(null)

  if (!nodes.length) {
    return el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-hint', children: 'no mind map structure in this artifact' }))
  }

  const edgeEl = (e, i) => {
    const tension = e.style === 'dashed_tension' || /contradict/i.test(e.relation)
    const thick = e.style === 'thick_flow' || /produces|depends/i.test(e.relation)
    const stroke = tension ? T.danger : thick
      ? `color-mix(in srgb, ${T.accent} 62%, transparent)`
      : `color-mix(in srgb, ${T.accent} 34%, transparent)`
    const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }
    const label = e.relation
      ? jsx('text', {
          x: mid.x, y: mid.y - 5, textAnchor: 'middle', fontSize: 10.5,
          fill: tension ? `color-mix(in srgb, ${T.danger} 72%, ${T.text})` : T.text3,
          children: e.relation
        })
      : null
    return jsx('g', { key: `e${i}`, children: [
      jsx('path', {
        d: curve(e.a, e.b), fill: 'none', stroke,
        strokeWidth: thick ? 2.4 : 1.5,
        strokeDasharray: tension ? '5 4' : undefined,
        opacity: 0.9
      }),
      label
    ].filter(Boolean) })
  }

  const nodeEl = (n, i) => {
    const tone = MAP_TONE[n.nodeType] || MAP_TONE.core_thesis
    const ink = mapInk(tone.ink)
    const isRoot = graph ? String((graph.root || '')) === n.id : n.depth === 0
    const kids = [
      jsx('rect', {
        x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: isRoot ? 14 : 10,
        fill: isRoot ? `color-mix(in srgb, ${ink} 26%, transparent)`
          : `color-mix(in srgb, ${ink} 8%, var(--ui-bg-primary, #101116))`,
        stroke: `color-mix(in srgb, ${ink} ${isRoot || hover === n.id ? 66 : 34}%, transparent)`,
        strokeWidth: isRoot || hover === n.id ? 2 : 1.2
      }),
      jsx('text', {
        x: n.x, y: n.y + (n.stat ? -1 : 5), textAnchor: 'middle',
        fill: isRoot ? '#f2f3f8' : T.text,
        fontSize: isRoot ? 16 : 14.5, fontWeight: isRoot ? 680 : 600,
        children: n.label
      })
    ]
    if (n.stat) {
      kids.push(jsx('text', {
        x: n.x, y: n.y + 14, textAnchor: 'middle', fontSize: 11.5,
        fill: `color-mix(in srgb, ${ink} 78%, ${T.text})`, fontWeight: 700,
        children: n.stat
      }))
    }
    return jsx('g', {
      key: `n${i}`,
      onMouseEnter: () => setHover(n.id),
      onMouseLeave: () => setHover((h) => (h === n.id ? null : h)),
      style: { cursor: 'pointer' },
      children: kids
    })
  }

  const canvas = jsx('svg', {
    className: 'nb-map', viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': `Mind map: ${(graph && graph.title) || (tree && tree.label) || 'root'} with ${nodes.length} nodes`,
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
    onPointerLeave: () => { drag.current = null },
    children: jsx('g', {
      transform: `translate(${pan.x} ${pan.y}) translate(${width / 2} ${height / 2}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`,
      children: edges.map(edgeEl).concat(nodes.map(nodeEl))
    })
  })

  const types = {}
  for (const n of nodes) {
    const key = n.nodeType || ''
    if (key) types[key] = (types[key] || 0) + 1
  }
  const legend = Object.keys(types).length > 1
    ? el('div', { className: 'nb-map-legend' },
        Object.keys(types).map((t) => el('span', { className: 'nb-map-leg', key: t },
          el('span', { className: 'nb-map-dot', 'data-tone': (MAP_TONE[t] || {}).ink || 'accent' }),
          el('span', { children: `${(MAP_TONE[t] || {}).label || t} ${types[t]}` }))))
    : null

  const toolbar = el('div', { className: 'nb-map-bar' },
    el('span', { className: 'nb-hint',
      children: `${nodes.length} nodes · ${edges.length} links · drag to pan · scroll to zoom` }),
    el('span', { style: { flex: 1 } }),
    legend,
    jsx(Btn, { size: 'sm', icon: 'grid', children: 'Reset',
      onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }) } }))

  const hovered = nodes.find((n) => n.id === hover) || null
  return el('div', { className: 'nb-view-body nb-map-wrap' },
    toolbar,
    el('div', { className: 'nb-map-stage' }, canvas, jsx(MapInspector, { node: hovered, onCite }))
  )
}

/* ------------------------------------------------------------ flashcards */

function FlashcardsView({ data, text, deckId }) {
  const cards = (data && data.cards) || []
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // keyed per artifact — a second deck must not inherit the first's marks
  const storeKey = `known:cards:${deckId || 'default'}`
  const [known, setKnown] = useState(() => persist.get(storeKey, {}) || {})
  // order holds original card indices when shuffled — `known` keys stay stable
  const [order, setOrder] = useState(null)
  const seq = order || cards.map((_, ci) => ci)

  useEffect(() => { setI(0); setFlipped(false); setOrder(null) }, [cards.length])
  if (!cards.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const cardKey = seq[Math.min(i, seq.length - 1)]
  const card = cards[cardKey]
  const mark = (val) => {
    const next = { ...known, [cardKey]: val }
    setKnown(next); persist.set(storeKey, next)
    setFlipped(false)
    setI((n) => Math.min(seq.length - 1, n + 1))
  }
  const knownCount = Object.values(known).filter(Boolean).length
  const reshuffle = () => {
    const idx = cards.map((_, ci) => ci)
    for (let k = idx.length - 1; k > 0; k -= 1) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[idx[k], idx[j]] = [idx[j], idx[k]]
    }
    setOrder(idx); setI(0); setFlipped(false)
  }

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-deck' },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        jsx('span', { className: 'nb-chip', 'data-tone': Object.keys(known).length ? 'ok' : undefined,
          children: `${knownCount} known` }),
        card.card_type
          ? jsx('span', { className: 'nb-chip', children: String(card.card_type).replace(/_/g, ' ') })
          : null,
        card.difficulty
          ? jsx('span', { className: 'nb-chip', title: 'Difficulty 1 easy · 3 hard',
              children: '◆'.repeat(Math.max(1, Math.min(3, Number(card.difficulty) || 1)) ) })
          : null,
        jsx('span', { className: 'nb-hint', children: `card ${i + 1} of ${cards.length}` }),
        el('span', { style: { flex: 1 } }),
        jsx(Btn, {
          size: 'sm', icon: 'shuffle', children: 'Shuffle',
          onClick: reshuffle, disabled: cards.length < 2
        }),
        jsx(Btn, {
          size: 'sm', icon: 'refresh', children: 'Restart',
          onClick: () => { setI(0); setFlipped(false); setOrder(null); setKnown({}); persist.set(storeKey, {}) }
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
            // the hook and the tier are what make a deck more than a list of
            // Q&A: the schema asks for both, so the card shows both
            card.mnemonic
              ? el('div', { className: 'nb-card-hook' },
                  jsx(Glyph, { name: 'sparkle', size: 12 }),
                  el('span', { children: card.mnemonic }))
              : null,
            (card.citations || []).length
              ? el('div', { className: 'nb-card-cites' },
                  card.citations.map((n) => el('span', { className: 'nb-srcchip', key: `k${n}`,
                    children: `S${n}` })))
              : null,
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
          icon: 'arrowRight', disabled: i === seq.length - 1, children: 'Next',
          onClick: () => { setFlipped(false); setI((n) => Math.min(seq.length - 1, n + 1)) }
        })),
      el('div', { className: 'nb-bar-track', style: { maxWidth: '100%' } },
        el('div', { className: 'nb-bar-fill', style: { width: `${((i + 1) / seq.length) * 100}%` } })))
  )
}

/* ------------------------------------------------------------------ quiz */

function QuizView({ data, text, deckId }) {
  const questions = (data && (data.questions || data.items)) || []
  // answers persist per artifact — revisiting the deck keeps your score
  const storeKey = `quiz:picked:${deckId || 'default'}`
  const [picked, setPicked] = useState(() => persist.get(storeKey, {}) || {})
  const setAns = (qi, c) => setPicked((p) => {
    const next = { ...p, [qi]: c }
    persist.set(storeKey, next)
    return next
  })
  const reset = () => { setPicked({}); persist.set(storeKey, {}) }
  if (!questions.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text })))
  }
  const score = questions.reduce((acc, q, i) => {
    const chosen = picked[i]
    if (chosen === undefined) return acc
    return acc + (normAnswer(chosen) === normAnswer(q.answer) ? 1 : 0)
  }, 0)
  const answered = questions.reduce((n, _q, qi) => n + (picked[qi] !== undefined ? 1 : 0), 0)
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { maxWidth: '76ch' } },
      el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' } },
        el('span', { className: 'nb-chip', 'data-tone': answered === questions.length ? 'ok' : 'accent',
          children: `${answered}/${questions.length} answered` }),
        answered ? el('span', { className: 'nb-chip', children: `${score} correct` }) : null,
        el('span', { style: { flex: 1 } }),
        answered ? jsx(Btn, { size: 'sm', icon: 'refresh', onClick: reset, children: 'Reset' }) : null),
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
          el('span', { style: { fontSize: '15px', fontWeight: 600, lineHeight: 1.45 }, children: q.question })),
        el('div', { style: { display: 'grid', gap: '6px', marginTop: '10px' }, role: 'group', 'aria-label': `Choices for question ${qi + 1}` },
          (q.choices && q.choices.length ? q.choices : [q.answer]).map((c, ci) => {
            const isChosen = chosen === c
            const isRight = normAnswer(c) === normAnswer(q.answer)
            const tone = !done ? T.card : isRight ? `color-mix(in srgb, ${T.ok} 16%, transparent)` : isChosen ? `color-mix(in srgb, ${T.danger} 14%, transparent)` : T.card
            return el('button', {
              type: 'button', disabled: done, onClick: () => setAns(qi, c),
              'aria-pressed': isChosen,
              style: {
                minHeight: '38px', textAlign: 'left', padding: '8px 12px', borderRadius: '9px',
                border: `1px solid ${isChosen || (done && isRight) ? T.line : T.lineSoft}`,
                background: tone, color: T.text, fontSize: '14px', cursor: done ? 'default' : 'pointer'
              },
              children: c
            }, `c${ci}`)
          })),
        done
          ? el('div', { className: 'nb-quiz-done' },
              el('div', { className: 'nb-quiz-verdict', 'data-tone': right ? 'ok' : 'warn' },
                jsx(Glyph, { name: right ? 'check' : 'close', size: 13 }),
                el('span', { children: right ? 'Correct' : `Not quite — the answer is “${q.answer}”` })),
              q.explanation ? el('div', { className: 'nb-quiz-explain', children: q.explanation }) : null,
              // per-option rationale: the schema asks the model for one per
              // choice precisely so a miss explains WHY the distractor looked
              // right. Ignoring it made every wrong answer read the same.
              (q.rationales || []).length
                ? el('div', { className: 'nb-quiz-why' },
                    (q.choices || []).map((c, ci) => {
                      const good = normAnswer(c) === normAnswer(q.answer)
                      const why = String(q.rationales[ci] || '').trim()
                      if (!why) return null
                      return el('div', { className: 'nb-quiz-why-row', key: `w${ci}`,
                        'data-tone': good ? 'ok' : (chosen === c ? 'warn' : 'dim') },
                        el('span', { className: 'nb-quiz-why-mark', children: good ? '✓' : (chosen === c ? '✗' : '·') }),
                        el('div', { className: 'nb-quiz-why-body' },
                          el('span', { className: 'nb-quiz-why-choice', children: c }),
                          el('span', { className: 'nb-quiz-why-text', children: why })))
                    }))
                : null,
              jsx('div', { className: 'nb-quiz-src' },
                (q.citations || []).map((n) => el('span', { className: 'nb-srcchip', key: `q${qi}s${n}`,
                  children: `S${n}` })))) 
          : null)
      }))
  )
}

const normAnswer = (s) => String(s == null ? '' : s).trim().toLowerCase()
  .replace(/^[a-d][).]\s*/, '').replace(/[^a-z0-9 ]/g, '').trim()

/* ---------------------------------------------------------------- slides */

function SlidesView({ data, htmlUrl, notebook, jsonName, onCite, onSay }) {
  const deck = data || {}
  const slides = deck.slides || []
  const [i, setI] = useState(0)
  const [fs, setFs] = useState(false)
  const [pptxBusy, setPptxBusy] = useState(false)
  const screenRef = useRef(null)
  const go = useCallback((d) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))), [slides.length])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { go(1); }
      else if (e.key === 'ArrowLeft') { go(-1) }
      else if (e.key === 'Escape' && document.fullscreenElement) document.exitFullscreen()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFs = () => {
    const el = screenRef.current
    if (!el || !el.requestFullscreen) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  const openDeck = htmlUrl
    ? () => (host.openLink ? host.openLink(htmlUrl) : window.open(htmlUrl, '_blank'))
    : null

  // NotebookLM exports decks to PPTX; this writes the same file from the stored
  // deck JSON, so the download can never disagree with what is on screen.
  const savePptx = async () => {
    if (!notebook || !jsonName || pptxBusy) return
    setPptxBusy(true)
    try {
      const out = await api(`/artifact/pptx?${qs({ notebook: notebook.id, name: jsonName, b64: 1 })}`, {
        timeoutMs: 120000
      })
      const bytes = Uint8Array.from(atob(out.b64), (ch) => ch.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: out.mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = out.name || 'deck.pptx'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      // a download that says nothing looks like a button that did nothing
      const said = `downloaded ${out.name || 'deck.pptx'}`
      if (onSay) onSay(said); else if (host.say) host.say(said)
    } catch (e) {
      const said = `pptx export failed: ${e.message || e}`
      if (onSay) onSay(said); else if (host.say) host.say(said)
    } finally {
      setPptxBusy(false)
    }
  }

  if (!slides.length) {
    return el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-hint', children: 'this deck has no slides in its json' }),
      openDeck ? jsx(Btn, { size: 'sm', icon: 'external', onClick: openDeck, children: 'Open the interactive deck' }) : null)
  }
  const s = slides[i]
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-stage' },
      el('div', {
        ref: screenRef,
        className: 'nb-screen', role: 'group', 'aria-label': `Slide ${i + 1} of ${slides.length}`,
        style: { aspectRatio: fs ? 'auto' : '16/9', width: fs ? '100%' : undefined, height: fs ? '100%' : undefined, padding: '34px 40px', placeItems: 'stretch',
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
        el('span', { className: 'nb-mono', style: { fontSize: '12.5px', color: '#9aa0b5' }, children: `${i + 1}/${slides.length}` }),
        el('button', {
          type: 'button', className: 'nb-chip', 'data-click': 'true',
          'aria-label': fs ? 'Exit fullscreen' : 'Present fullscreen', title: fs ? 'Exit fullscreen' : 'Present fullscreen',
          style: { background: 'rgba(255,255,255,.1)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
          onClick: (e) => { e.stopPropagation(); toggleFs() },
          children: fs ? 'exit' : 'present'
        }),
        openDeck
          ? el('button', {
              type: 'button', className: 'nb-chip', 'data-click': 'true',
              'aria-label': 'Open the interactive HTML deck', title: 'Open the interactive HTML deck',
              style: { background: 'rgba(255,255,255,.1)', color: '#cfd3e0', borderColor: 'transparent', cursor: 'pointer' },
              onClick: (e) => { e.stopPropagation(); openDeck() },
              children: 'open deck ↗'
            })
          : null,
        jsonName
          ? el('button', {
              type: 'button', className: 'nb-chip', 'data-click': 'true',
              disabled: pptxBusy,
              'aria-label': 'Download this deck as PowerPoint (.pptx)',
              title: 'Download this deck as PowerPoint (.pptx)',
              style: { background: 'rgba(255,255,255,.1)', color: '#cfd3e0', borderColor: 'transparent', cursor: pptxBusy ? 'progress' : 'pointer' },
              onClick: (e) => { e.stopPropagation(); savePptx() },
              children: pptxBusy ? 'exporting…' : 'pptx ↓'
            })
          : null),
      // One layout per `archetype`: the prompt asks for nine named shapes and
      // this is what makes them look different on screen. `slideBody` falls
      // back to the old title+bullets for an unknown tag.
      jsx(SlideBody, { slide: s, deck, ctx: { onCite, deckTitle: deck.title,
                                               total: slides.length } }),
      (s.notes || s.note)
        ? el('div', { className: 'nb-slide-notes-chip' }, [
            jsx(Glyph, { name: 'doc', size: 12 }),
            el('span', { children: 'speaker notes — press N' })
          ])
        : null),
      el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        jsx(Btn, { icon: 'arrowLeft', onClick: () => go(-1), disabled: i === 0, children: 'Back' }),
        jsx(Btn, { icon: 'arrowRight', onClick: () => go(1), disabled: i === slides.length - 1, children: 'Next' }),
        el('span', { style: { flex: 1 } }),
        el('div', { style: { display: 'flex', gap: '4px' }, role: 'tablist', 'aria-label': 'Slides' },
          slides.map((_, si) => el('button', {
            key: `d${si}`, type: 'button', role: 'tab', 'aria-selected': si === i,
            'aria-label': `Slide ${si + 1}`, onClick: () => setI(si),
            style: {
              width: '30px', height: '30px', border: 0, background: 'transparent', cursor: 'pointer', borderRadius: '99px',
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
  const stats = (data && data.stats) || []
  const quotes = (data && data.quotes) || []
  const cards = stats.filter((x) => x && (x.value || x.label))
  // The poster is a rendered PNG; the JSON beside it is the SOURCE of that
  // poster. Rendering the JSON as components means the page can show crisp,
  // selectable type at any width, put a citation on every number, and stay
  // readable when the artifact is older than the current theme.
  // The JSON arrives a tick after the component mounts (the viewer fetches it),
  // so the mode cannot be decided in a useState initialiser: it would latch on
  // "poster" before the first file landed and never show the live view.
  const [chosen, setChosen] = useState(null)
  const mode = chosen || (cards.length ? 'live' : 'poster')
  const [openQuote, setOpenQuote] = useState(-1)

  const poster = el('div', null,
    el('div', {
      style: {
        border: `1px solid ${T.line}`, borderRadius: '18px', overflow: 'auto',
        background: '#0d1017', maxHeight: '62vh'
      }
    },
    src
      ? el('img', {
          src, alt: (data && data.title) || 'infographic',
          style: { display: 'block', width: `${Math.round(zoom * 100)}%`, height: 'auto' }
        })
      : el('div', { className: 'nb-hint', style: { padding: '20px' }, children: 'the image did not load' })),
    el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' } },
      jsx(Btn, { size: 'sm', onClick: () => setZoom((z) => Math.max(0.5, z - 0.15)), children: '−' }),
      jsx(Btn, { size: 'sm', onClick: () => setZoom((z) => Math.min(2, z + 0.15)), children: '+' }),
      el('span', { className: 'nb-hint', children: `${Math.round(zoom * 100)}%` })))

  const live = el('div', { className: 'nb-ig' },
    el('div', { className: 'nb-ig-head' },
      el('h2', { className: 'nb-ig-title', children: (data && data.title) || 'Infographic' }),
      data && data._style && data._style.label
        ? el('span', { className: 'nb-chip', children: data._style.label }) : null),
    cards.length
      ? el('div', { className: 'nb-ig-kpis' }, cards.slice(0, 6).map((st, i) => el('div', {
          key: i, className: 'nb-ig-kpi'
        },
        el('div', { className: 'nb-ig-kpi-value', children: st.value }),
        el('div', { className: 'nb-ig-kpi-label', children: st.label }),
        st.detail ? el('div', { className: 'nb-ig-kpi-detail', children: st.detail }) : null,
        st.source ? el('span', { className: 'nb-chip nb-ig-src', title: st.source, children: st.source }) : null)))
      : null,
    quotes.length
      ? el('div', { className: 'nb-ig-quotes' }, quotes.slice(0, 4).map((q, i) => el('button', {
          key: i, type: 'button', className: 'nb-ig-quote',
          'data-open': openQuote === i ? 'true' : 'false',
          onClick: () => setOpenQuote((n) => (n === i ? -1 : i)),
          'aria-expanded': openQuote === i
        },
        el('blockquote', { children: `“${openQuote === i ? q.text : String(q.text || '').slice(0, 150) + (String(q.text || '').length > 150 ? '…' : '')}”` }),
        el('span', { className: 'nb-ig-quote-src', children: q.source || 'source' }),
        (q.citations || []).length
          ? el('span', { className: 'nb-ig-cites', children: q.citations.map((c, k) => el('span', {
              key: k, className: 'nb-chip', children: `S${c}` })) }) : null)))
      : null,
    data && data.takeaway
      ? el('div', { className: 'nb-ig-take' },
          el('span', { className: 'nb-ig-take-label', children: 'Bottom line' }),
          el('p', { children: data.takeaway }))
      : null)

  return el('div', { className: 'nb-view-body' },
    cards.length
      ? el('div', { className: 'nb-ig-switch' },
          jsx(Seg, { label: 'View', value: mode, onChange: setChosen,
            options: [{ id: 'live', label: 'Live' }, { id: 'poster', label: 'Poster' }] }))
      : null,
    mode === 'live' && cards.length ? live : poster)
}

/* ----------------------------------------------------------- data table */

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', inQ = false
  const s = String(text || '')
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 1 } else inQ = false
      } else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1
      row.push(cell); cell = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((c) => c !== '')) rows.push(row) }
  return rows
}

/* One download control with three targets: CSV (the artifact itself), XLSX
 * (a real workbook with a frozen header and an auto-filter) and the clipboard
 * as tab-separated text, which is what "copy for Sheets" actually pastes well.
 *
 * ``notebookId`` is REQUIRED by the route (``/artifact/xlsx`` resolves the
 * notebook before it can find the JSON), and this menu used to omit it: every
 * Excel download came back 422 and the toast said "xlsx export failed". The
 * path is built from the same three values the viewer was handed, so it cannot
 * drift from the table on screen. */
function DownloadMenu({ csvText, name, notebookId, onCsv, onSay }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const copyForSheets = async () => {
    // tab-separated, because a CSV pasted into a spreadsheet cell stays in one
    // cell while a tab-separated block splits into columns
    const rows = parseCsv(csvText || '')
    const tsv = rows.map((r) => r.join('\t')).join('\n')
    await copyText(tsv, (m) => {
      const out = m === 'copied to the clipboard' ? 'copied as tab-separated text — paste into a sheet' : m
      if (onSay) onSay(out); else if (host.say) host.say(out)
    })
    setOpen(false)
  }

  const saveXlsx = async () => {
    if (busy) return
    setBusy(true)
    try {
      const stem = String(name || '').replace(/\.(csv|json|md)$/i, '')
      const out = await api(`/artifact/xlsx?${qs({ notebook: notebookId || '', name: `${stem}.json`, b64: 1 })}`, { timeoutMs: 60000 })
      const bytes = Uint8Array.from(atob(out.b64), (ch) => ch.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: out.mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = out.name || `${stem}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      const said = `downloaded ${out.name || `${stem}.xlsx`}`
      if (onSay) onSay(said); else if (host.say) host.say(said)
    } catch (e) {
      // the xlsx route resolves the notebook BEFORE it can find the table JSON,
      // so a missing notebook was a 422 that read as "broken export"
      const said = `xlsx export failed: ${e.message || e}`
      if (onSay) onSay(said); else if (host.say) host.say(said)
    } finally {
      setBusy(false); setOpen(false)
    }
  }

  const item = (label, hint, onClick, icon) => el('button', {
    type: 'button', className: 'nb-menu-item', onClick,
    children: [
      jsx(Glyph, { name: icon, size: 14 }),
      el('div', { className: 'nb-menu-body' },
        el('span', { className: 'nb-menu-label', children: label }),
        el('span', { className: 'nb-menu-hint', children: hint }))
    ]
  })

  return el('div', { className: 'nb-menu-wrap', ref }, [
    jsx(Btn, { size: 'sm', icon: 'download', children: busy ? 'working…' : 'Export',
      onClick: () => setOpen((o) => !o), disabled: busy }),
    open
      ? el('div', { className: 'nb-menu', role: 'menu' }, [
          item('CSV', 'the artifact itself — opens anywhere', () => { onCsv(); setOpen(false) }, 'grid'),
          item('XLSX', 'frozen header, auto-filter, typed cells', saveXlsx, 'chart'),
          item('Copy for Sheets', 'tab-separated, pastes into columns', copyForSheets, 'copy')
        ])
      : null
  ])
}

function DataTableView({ text, name, data, notebookId, onSay }) {
  const rows = useMemo(() => parseCsv(text), [text])
  const [sort, setSort] = useState({ col: -1, dir: 1 })
  const [q, setQ] = useState('')
  const head = rows[0] || []
  const body = useMemo(() => rows.slice(1), [rows])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return body
    return body.filter((r) => r.some((c) => String(c).toLowerCase().includes(needle)))
  }, [body, q])
  const shown = useMemo(() => {
    if (sort.col < 0) return filtered
    const i = sort.col
    return [...filtered].sort((a, b) => {
      const x = String(a[i] || ''), y = String(b[i] || '')
      const nx = Number(x.replace(/[^0-9.\-]/g, '')), ny = Number(y.replace(/[^0-9.\-]/g, ''))
      const c = (!Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '')
        ? nx - ny : x.localeCompare(y)
      return c * sort.dir
    })
  }, [filtered, sort])
  const exportCsv = () => {
    const blob = new Blob([text || ''], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name || 'table.csv'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
  if (!head.length) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-hint', children: 'empty table' }))
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
      el('span', { className: 'nb-meta', children: q.trim() ? `${filtered.length} of ${body.length} rows × ${head.length} columns` : `${body.length} rows × ${head.length} columns` }),
      el('span', { style: { flex: 1 } }),
      body.length > 8 ? jsx(SearchField, { value: q, onChange: setQ, placeholder: 'Filter rows', label: 'Filter table rows' }) : null,
      jsx(DownloadMenu, { csvText: text, name, notebookId, onCsv: exportCsv, onSay })),
    // the aggregates the prompt computed are not in the CSV (it is rectangular);
    // they belong beside the table, not only inside the workbook
    (data && (data.summary || []).length)
      ? el('div', { className: 'nb-dt-sum' },
          el('div', { className: 'nb-dt-sum-h', children: 'Computed over these rows' }),
          (data.summary || []).map((it, i) => el('div', { className: 'nb-dt-sum-cell', key: `sm${i}` },
            el('div', { className: 'nb-dt-sum-v', children: String(it.value || '') }),
            el('div', { className: 'nb-dt-sum-l', children: String(it.label || '') }),
            it.basis ? el('div', { className: 'nb-dt-sum-b', children: String(it.basis) }) : null)))
      : null,
    el('div', { className: 'nb-dt-wrap' },
      el('table', { className: 'nb-dt' },
        el('thead', null, el('tr', null,
          head.map((h, i) => el('th', {
            key: i, onClick: () => setSort((s) => ({ col: i, dir: s.col === i ? -s.dir : 1 })),
            'aria-sort': sort.col === i ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none',
            children: [h, sort.col === i ? el('span', { className: 'nb-dt-arrow', children: sort.dir > 0 ? '↑' : '↓' }) : null]
          }, `h${i}`)))),
        el('tbody', null,
          shown.map((r, ri) => el('tr', { key: `r${ri}` },
            head.map((_, ci) => el('td', { key: `c${ci}`, children: String(r[ci] || '') }, `c${ci}`))))))))
}

/* ------------------------------------------------------------- timeline
 *
 * A timeline artifact is markdown, and for a year it was drawn as plain
 * paragraphs with literal "(Source 1)" strings — which is a dump, not a
 * timeline. It is now parsed into nodes and drawn on a spine:
 *
 *   - `## <date|period|phase>` starts a node; the bullets under it are its body
 *   - `- **1971** — …` is a node of its own
 *   - "(Source 2)" and "(Sources 1 and 4)" become real [S2] citation chips
 *   - the model's meta-commentary ("Note: the provided source is thematic…")
 *     is stripped: if the material is a process rather than a chronology, the
 *     surface says "sequenced phases" once and draws phase badges, instead of
 *     printing the apology as body text.
 */
const TL_MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'
const TL_DATED = new RegExp(`\\b(1[0-9]{3}|20[0-9]{2}|2100)\\b|\\b(${TL_MONTHS})\\b`, 'i')
const TL_META = /^(?:note[:—-]|nb[:]|disclaimer[:])?\s*(?:the (?:provided |given )?(?:source|sources|material|document|text)\s+(?:is|are|does|do|was|were)|i (?:cannot|can not|can’t|don’t|do not)|as an ai|keep in mind that|please note that|there (?:is|are) no (?:explicit|specific) (?:dates|timeline|dates or timeline)|this (?:timeline|document) (?:is|was) (?:compiled|based|created) (?:from|using))/i
const TL_NOISE = /^(?:note[:—-]\s*)?(?:nb[:]|caution[:]|caveat[:])\s*/i
/** "- <when> — body": the marker a one-line milestone starts with. Accepts
 *  years, year ranges, "April 2025", "Apr 12, 2025", "12 April 2025". */
const TL_NODE_PREFIX = new RegExp('^(?:\\*\\*)?(' + [
  // procedural labels: "Phase 2", "T+90 days", "Pre-interview phase", "Step 3"
  '(?:Phase|Stage|Step|Wave|Round)\\s*[0-9A-Za-z+.-]*',
  '(?:Pre|Post|During|After|Before)[- ]?[A-Za-z]+\\s+phase',
  '[A-Za-z]+(?:-[A-Za-z]+)?\\s+phase',
  'T\\s*\\u00b1?\\+\\s*[0-9]+(?:\\s*[A-Za-z]+)?',
  '[0-9]{3,4}(?:\\s*[\\u2013-]\\s*[0-9]{2,4})?',
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s+[0-9]{1,2}(?:,\\s*[0-9]{4})?',
  '[A-Z][a-z]+\\s+[0-9]{1,2}(?:,\\s*|[\\s]+)[0-9]{4}',
  '[A-Z][a-z]+\\s+[0-9]{4}',
  '[0-9]{1,2}\\s+[A-Z][a-z]+\\s+[0-9]{4}'
].join('|') + ')(?:\\*\\*)?\\s*[\\u2014\\u2013:-]\\s*(.+)$')

/** "(Source 2)" / "(Sources 1 and 4)" → "[S2]" / "[S1][S4]". */
function tlCiteFix(line) {
  return String(line)
    .replace(/\(\s*(?:see\s+)?(?:sources?|ref(?:erence)?s?\.?)\s*(?:no\.?\s*)?([0-9]+(?:\s*(?:,|and|&(?:amp;)?)\s*[0-9]+)*)\s*\)/gi,
      (m, list) => list.split(/[,\s]+|and|&amp;|&/).filter((n) => n && /^[0-9]+$/.test(n))
        .map((n) => `[S${n}]`).join(''))
    .replace(/\s*\(\s*si\s*\)/gi, '')
}

/** Strip the model talking about itself: a timeline that apologises for its
 *  shape instead of being shaped is the failure this viewer exists to hide. */
const tlIsMeta = (line) => {
  const t = String(line).trim()
  if (!t) return false
  if (TL_META.test(t)) return true
  return TL_NOISE.test(t) && /(thematic|not (?:strictly )?chronolog|no (?:explicit )?dates|rather than chronological)/i.test(t)
}

function tlParse(text) {
  const lines = tlCiteFix(String(text || '').replace(/\r\n/g, '\n')).split('\n')
  const nodes = []
  const lede = []
  let title = ''
  let pending = null     // the heading a bullet list belongs to
  let sawMeta = false
  const openNode = (when) => {
    const n = { when: String(when || '').trim(), body: [], tags: [] }
    nodes.push(n)
    return n
  }
  const pushBody = (n, line) => { if (n) n.body.push(line.trim()) }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t) { if (pending) pushBody(pending.obj, ''); continue }
    if (tlIsMeta(t)) { sawMeta = true; continue }
    const h1 = /^#\s+(.*)$/.exec(t)
    if (h1) { title = h1[1].trim(); continue }
    const h = /^#{2,4}\s+(.*)$/.exec(t)
    if (h) {
      const when = h[1].replace(/\*\*/g, '').replace(/^[\d.]+\s+/, '').trim()
      pending = { when, obj: openNode(when) }
      continue
    }
    const item = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(t)
    if (item) {
      const body = item[1].trim()
      // The canonical row is pipe-delimited (the artifact prompt asks for
      // `- **<when>** | <category> | <headline> | <what changed> [S#] | <unblocked>`).
      // Parse it here so the renderer can draw the category as a badge and the
      // consequence as its own line, instead of printing one run-on sentence.
      if (TL_ROW.test(body)) {
        const cells = body.split(/\s*\|\s*/).map((c) => c.trim())
        const when = (cells[0] || '').replace(/\*\*/g, '').trim()
        const n = openNode(when)
        n.row = {
          category: (cells[1] || '').replace(/\*\*/g, '').trim(),
          headline: (cells[2] || '').replace(/\*\*/g, '').trim(),
          what: (cells[3] || '').trim(),
          consequence: (cells[4] || '').replace(/\*\*/g, '').trim()
        }
        pending = null
        continue
      }
      // "- **1971** — text" / "- 1971: text" is a node by itself
      const own = TL_NODE_PREFIX.exec(body)
      if (own) {
        const n = openNode(own[1].replace(/\*\*/g, '').trim())
        pushBody(n, own[2])
        pending = null
      } else if (pending) {
        pushBody(pending.obj, body)
      } else {
        // a bullet without a date and without a heading: keep it as its own
        // numbered step so nothing is silently dropped
        const n = openNode('')
        pushBody(n, body)
        pending = null
      }
      continue
    }
    if (/^(?:[-*_]){3,}$/.test(t)) continue
    if (pending) pushBody(pending.obj, t)
    else lede.push(t)
  }
  // dates only when the document is actually dated; a sequence of phases is a
  // sequence even if half its labels are words
  const datedCount = nodes.filter((n) => n.when && TL_DATED.test(n.when)).length
  const kind = nodes.length && datedCount <= nodes.length / 2 ? 'phases' : 'dates'
  // a fully dated timeline is a chronology: order it as one. If any node is a
  // phase label (or undated), the document order is the sequence the model meant.
  const keys = nodes.map((n) => tlWhenKey(n.when))
  if (nodes.length && keys.every((k) => k !== null)) {
    const ordered = nodes.slice().sort((a, b) => tlWhenKey(a.when) - tlWhenKey(b.when))
    return { title, lede, nodes: ordered, sawMeta, kind, reordered: ordered.some((n, i) => n !== nodes[i]) }
  }
  return { title, lede, nodes, sawMeta, kind, reordered: false }
}

/** The canonical timeline row: at least four pipe-separated cells. */
const TL_ROW = /\|/
/** Categories the artifact prompt allows, and the tone each is drawn in. */
const TL_CATS = {
  'milestone': 'ok',
  'architecture shift': 'accent',
  'external event': 'accent',
  'bottleneck': 'warn',
  'target deadline': 'warn'
}

/** A sortable key for a node's date, or null when it is a phase label.
 *  The artifact prompt asks the model for chronological order; models drift
 *  (the December 2025 sample listed April before January), so a timeline that
 *  is fully dated is sorted here — the reader is looking at a chronology, not
 *  at the model's draft. */
const TL_MONTH_INDEX = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}
function tlWhenKey(when) {
  const t = String(when || '').trim()
  const year = /(1[0-9]{3}|20[0-9]{2})/.exec(t)
  if (!year) return null
  const y = Number(year[1])
  const month = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.exec(t)
  const day = new RegExp(`\\b${month ? month[1] : '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'}\\w*\\s+([0-9]{1,2})`, 'i').exec(t)
    || /([0-9]{1,2})\s+[A-Z][a-z]+/.exec(t)
  // a year-only entry summarizes that year, so it sorts after the year's dated
  // events rather than ahead of January (which read as "2025, then January 2025")
  const mo = month ? TL_MONTH_INDEX[month[1].slice(0, 3).toLowerCase()] || 12 : 12
  const d = month ? (day ? Number(day[1]) : 1) : 31
  return y * 10000 + mo * 100 + d
}

/** The S# markers a node cites, in order. */
const tlSRefs = (body) => {
  const out = []
  for (const m of String(body || '').matchAll(/\[S([0-9]+)\]/g)) {
    const n = Number(m[1])
    if (!out.includes(n)) out.push(n)
  }
  return out
}

function TimelineView({ text, onCite }) {
  const doc = useMemo(() => tlParse(text), [text])
  if (doc.nodes.length < 2) {
    // not enough structure to draw: render the document honestly, minus the
    // meta commentary the parser already identified
    const fallback = doc.nodes.length
      ? `${[doc.title && `# ${doc.title}`, ...doc.lede, ...doc.nodes.map((n) => `- ${n.when ? `${n.when} — ` : ''}${n.body.filter(Boolean).join(' ')}`)].filter(Boolean).join('\n\n')}`
      : text
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text: fallback, onCite })))
  }
  const bodyOf = (n) => (n.row
    ? `${n.row.headline} ${n.row.what} ${n.row.consequence}`
    : n.body.filter(Boolean).join('\n\n'))
  const cited = new Set()
  for (const n of doc.nodes) for (const r of tlSRefs(bodyOf(n))) cited.add(r)
  return el('div', { className: 'nb-view-body' },
    el('div', { style: { display: 'flex', flexDirection: 'column' } },
      el('div', { className: 'nb-spine-lede' },
        jsx(Glyph, { name: 'timeline', size: 14 }),
        el('span', { children: [
          el('b', { children: String(doc.nodes.length) }),
          doc.kind === 'dates' ? ' milestones' : ' phases',
          cited.size ? ` · cites ${[...cited].sort((a, b) => a - b).map((n) => `S${n}`).join(', ')}` : '',
          doc.reordered ? ' · reordered chronologically' : ''
        ] }),
        doc.kind === 'phases'
          ? el('span', { className: 'nb-chip', title: 'The sources describe a sequence of steps rather than dated events.',
              children: 'sequenced phases' })
          : null),
      el('ol', { className: 'nb-spine', 'aria-label': doc.title ? `Timeline — ${doc.title}` : 'Timeline' },
        doc.nodes.map((n, i) => {
          const refs = tlSRefs(bodyOf(n))
          const phase = doc.kind === 'phases'
          const when = n.when || (phase ? `Phase ${i + 1}` : `Entry ${i + 1}`)
          const chips = el('div', { className: 'nb-node-src' },
            refs.map((r) => (onCite
              ? el('button', {
                  type: 'button', className: 'nb-srcchip',
                  title: `Open source S${r}`,
                  'aria-label': `Citation S${r} — open the source`,
                  onClick: (e) => { e.stopPropagation(); onCite(r) },
                  children: `S${r}`
                }, `s${i}-${r}`)
              : el('span', { className: 'nb-srcchip', children: `S${r}` }, `s${i}-${r}`))))
          // a canonical row carries its own structure: category, headline, what
          // changed, and what it unblocked. Drawing it as one paragraph is what
          // made the old viewer read like a text dump.
          const card = n.row
            ? el('div', { className: 'nb-node-card' },
                n.row.category
                  ? el('span', { className: 'nb-node-cat', 'data-tone': TL_CATS[n.row.category.toLowerCase()] || undefined,
                      children: n.row.category })
                  : null,
                n.row.headline
                  ? el('div', { className: 'nb-node-headline', children: n.row.headline })
                  : null,
                n.row.what
                  ? el('div', { className: 'nb-node-what', children: jsx(Markdown, { text: n.row.what, onCite }) })
                  : null,
                n.row.consequence
                  ? el('div', { className: 'nb-node-cons' }, [
                      jsx(Glyph, { name: 'bolt', size: 12 }),
                      el('span', { children: n.row.consequence })
                    ])
                  : null)
            : el('div', { className: 'nb-node-card' },
                jsx(Markdown, { text: n.body.filter(Boolean).join('\n\n'), onCite }))
          const kids = [
            el('span', { className: 'nb-node-dot', 'aria-hidden': 'true' }),
            el('span', { className: 'nb-node-when', 'data-phase': phase ? 'true' : 'false', children: when }),
            card,
            refs.length ? chips : null
          ].filter(Boolean)
          return el('li', { className: 'nb-node', key: `n${i}` }, kids)
        }))
  ))
}

/* ============================================================================
   Document surfaces — summary, briefing, FAQ, study guide.

   These four artifacts are generated as markdown, and until now they were
   rendered as markdown: a wall of headings that a reader has to re-scan to find
   the one sentence that matters. The generation prompts now emit a skeleton
   (BLUF banner, KPI table, RAG badges, tiered Q&A, concept cards, trap alerts)
   and this file renders that skeleton as a document, with a plain-markdown
   fallback for artifacts generated before the skeleton existed.

   Every [S#] in the parsed text is still a real citation: the parsers hand the
   raw string to `Markdown`, which owns the citation chips, so nothing here
   invents a second citation path.
   ========================================================================== */

const DOC_TOKEN = String.raw`(?:\*\*|[^|])*`

/** Split generated markdown into `{title, lede, bluf, kpis, sections}`, where a
 *  section is `{heading, blocks}` and blocks are the same shapes `parseBlocks`
 *  produces. Pure: no rendering, no model. */
function docOutline(text) {
  const blocks = parseBlocks(String(text || '').replace(/\r\n/g, '\n'))
  let title = ''
  let bluf = ''
  const lede = []
  const sections = []
  let cur = null
  const push = (b) => (cur ? cur.blocks : lede).push(b)

  for (const b of blocks) {
    if (b.t === 'h1') { if (!title) title = b.text; continue }
    if (b.t === 'h2') { cur = { heading: b.text, blocks: [] }; sections.push(cur); continue }
    // the BLUF banner is a blockquote or a paragraph that opens with a label
    if (!bluf && !cur && (b.t === 'quote' || b.t === 'p')) {
      const plain = String(b.text || '').replace(/\*\*/g, '').trim()
      const m = /^(?:bottom line(?: up front)?|bluf|verdict|the short answer)[:\s—-]+(.+)$/i.exec(plain)
      if (m) { bluf = m[1].trim(); continue }
      if (b.t === 'quote') { bluf = plain; continue }
    }
    push(b)
  }
  const kpis = docKpis(sections)
  return { title, lede, bluf, kpis, sections }
}

/** The KPI strip is the first table whose header names a value/metric column. */
function docKpis(sections) {
  for (const s of sections) {
    for (const b of s.blocks) {
      if (b.t !== 'table') continue
      const head = (b.rows[0] || []).map((h) => String(h).toLowerCase())
      const vi = head.findIndex((h) => /value|metric|number|figure/.test(h))
      const li = head.findIndex((h) => /metric|label|name|what/.test(h))
      if (vi < 0 && li < 0) continue
      const rows = b.rows[1] || []
      if (!rows.length) continue
      const valueCol = vi >= 0 ? vi : 1
      const labelCol = li >= 0 && li !== valueCol ? li : (valueCol === 0 ? 1 : 0)
      const ctxCol = head.findIndex((h) => /context|meaning|basis|vs|detail/.test(h))
      const srcCol = head.findIndex((h) => /source|cite|citation|ref/.test(h))
      return rows.slice(0, 4).map((r) => ({
        value: String(r[valueCol] || '').trim(),
        label: String(r[labelCol] || '').trim(),
        context: ctxCol >= 0 ? String(r[ctxCol] || '').trim() : '',
        source: srcCol >= 0 ? String(r[srcCol] || '').trim() : ''
      })).filter((k) => k.value || k.label)
    }
  }
  return []
}

/** A `[CRITICAL]` / `[MODERATE]` / `[LOW]` marker anywhere in a line. */
const RAG = /\[\s*(critical|high|moderate|medium|low|ready|pass|fail|amber|red|green)\s*\]/i
const RAG_TONE = {
  critical: 'danger', high: 'danger', red: 'danger', fail: 'danger',
  moderate: 'warn', medium: 'warn', amber: 'warn',
  low: 'ok', ready: 'ok', pass: 'ok', green: 'ok'
}

/** One line of the risk register: badge, bold title, root cause, mitigation. */
function riskRow(line, i, onCite) {
  const m = RAG.exec(line)
  const tone = m ? (RAG_TONE[m[1].toLowerCase()] || 'accent') : null
  const clean = line.replace(RAG, '').trim()
  const parts = clean.split(/\s+—\s+|\s+-\s+/)
  const head = parts.shift() || clean
  const rest = parts
  return el('div', { className: 'nb-risk', key: `r${i}` },
    m ? el('span', { className: 'nb-rag', 'data-tone': tone, children: m[1].toLowerCase() }) : null,
    el('div', { className: 'nb-risk-body' },
      el('div', { className: 'nb-risk-head', children: jsx(Markdown, { text: head, onCite }) }),
      rest.length
        ? el('div', { className: 'nb-risk-rest' },
            jsx(Markdown, { text: rest.join(' — '), onCite }))
        : null))
}

function KpiStrip({ kpis, onCite }) {
  if (!kpis.length) return null
  return el('div', { className: 'nb-kpis', role: 'list', 'aria-label': 'Key metrics' },
    kpis.map((k, i) => el('div', { className: 'nb-kpi', role: 'listitem', key: `k${i}` },
      el('div', { className: 'nb-kpi-value', children: jsx(Markdown, { text: k.value, onCite }) }),
      el('div', { className: 'nb-kpi-label', children: k.label }),
      k.context ? el('div', { className: 'nb-kpi-ctx', children: k.context }) : null,
      k.source ? el('div', { className: 'nb-kpi-src', children: jsx(Markdown, { text: k.source, onCite }) }) : null)))
}

function Bluf({ text, onCite }) {
  if (!text) return null
  return el('div', { className: 'nb-bluf' },
    jsx(Glyph, { name: 'bolt', size: 15 }),
    el('div', { className: 'nb-bluf-body' },
      el('span', { className: 'nb-bluf-tag', children: 'Bottom line' }),
      el('div', { className: 'nb-bluf-text', children: jsx(Markdown, { text, onCite }) })))
}

/** The document surface shared by Summary and Briefing Doc. Both are read the
 *  same way — banner, numbers, then sections — and differ only in whether a
 *  section renders its bullets as a risk register. */
function DocView({ text, kind, onCite }) {
  const doc = useMemo(() => docOutline(text), [text])
  // pre-skeleton artifacts have one long section and no KPI table: say so and
  // render them whole rather than inventing structure that is not there
  const structured = !!doc.bluf || doc.kpis.length > 0 || doc.sections.length > 1
  if (!structured) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  const isRisk = (s) => /risk/i.test(s.heading)
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-docdoc' },
      jsx(Bluf, { text: doc.bluf, onCite }),
      jsx(KpiStrip, { kpis: doc.kpis, onCite }),
      doc.lede.length
        ? el('div', { className: 'nb-doc-lede' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text: doc.lede.map((b) => b.text || '').join('\n\n'), onCite })))
        : null,
      doc.sections.map((s, si) => {
        // the KPI table has already been lifted into the strip
        const blocks = s.blocks.filter((b) => b.t !== 'table' || b.rows[0].join().toLowerCase().indexOf('value') < 0)
        if (!blocks.length) return null
        return el('section', { className: 'nb-doc-sec', key: `s${si}` },
          el('h2', { className: 'nb-doc-h2', children: s.heading }),
          isRisk(s) && kind === 'briefing_doc'
            ? el('div', { className: 'nb-risks' },
                blocks.filter((b) => b.t === 'ul' || b.t === 'ol')
                  .flatMap((b) => b.items || [])
                  .map((line, li) => riskRow(line, li, onCite)))
            : el('div', { className: 'nb-doc' },
                blocks.map((b, bi) => renderBlockNamed(b, `${si}-${bi}`, onCite))))
      }))
  )
}

/** `renderBlock` keys by index; inside a section the index is local, so pass a
 *  namespaced key to keep React from recycling children across sections. */
function renderBlockNamed(b, keyName, onCite) {
  const out = renderBlock(b, keyName, onCite)
  return out
}

/* --------------------------------------------------------------------- faq */

const FAQ_TIER = [
  { id: 'foundational', test: /foundational|mechanics|basics/i, label: 'Foundational mechanics', icon: 'study' },
  { id: 'edge', test: /edge|bottleneck|limit|failure/i, label: 'Edge cases and bottlenecks', icon: 'shield' },
  { id: 'tension', test: /contradict|unresolved|disagree|tension/i, label: 'Contradictions and unresolved questions', icon: 'link' }
]

/** Split an FAQ document into tiers of `{q, verdict, body, caveat}`.
 *
 *  Two shapes are accepted, because both exist in real notebooks:
 *   - the tiered skeleton (`## Foundational mechanics` + `### question`)
 *   - the older flat form (`**question?**` then its answer), which has no
 *     headings at all and used to fall through to a wall of Markdown
 */
function faqParse(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const tiers = []
  let cur = null
  let q = null
  const flushQ = () => {
    if (q && cur && (q.q || q.body.some(Boolean))) cur.items.push(q)
    q = null
  }
  const newQ = (label) => ({ q: label, body: [], verdict: '', caveat: '' })

  for (const raw of lines) {
    const t = raw.trim()
    if (!t) { if (q) q.body.push(''); continue }
    if (/^---$/.test(t)) continue
    const h1 = /^#\s+(.*)$/.exec(t)
    if (h1) { flushQ(); continue }
    const h2 = /^##\s+(.*)$/.exec(t)
    if (h2) {
      flushQ()
      const label = h2[1].replace(/\*\*/g, '').trim()
      cur = { id: label.toLowerCase(), label, items: [] }
      tiers.push(cur)
      continue
    }
    const h3 = /^#{3,4}\s+(.*)$/.exec(t)
    if (h3) { flushQ(); if (!cur) { cur = { id: 'faq', label: 'Questions', items: [] }; tiers.push(cur) } q = newQ(h3[1].replace(/\*\*/g, '').trim()); continue }
    // a bold question in the older flat form starts a question of its own — but
    // only when nothing is being answered yet, and only when it reads as a
    // question. A bold VERDICT at the head of an answer is not a new question.
    const boldQ = /^\*\*([^*]{6,})\*\*\s*(.*)$/.exec(t)
    const looksLikeQuestion = boldQ && (/\?$/.test(boldQ[1].trim()) || !q)
    if (boldQ && !cur) {
      cur = { id: 'faq', label: 'Questions', items: [] }
      tiers.push(cur)
    }
    if (looksLikeQuestion && cur) {
      flushQ()
      q = newQ(boldQ[1].trim())
      if (boldQ[2]) q.body.push(boldQ[2].trim())
      continue
    }
    if (q) {
      // the verdict sentence is bolded at the front of the answer
      const v = /^\*\*([^*]+)\*\*/.exec(t)
      if (v && !q.verdict) {
        q.verdict = v[1].trim()
        if (t.slice(v[0].length).trim()) q.body.push(t.slice(v[0].length).trim())
      } else if (/^caveat[:\s]/i.test(t.replace(/\*\*/g, ''))) {
        q.caveat = t.replace(/\*\*caveat[:\s—-]*/i, '').replace(/^\*\*/, '').trim()
      } else {
        q.body.push(t)
      }
    }
  }
  flushQ()
  const mapped = tiers
    .map((tier) => ({
      ...tier,
      meta: FAQ_TIER.find((x) => x.test.test(tier.label)) || { id: 'other', label: tier.label, icon: 'faq' }
    }))
    .filter((tier) => tier.items.length)
  return { tiers: mapped, total: mapped.reduce((n, t) => n + t.items.length, 0) }
}

function FaqView({ text, onCite }) {
  const doc = useMemo(() => faqParse(text), [text])
  const [open, setOpen] = useState(() => {
    const first = doc.tiers.find((t) => t.items.length)
    return first ? `${first.id}:0` : ''
  })
  if (!doc.total) {
    return el('div', { className: 'nb-view-body' }, el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  const tone = (verdict) => {
    const v = String(verdict || '').toLowerCase()
    if (/^(yes|cannot|no)/.test(v) && /^no /.test(v)) return 'danger'
    if (/^yes/.test(v)) return 'ok'
    if (/^no/.test(v)) return 'danger'
    return 'accent'
  }
  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-faq' },
      el('div', { className: 'nb-faq-bar' },
        el('span', { className: 'nb-meta', children: `${doc.total} questions` }),
        el('span', { style: { flex: 1 } }),
        doc.tiers.map((t) => el('span', { className: 'nb-chip', key: `c-${t.id}`, children: `${t.label.split(' ')[0].toLowerCase()} ${t.items.length}` }))),
      doc.tiers.filter((t) => t.items.length).map((tier) => el('div', { className: 'nb-faq-tier', key: tier.id },
        el('div', { className: 'nb-faq-tierhead' },
          jsx(Glyph, { name: tier.meta.icon || 'faq', size: 14 }),
          el('span', { children: tier.label }),
          el('span', { className: 'nb-meta', children: `${tier.items.length}` })),
        tier.items.map((item, qi) => {
          const id = `${tier.id}:${qi}`
          const isOpen = open === id
          return el('div', { className: 'nb-faq-item', 'data-open': isOpen ? 'true' : 'false', key: id },
            el('button', {
              type: 'button', className: 'nb-faq-q', 'aria-expanded': isOpen,
              'aria-controls': `faq-${id}`, onClick: () => setOpen(isOpen ? '' : id),
              children: [
                el('span', { className: 'nb-faq-marker', children: isOpen ? '−' : '+' }),
                el('span', { className: 'nb-faq-qt', children: item.q })
              ]
            }),
            isOpen
              ? el('div', { className: 'nb-faq-a', id: `faq-${id}` },
                  item.verdict
                    ? el('span', { className: 'nb-verdict', 'data-tone': tone(item.verdict), children: item.verdict })
                    : null,
                  el('div', { className: 'nb-doc', children: jsx(Markdown, { text: item.body.join('\n').trim(), onCite }) }),
                  item.caveat
                    ? el('div', { className: 'nb-caveat' },
                        jsx(Glyph, { name: 'shield', size: 12 }),
                        el('span', { children: jsx(Markdown, { text: item.caveat, onCite }) }))
                    : null)
              : null)
        }))))
  )
}

/* ------------------------------------------------------------- study guide */

/** Concept cards: `### term` + four labelled lines. Trap alerts: the
 *  `**Novice assumption:** … / **What the sources show:** …` pairs. */
function studyParse(text) {
  const blocks = parseBlocks(String(text || '').replace(/\r\n/g, '\n'))
  const sections = []
  let cur = null
  for (const b of blocks) {
    if (b.t === 'h2') { cur = { heading: b.text, blocks: [] }; sections.push(cur); continue }
    if (!cur) continue
    cur.blocks.push(b)
  }
  const concepts = []
  const traps = []
  let prompts = []
  for (const s of sections) {
    if (/concept/i.test(s.heading)) {
      // h3 blocks introduce a card; the following paragraph holds the labels
      let card = null
      for (const b of s.blocks) {
        if (b.t === 'h3') { card = { term: b.text, lines: [] }; concepts.push(card); continue }
        if (card && b.text) card.lines.push(b.text)
      }
    }
    if (/trap|misconception/i.test(s.heading)) {
      for (const b of s.blocks) {
        const items = b.items || (b.text ? [b.text] : [])
        for (const it of items) {
          const nov = /\*\*novice assumption:?\*\*\s*([^/]+)/i.exec(it)
          const act = /(?:\*\*what the sources show:?\*\*|what the sources show:?)\s*(.+)/i.exec(it)
          if (nov) traps.push({ novice: nov[1].trim(), actual: act ? act[1].trim() : '' })
        }
      }
    }
    if (/socratic|prompt|rubric/i.test(s.heading)) prompts = s.blocks
  }
  const card = (c) => {
    const lab = (name) => {
      const re = new RegExp(`\\*\\*${name}:?\\*\\*\\s*(.*)`, 'i')
      for (const line of c.lines) { const m = re.exec(line); if (m) return m[1].trim() }
      return ''
    }
    return {
      term: c.term,
      definition: lab('Definition') || lab('Formal definition'),
      mechanism: lab('Mechanism') || lab('Under-the-hood mechanism'),
      failure: lab('Failure mode') || lab('Real-world failure mode'),
      source: lab('Source') || lab('Sources')
    }
  }
  return { sections, concepts: concepts.map(card), traps, prompts }
}

function StudyGuideView({ text, onCite }) {
  const doc = useMemo(() => studyParse(text), [text])
  const hasCards = doc.concepts.some((c) => c.definition || c.mechanism || c.failure)
  if (!hasCards && !doc.traps.length) {
    // an artifact generated before the skeleton existed is still a study guide:
    // render it as the markdown it is rather than invent structure it lacks
    return el('div', { className: 'nb-view-body' },
      el('div', { className: 'nb-doc' }, jsx(Markdown, { text, onCite })))
  }
  const other = doc.sections.filter((s) => !/concept|trap|misconception/i.test(s.heading))

  const conceptRows = (c) => {
    const row = (label, value) => (value
      ? el('div', { className: 'nb-concept-row' },
          el('span', { className: 'nb-concept-lab', children: label }),
          el('div', { className: 'nb-concept-val' },
            jsx(Markdown, { text: value, onCite })))
      : null)
    return el('div', { className: 'nb-concept', key: c.term },
      el('div', { className: 'nb-concept-term', children: c.term }),
      row('Definition', c.definition),
      row('Mechanism', c.mechanism),
      row('Failure mode', c.failure),
      c.source
        ? el('div', { className: 'nb-concept-src' },
            jsx(Markdown, { text: c.source, onCite }))
        : null)
  }

  const concepts = hasCards
    ? el('section', { className: 'nb-doc-sec' },
        el('h2', { className: 'nb-doc-h2', children: 'Concept cards' }),
        el('div', { className: 'nb-concepts' }, doc.concepts.map(conceptRows)))
    : null

  const half = (side, label, value) => el('div', { className: 'nb-trap-half', 'data-side': side },
    el('span', { className: 'nb-trap-tag', children: label }),
    el('div', { children: jsx(Markdown, { text: value || '', onCite }) }))

  const traps = doc.traps.length
    ? el('section', { className: 'nb-doc-sec' },
        el('h2', { className: 'nb-doc-h2', children: 'Trap alerts' }),
        doc.traps.map((t, i) => el('div', { className: 'nb-trap', key: `t${i}` },
          half('novice', 'Novice assumption', t.novice),
          half('actual', 'What the sources show', t.actual))))
    : null

  const rest = other.map((s, si) => el('section', { className: 'nb-doc-sec', key: `o${si}` },
    el('h2', { className: 'nb-doc-h2', children: s.heading }),
    el('div', { className: 'nb-doc' },
      s.blocks.map((b, bi) => renderBlock(b, `${si}-${bi}`, onCite)))))

  return el('div', { className: 'nb-view-body' },
    el('div', { className: 'nb-studyguide' },
      concepts,
      traps,
      rest))
}

/* ============================================================================
   Slide archetypes — one layout per `archetype`, not one layout for the deck.

   The prompt asks the model for nine named layouts; until now the viewer drew
   every slide the same way (a title and a bullet list), so "problem_gap" and
   "tension_audit" arrived on screen as identical walls of text. Each function
   below is the visual the name promises, drawn on the dark slide canvas.

   Rules that hold for all of them:
   - the canvas is 16:9 and the type is set for a projector, so no body text
     below 15px and no more than ~35 words on the canvas;
   - a `[S#]` in a slide's text becomes a real citation chip (same path as
     everywhere else: `Markdown` owns citations);
   - an archetype whose payload is missing falls back to the bullet list rather
     than drawing an empty frame — an old deck still presents.
   ========================================================================== */

/** The accent line the deck's slides all share. */
const SLIDE_ON = {
  ink: '#f2f3f8',
  body: '#d6d8e6',
  dim: '#9aa0b5',
  faint: '#7d8398',
  card: 'rgba(255,255,255,.055)',
  hair: 'rgba(255,255,255,.14)',
  accent: T.accent
}

const slideText = (text, onCite, style) =>
  jsx(Markdown, { text: String(text || ''), onCite, className: 'nb-slide-md' })

/** A small uppercase label, used for kickers and column heads. */
const slideKicker = (text, tone) =>
  el('span', { className: 'nb-slide-kicker', 'data-tone': tone || 'dim', children: text })

const slideStat = (s, i) => el('div', { className: 'nb-slide-stat', key: `st${i}` },
  el('div', { className: 'nb-slide-stat-v', children: s.value }),
  el('div', { className: 'nb-slide-stat-l', children: s.label }))

/** title_hero — the thesis, a subtitle, and the deck's own metadata. */
function slideTitleHero(s, ctx) {
  return el('div', { className: 'nb-slide nb-slide-hero' },
    s.kicker ? slideKicker(s.kicker, 'accent') : null,
    el('div', { className: 'nb-slide-hero-t', children: s.title }),
    (s.bullets || []).length
      ? el('div', { className: 'nb-slide-hero-sub', children: slideText(s.bullets[0], ctx.onCite) })
      : null,
    el('div', { className: 'nb-slide-hero-meta' },
      ctx.deckTitle ? el('span', { className: 'nb-slide-badge', children: ctx.deckTitle }) : null,
      el('span', { className: 'nb-slide-badge', children: `${ctx.total} slides` }),
      (s.citations || []).length
        ? el('span', { className: 'nb-slide-badge', 'data-tone': 'accent',
            children: `cites ${s.citations.map((n) => `S${n}`).join(' · ')}` })
        : null))
}

/** executive_bluf — the numbers first, one sentence that decides. */
function slideExecutiveBluf(s, ctx) {
  const stats = (s.stats || []).slice(0, 4)
  const takeaway = (s.bullets || [])[0]
  return el('div', { className: 'nb-slide nb-slide-bluf' },
    slideKicker(s.kicker || 'Bottom line', 'accent'),
    el('div', { className: 'nb-slide-bluf-t', children: s.title }),
    stats.length
      ? el('div', { className: 'nb-slide-stats', 'data-count': String(stats.length) },
          stats.map(slideStat))
      : null,
    takeaway
      ? el('div', { className: 'nb-slide-banner' },
          jsx(Glyph, { name: 'bolt', size: 15 }),
          el('span', { children: slideText(takeaway, ctx.onCite) }))
      : null)
}

/** problem_gap — legacy on the left, target on the right, saturation split. */
function slideProblemGap(s, ctx) {
  const cols = s.columns || {}
  const left = cols.left || []
  const right = cols.right || []
  const half = (items, side, label) => el('div', { className: 'nb-slide-half', 'data-side': side },
    slideKicker(label, side === 'left' ? 'dim' : 'accent'),
    el('ul', { className: 'nb-slide-list' },
      (items.length ? items : (side === 'left' ? (s.bullets || []).slice(0, 2) : []))
        .map((b, i) => el('li', { key: `h${side}${i}`, children: slideText(b, ctx.onCite) }))))
  return el('div', { className: 'nb-slide nb-slide-gap' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-split' },
      half(left, 'left', 'Current · legacy'),
      el('div', { className: 'nb-slide-arrow', 'aria-hidden': 'true', children: '→' }),
      half(right, 'right', 'Target · next-gen')))
}

/** architecture_bento — cards with a micro-spec each. */
function slideBento(s, ctx) {
  const items = (s.bullets || []).slice(0, 5)
  const card = (b, i) => {
    const [head, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
    const kids = [el('div', { className: 'nb-slide-card-h', children: slideText(head, ctx.onCite) })]
    if (rest.length) {
      kids.push(el('div', { className: 'nb-slide-card-s', children: slideText(rest.join(' — '), ctx.onCite) }))
    }
    return el('div', { className: 'nb-slide-card', key: `b${i}` }, kids)
  }
  return el('div', { className: 'nb-slide nb-slide-bento' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-cards', 'data-count': String(Math.min(items.length, 5) || 1) },
      items.map(card)))
}

/** process_pipeline — ordered stages with a transformation each. */
function slidePipeline(s, ctx) {
  const stages = (s.stages || []).slice(0, 5)
  const items = stages.length
    ? stages.map((st) => ({ label: st.label, detail: st.detail }))
    : (s.bullets || []).slice(0, 5).map((b) => {
        const [label, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
        return { label, detail: rest.join(' — ') }
      })
  const chev = el('span', { className: 'nb-slide-chev', 'aria-hidden': 'true' })
  const row = (st, i) => {
    const kids = [
      el('span', { className: 'nb-slide-stage-n', children: String(i + 1) }),
      el('div', { className: 'nb-slide-stage-h', children: st.label })
    ]
    if (st.detail) {
      kids.push(el('div', { className: 'nb-slide-stage-s', children: slideText(st.detail, ctx.onCite) }))
    }
    if (i < items.length - 1) kids.push(chev)
    return el('div', { className: 'nb-slide-stage', key: `p${i}` }, kids)
  }
  return el('div', { className: 'nb-slide nb-slide-pipe' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-stages', 'data-count': String(items.length || 1) },
      items.map(row)))
}

/** deep_dive_comparison — a dense table read off `columns` or `bullets`. */
function slideComparison(s, ctx) {
  const cols = s.columns || {}
  const left = cols.left || []
  const right = cols.right || []
  const rows = Math.max(left.length, right.length)
  if (rows >= 2) {
    const headCells = [
      el('th', { key: 'h0', children: slideKicker('left', 'dim') }),
      el('th', { key: 'h1', children: slideKicker('right', 'accent') })
    ]
    const cell = (value, key) => el('td', { key, children: value ? slideText(value, ctx.onCite) : '' })
    const bodyRows = Array.from({ length: rows }).map((_, i) => el('tr', { key: `r${i}` },
      cell(left[i], 'l'), cell(right[i], 'r')))
    const table = el('table', { className: 'nb-slide-table' },
      el('thead', null, el('tr', null, headCells)),
      el('tbody', null, bodyRows))
    return el('div', { className: 'nb-slide nb-slide-cmp' },
      el('div', { className: 'nb-slide-gap-head', children: s.title }),
      table)
  }
  // no paired columns: the bullets become labelled rows rather than a wall
  return el('div', { className: 'nb-slide nb-slide-cmp' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-rows' },
      (s.bullets || []).map((b, i) => {
        const [head, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
        return el('div', { className: 'nb-slide-row', key: `br${i}` },
          el('div', { className: 'nb-slide-row-h', children: slideText(head, ctx.onCite) }),
          el('div', { className: 'nb-slide-row-s', children: slideText(rest.join(' — '), ctx.onCite) }))
      })))
}

/** tension_audit — agreement on one side, contradiction on the other. */
function slideTension(s, ctx) {
  const left = (s.columns || {}).left || []
  const right = (s.columns || {}).right || []
  const bullets = s.bullets || []
  const agree = left.length ? left : bullets.filter((b) => !/S\d/.test(String(b)))
  const conflict = right.length ? right : bullets.filter((b) => /S\d/.test(String(b)))
  const col = (side, tone, label, list, emptyText) => el('div',
    { className: 'nb-slide-tcol', 'data-side': side },
    slideKicker(label, tone),
    el('ul', { className: 'nb-slide-list' },
      list.map((b, i) => el('li', { key: `${side}${i}`, children: slideText(b, ctx.onCite) })))
    , list.length ? null : el('div', { className: 'nb-slide-empty', children: emptyText }))
  return el('div', { className: 'nb-slide nb-slide-tension' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-tension-body' },
      col('agree', 'ok', 'Stable ground', agree,
          'no shared ground found in the sources'),
      col('conflict', 'warn', 'Unresolved', conflict,
          'the sources do not contradict each other')))
}

/** roadmap — swimlanes with an owner per line. */
function slideRoadmap(s, ctx) {
  const lanes = (s.stages || []).slice(0, 4)
  const items = lanes.length
    ? lanes.map((st) => ({ label: st.label, detail: st.detail }))
    : (s.bullets || []).slice(0, 4).map((b) => {
        const [label, ...rest] = String(b).split(/\s+—\s+|\s+-\s+/)
        return { label, detail: rest.join(' — ') }
      })
  const lane = (it, i) => {
    const kids = [el('div', { className: 'nb-slide-lane-head' },
      el('span', { className: 'nb-slide-lane-n', children: it.label }),
      el('span', { className: 'nb-slide-lane-rule' }))]
    if (it.detail) kids.push(el('div', { className: 'nb-slide-lane-body', children: slideText(it.detail, ctx.onCite) }))
    return el('div', { className: 'nb-slide-lane', key: `l${i}` }, kids)
  }
  return el('div', { className: 'nb-slide nb-slide-roadmap' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('div', { className: 'nb-slide-lanes' }, items.map(lane)))
}

/** closing — the one line the deck wants remembered. */
function slideClosing(s, ctx) {
  return el('div', { className: 'nb-slide nb-slide-close' },
    el('div', { className: 'nb-slide-close-t', children: s.title }),
    (s.bullets || []).length
      ? el('div', { className: 'nb-slide-close-s', children: slideText(s.bullets[0], ctx.onCite) })
      : null,
    el('div', { className: 'nb-slide-hero-meta' },
      (s.citations || []).length
        ? el('span', { className: 'nb-slide-badge', 'data-tone': 'accent',
            children: `grounded in ${s.citations.map((n) => `S${n}`).join(' · ')}` })
        : null))
}

const SLIDE_LAYOUTS = {
  title_hero: slideTitleHero,
  executive_bluf: slideExecutiveBluf,
  problem_gap: slideProblemGap,
  architecture_bento: slideBento,
  process_pipeline: slidePipeline,
  deep_dive_comparison: slideComparison,
  tension_audit: slideTension,
  roadmap: slideRoadmap,
  closing: slideClosing
}

/** Draw one slide. An unknown or missing archetype falls back to the bullet
 *  list, which is what every deck rendered as before — so an older artifact
 *  still presents, it just looks like an older artifact. */
function SlideBody({ slide: s, ctx }) {
  const fn = SLIDE_LAYOUTS[s && s.archetype]
  if (fn) return fn(s, ctx)
  return el('div', { className: 'nb-slide' },
    el('div', { className: 'nb-slide-gap-head', children: s.title }),
    el('ul', { className: 'nb-slide-list' },
      (s.bullets || []).map((b, i) => el('li', { key: `fb${i}`, children: slideText(b, ctx.onCite) }))))
}

/** Human names for the archetype chip, so "problem_gap" never reaches a reader. */
const SLIDE_LABEL = {
  title_hero: 'Title',
  executive_bluf: 'Bottom line',
  problem_gap: 'Gap',
  architecture_bento: 'Architecture',
  process_pipeline: 'Pipeline',
  deep_dive_comparison: 'Comparison',
  tension_audit: 'Tensions',
  roadmap: 'Roadmap',
  closing: 'Close'
}

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
   `<script>` renders as text, which is what the reader typed. */

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
    className: 'nb-body', role: 'main', 'aria-label': 'Lab operations'
  },
  el('aside', { className: 'nb-col', style: { flex: '0 0 330px' } },
    el('div', { className: 'nb-pane-head' },
      el('span', { className: 'nb-meta', children: `Fleet · ${hosts.length}` }),
      jsx(IconBtn, { icon: 'refresh', label: 'Re-measure the fleet', onClick: load })),
    el('div', { className: 'nb-pad', style: { paddingBottom: '8px' } },
      state.error
        ? el('div', { style: { color: T.danger, fontSize: '13px', lineHeight: 1.5 }, children: state.error })
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
        // Name on its own line; the role leads the metadata line. Sharing one
        // line meant a fixed role column ate the hostname ("Decrux-L…"), and
        // inline roles left the column ragged. Role-first on line two fixes
        // both: every role starts at the same x, and the name gets the width.
        el('span', { style: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
          jsx('span', { className: 'nb-fname', children: h.name }),
          el('span', { style: { display: 'flex', alignItems: 'baseline', gap: '7px', minWidth: 0 } },
            jsx('span', { className: 'nb-frole', children: h.role }),
            jsx('span', {
              className: 'nb-mono',
              style: { fontSize: '11.5px', color: T.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 },
              children: h.reachable
                ? `${(h.kernel || '').replace(/-generic$/, '')} · ${Math.round((h.mem || {}).pct || 0)}% mem`
                : (h.error || 'no route').replace(/^ssh: /, '')
            }))),
        jsx('span', {
          className: 'nb-chip',
          'data-tone': h.reachable ? (h.patch_state === 'patched' ? 'ok' : 'warn') : 'danger',
          // the same words as the summary above: it said "2 fix available" there
          // and "fix avail" here, and "unreachable" vs "no route" for one state
          children: h.reachable ? (h.patch_state === 'patched' ? 'patched' : 'fix available') : 'unreachable'
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

  el('section', { className: 'nb-col nb-main-col', 'aria-label': 'Selected host' },
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
        el('span', { className: 'nb-mono', style: { fontSize: '12.5px', color: T.text4 }, children: host.dial || '' })),
      ok
        ? el('p', { className: 'nb-sub', children: `${host.os || ''} · kernel ${host.kernel || '?'} · up ${fmtUptime(host.uptime_s)} · ${host.cores || '?'} cores · load ${(host.load || []).map((n) => Number(n).toFixed(2)).join(' / ')}` })
        : el('p', { className: 'nb-sub', style: { color: T.danger }, children: host.error || 'this host did not answer' }),
      ok
        ? el('div', { className: 'nb-strip', role: 'group', 'aria-label': 'Host measurements' },
            el('div', { className: 'nb-cell' }, el('b', { children: `${Math.round((host.mem || {}).pct || 0)}%` }), el('span', { children: 'memory' })),
            el('div', { className: 'nb-cell' }, el('b', { children: `${Math.round((host.disk || {}).pct || 0)}%` }), el('span', { children: 'disk' })),
            el('div', { className: 'nb-cell' }, el('b', { children: host.containers_up || 0 }), el('span', { children: 'containers' })),
            el('div', { className: 'nb-cell' }, el('b', { style: { color: host.failed_units
              ? `color-mix(in srgb,${T.danger} 58%, ${T.text})`
              : `color-mix(in srgb,${T.ok} 58%, ${T.text})` }, children: host.failed_units || 0 }), el('span', { children: 'failed units' })),
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
                // 120 rows of a button all called "Restart" is one accessible
                // name 120 times: a screen reader hears "Restart, Restart,
                // Restart…" with no way to tell which unit it is about to
                // bounce. The visible word stays short; the name says what and
                // where.
                'aria-label': `Restart ${u.unit}${u.description ? ` — ${u.description}` : ''}`,
                title: `Restart ${u.unit}`,
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
        ? el('div', { className: 'nb-pad', style: { color: T.danger, fontSize: '13px' }, children: state.error })
        : el('div', { className: 'nb-pad' },
            state.loading
              ? el('span', { className: 'nb-hint', children: 'asking qm…' })
              : state.list.length
                ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
                    state.list.map((s) => el('div', {
                      key: s,
                      style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: `1px solid ${T.lineSoft}`, borderRadius: '12px', background: T.card }
                    },
                    jsx(Glyph, { name: 'camera', size: 14 }),
                    el('span', { style: { fontSize: '14px', fontWeight: 560 }, children: s }),
                    el('span', { style: { flex: 1 } }),
                    el('span', { className: 'nb-chip', children: `vm ${vmid}` }))))
                : el('div', { className: 'nb-hint', children: 'no snapshots for this VM — name one above and create it' })),
            state.raw ? el('pre', { className: 'nb-mono', style: { marginTop: '12px', fontSize: '12.5px', color: T.text4, whiteSpace: 'pre-wrap' }, children: state.raw }) : null)
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
              style: { border: `1px solid ${T.lineSoft}`, borderRadius: '12px', padding: '11px 13px', background: T.card }
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
      padding: '0 7px', border: 0, borderRadius: '7px', background: 'transparent', cursor: 'pointer',
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
  const ListRow = SDK.ListRow
  const ToggleRow = SDK.ToggleRow
  const SegmentedControl = SDK.SegmentedControl
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
  'study_guide', 'faq', 'timeline', 'mind_map', 'flashcards', 'quiz', 'slides',
  'infographic', 'data_table', 'blueprint_evolution']

/** The agent can write `::notebook{name="Fusion 2026"}` in a reply. */
function NotebookDirective({ attrs }) {
  const name = String((attrs && (attrs.name || attrs.notebook)) || '').slice(0, 120)
  if (!name) return null
  return el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0',
      padding: '12px 14px', borderRadius: '14px',
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
    contribute(ctx, 'directive', TRANSCRIPT_DIRECTIVE_AREA, {
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
export { App, StudioPanel, Viewer, OpsDeck, Rail, Markdown, KIND_ICON, CSS, plugin }
