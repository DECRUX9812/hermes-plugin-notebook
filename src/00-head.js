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
.nb-root{
  --nb-rail: 300px; --nb-studio: 392px;
  display:flex; flex-direction:column; height:100%; min-height:0;
  color:${T.text}; font-size:16px; line-height:1.5;
  font-variant-numeric: tabular-nums;
}
.nb-root *{box-sizing:border-box}
.nb-root :focus-visible{outline:2px solid ${T.accent}; outline-offset:2px; border-radius:6px}
.nb-mono{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-ligatures:none}
.nb-meta{font-size:12.5px;letter-spacing:.07em;text-transform:uppercase;color:${T.text3};font-weight:600}
.nb-num{font-family:var(--ui-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-variant-numeric:tabular-nums}

/* app bar */
.nb-bar{display:flex;align-items:center;gap:14px;height:54px;flex:0 0 54px;
  padding:0 16px;border-bottom:1px solid ${T.line};}
.nb-brand{display:flex;align-items:center;gap:10px;min-width:0}
.nb-mark{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex:0 0 auto;
  background:color-mix(in srgb,${T.accent} 16%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 32%, transparent);color:${T.accent}}
.nb-brandname{font-weight:650;letter-spacing:-.01em;font-size:16px}
.nb-crumb{color:${T.text3};font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nb-crumb b{color:${T.text2};font-weight:550}
.nb-spacer{flex:1 1 auto}
.nb-actions{display:flex;align-items:center;gap:8px}

/* controls */
.nb-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  min-height:34px;padding:0 12px;border-radius:9px;cursor:pointer;font-size:14px;
  font-weight:560;border:1px solid ${T.line};background:${T.card};color:${T.text};
  transition:background .12s ease,border-color .12s ease,transform .06s ease}
.nb-btn:hover{background:color-mix(in srgb,${T.text} 9%, transparent);border-color:${T.lineSoft}}
.nb-btn:active{transform:translateY(0.5px)}
.nb-btn[disabled]{opacity:.45;cursor:not-allowed}
.nb-btn[data-variant=primary]{background:color-mix(in srgb,${T.accent} 20%, transparent);
  border-color:color-mix(in srgb,${T.accent} 46%, transparent);color:${T.accent};font-weight:650}
.nb-btn[data-variant=primary]:hover{background:color-mix(in srgb,${T.accent} 30%, transparent);
  border-color:color-mix(in srgb,${T.accent} 62%, transparent)}
.nb-btn[data-variant=ghost]{background:transparent;border-color:transparent;color:${T.text2}}
.nb-btn[data-variant=ghost]:hover{background:color-mix(in srgb,${T.text} 7%, transparent);color:${T.text}}
.nb-btn[data-size=sm]{min-height:28px;font-size:13px;padding:0 9px;border-radius:7px}
.nb-icon{width:36px;height:36px;min-height:36px;padding:0;border-radius:9px;display:grid;place-items:center;
  cursor:pointer;border:1px solid transparent;background:transparent;color:${T.text2}}
.nb-icon:hover{background:color-mix(in srgb,${T.text} 8%, transparent);color:${T.text}}
.nb-icon[data-active=true]{background:color-mix(in srgb,${T.accent} 16%, transparent);color:${T.accent}}
.nb-seg{display:inline-flex;padding:3px;gap:2px;border-radius:10px;background:${T.cardDeep};
  border:1px solid ${T.lineSoft}}
.nb-seg[data-fill="true"]{display:flex;width:100%}
.nb-seg[data-fill="true"] > button{flex:1;justify-content:center;padding:0 10px;font-size:13px}
.nb-seg > button{min-height:32px;padding:0 12px;border-radius:7px;border:0;background:transparent;
  color:${T.text3};font-size:13.5px;font-weight:600;cursor:pointer;letter-spacing:.01em;
  display:inline-flex;align-items:center;gap:6px}
.nb-seg > button:hover{color:${T.text}}
.nb-seg > button[aria-selected=true]{background:color-mix(in srgb,${T.text} 15%, transparent);
  color:${T.text};box-shadow:inset 0 0 0 1px ${T.line}, 0 1px 0 rgba(0,0,0,.18)}
.nb-field{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border-radius:9px;
  border:1px solid ${T.line};background:${T.cardDeep};color:${T.text2}}
.nb-field input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;
  color:${T.text};font-size:14.5px;font-family:inherit}
.nb-field input::placeholder{color:${T.text4}}

/* body */
.nb-body{flex:1 1 auto;display:grid;grid-template-columns:var(--nb-rail) minmax(0,1fr) var(--nb-studio);
  min-height:0;overflow:hidden}
.nb-col{min-width:0;min-height:0;display:flex;flex-direction:column}
.nb-rail{position:relative;border-right:1px solid ${T.line};background:color-mix(in srgb,${T.text} 2%, transparent)}
.nb-studio{position:relative;border-left:1px solid ${T.line};background:color-mix(in srgb,${T.text} 2%, transparent)}
.nb-fade{position:absolute;left:0;right:0;bottom:0;height:34px;pointer-events:none;
  background:linear-gradient(to top, color-mix(in srgb, ${T.text} 6%, #0b0c11), transparent)}
.nb-pane-head{display:flex;align-items:center;gap:8px;height:44px;flex:0 0 44px;padding:0 14px;
  border-bottom:1px solid ${T.lineSoft}}
.nb-pane-head .nb-meta{flex:1}
.nb-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
.nb-pad{padding:12px}

/* rail */
.nb-nbrow{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;cursor:pointer;
  border:1px solid transparent;background:transparent;border-radius:10px;padding:9px 10px;color:${T.text}}
.nb-nbrow:hover{background:color-mix(in srgb,${T.text} 5%, transparent)}
.nb-nbrow[aria-current=true]{background:color-mix(in srgb,${T.accent} 12%, transparent);
  border-color:color-mix(in srgb,${T.accent} 26%, transparent)}
.nb-nbrow[aria-current=true] .nb-nbtitle{color:${T.text}}
.nb-nbtitle{font-size:14.5px;font-weight:600;line-height:1.3;color:${T.text2};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-nbsub{font-size:12.5px;color:${T.text3};margin-top:2px}
.nb-avatar{width:30px;height:30px;border-radius:8px;flex:0 0 auto;display:grid;place-items:center;
  font-size:12px;font-weight:700;letter-spacing:-.02em;color:${T.accent};
  background:color-mix(in srgb,${T.accent} 13%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 22%, transparent)}

.nb-src{display:flex;gap:10px;width:100%;text-align:left;cursor:pointer;border-radius:10px;
  padding:9px 10px;border:1px solid transparent;background:transparent;color:${T.text}}
.nb-src:hover{background:color-mix(in srgb,${T.text} 5%, transparent)}
.nb-src[data-on=true]{background:color-mix(in srgb,${T.accent} 10%, transparent);
  border-color:color-mix(in srgb,${T.accent} 24%, transparent)}
.nb-cite{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:11.5px;font-weight:700;
  color:${T.text3};padding-top:2px;min-width:22px}
.nb-src[data-on=true] .nb-cite{color:${T.accent}}
.nb-src-title{font-size:14.5px;font-weight:550;line-height:1.32;color:${T.text};
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.nb-src-meta{display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap}
.nb-chip{display:inline-flex;align-items:center;gap:4px;height:21px;padding:0 7px;border-radius:6px;
  font-size:11.5px;font-weight:550;letter-spacing:.01em;color:${T.text2};
  background:color-mix(in srgb,${T.text} 7%, transparent);
  border:1px solid ${T.lineSoft};white-space:nowrap}
.nb-chip[data-tone=accent]{color:${T.accent};background:color-mix(in srgb,${T.accent} 18%, transparent);
  border-color:color-mix(in srgb,${T.accent} 40%, transparent)}
.nb-chip[data-tone=ok]{color:${T.ok};background:color-mix(in srgb,${T.ok} 12%, transparent);
  border-color:color-mix(in srgb,${T.ok} 26%, transparent)}
.nb-chip[data-tone=warn]{color:${T.warn};background:color-mix(in srgb,${T.warn} 13%, transparent);
  border-color:color-mix(in srgb,${T.warn} 28%, transparent)}
.nb-chip[data-tone=danger]{color:${T.danger};background:color-mix(in srgb,${T.danger} 13%, transparent);
  border-color:color-mix(in srgb,${T.danger} 28%, transparent)}
.nb-chip[data-click=true]{cursor:pointer;min-height:32px;height:32px;padding:0 11px;font-size:12.5px}
.nb-chip[data-click=true]:hover{background:color-mix(in srgb,${T.text} 12%, transparent)}

/* main */
.nb-main-head{padding:16px 22px 12px;border-bottom:1px solid ${T.lineSoft};flex:0 0 auto}
.nb-h1{font-size:23px;font-weight:650;letter-spacing:-.02em;line-height:1.2;margin:0}
.nb-sub{color:${T.text3};font-size:14.5px;margin-top:5px;max-width:70ch}
.nb-strip{display:flex;align-items:stretch;margin-top:14px;border:1px solid ${T.line};
  border-radius:11px;overflow:hidden;background:${T.card}} 
.nb-cell{flex:1;padding:9px 14px;border-right:1px solid ${T.lineSoft};min-width:0}
.nb-cell:last-child{border-right:0}
.nb-cell b{display:block;font-size:18px;font-weight:650;letter-spacing:-.01em;line-height:1.15}
.nb-cell span{display:block;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;
  color:${T.text3};margin-top:3px;font-weight:600}
.nb-tabs{display:flex;gap:4px;align-items:center;margin:12px 0 0}
.nb-tab{min-height:32px;padding:0 12px;border-radius:8px;border:1px solid transparent;
  background:transparent;color:${T.text3};font-size:14px;font-weight:600;cursor:pointer;
  display:inline-flex;align-items:center;gap:7px}
.nb-tab:hover{color:${T.text};background:color-mix(in srgb,${T.text} 6%, transparent)}
.nb-tab[aria-selected=true]{color:${T.text};background:color-mix(in srgb,${T.text} 10%, transparent);
  border-color:${T.line}}

/* chat */
.nb-chat{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-thread{flex:1;min-height:0;overflow:auto;padding:20px 22px 8px;display:flex;flex-direction:column;gap:18px}
.nb-msg{display:flex;gap:12px;max-width:78ch}
.nb-msg[data-role=user]{align-self:flex-end;flex-direction:row-reverse}
.nb-msg-body{min-width:0}
.nb-msg[data-role=user] .nb-bubble{background:color-mix(in srgb,${T.accent} 13%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 22%, transparent);border-radius:12px 12px 4px 12px;
  padding:10px 14px;font-size:15.5px}
.nb-msg[data-role=assistant] .nb-bubble{font-size:16px;line-height:1.62;color:${T.text}}
.nb-who{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:${T.text4};
  font-weight:700;margin-bottom:6px}
.nb-md p{margin:0 0 10px}
.nb-md h2{font-size:17px;margin:16px 0 8px;letter-spacing:-.01em}
.nb-md h3{font-size:15.5px;margin:14px 0 6px;color:${T.text2}}
.nb-md ul{margin:0 0 10px;padding-left:20px}
.nb-md li{margin:4px 0}
.nb-md code{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13.5px;
  background:color-mix(in srgb,${T.text} 9%, transparent);padding:1px 5px;border-radius:5px}
.nb-md strong{font-weight:650;color:${T.text}}
.nb-md blockquote{margin:10px 0;padding:2px 0 2px 12px;border-left:2px solid ${T.accent};color:${T.text2}}
.nb-inline-cite{display:inline-flex;align-items:center;min-height:26px;padding:0 7px;margin:0 2px;
  border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;vertical-align:baseline;
  font-family:var(--ui-font-mono,ui-monospace,monospace);color:${T.accent};
  background:color-mix(in srgb,${T.accent} 12%, transparent);
  border:1px solid color-mix(in srgb,${T.accent} 26%, transparent)}
.nb-inline-cite:hover{background:color-mix(in srgb,${T.accent} 22%, transparent)}
.nb-composer{flex:0 0 auto;padding:12px 22px 16px;border-top:1px solid ${T.lineSoft}}
.nb-askbox{display:flex;flex-direction:column;gap:8px;border:1px solid ${T.line};border-radius:12px;
  background:${T.card};padding:10px 12px}
.nb-askbox:focus-within{border-color:color-mix(in srgb,${T.accent} 45%, transparent)}
.nb-askbox textarea{width:100%;min-height:44px;max-height:150px;resize:none;border:0;outline:0;
  background:transparent;color:${T.text};font-size:16px;line-height:1.5;font-family:inherit}
.nb-askbox textarea::placeholder{color:${T.text4}}
.nb-askfoot{display:flex;align-items:center;gap:8px}
.nb-hint{font-size:12.5px;color:${T.text3}}

/* studio cards */
.nb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}
.nb-card{display:flex;flex-direction:column;gap:6px;min-height:104px;padding:11px;border-radius:11px;
  border:1px solid ${T.line};background:${T.card};cursor:pointer;text-align:left;color:${T.text};
  position:relative;transition:border-color .12s ease,background .12s ease}
.nb-card:hover{border-color:color-mix(in srgb,${T.accent} 34%, transparent);
  background:color-mix(in srgb,${T.accent} 7%, ${T.card})}
.nb-card[data-ready=true]{background:linear-gradient(180deg,
  color-mix(in srgb,${T.accent} 9%, ${T.card}), ${T.card})}
.nb-card[data-busy=true]{border-color:color-mix(in srgb,${T.accent} 50%, transparent)}
.nb-card-top{display:flex;align-items:center;gap:8px}
.nb-card-ic{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex:0 0 auto;
  color:${T.accent};background:color-mix(in srgb,${T.accent} 12%, transparent)}
.nb-card-name{font-size:14.5px;font-weight:620;letter-spacing:-.01em;line-height:1.2}
.nb-card-blurb{font-size:13px;color:${T.text3};line-height:1.38;flex:1}
.nb-card-state{display:flex;align-items:center;gap:6px;font-size:12px;color:${T.text3};
  letter-spacing:.01em;font-weight:600;margin-top:auto}
.nb-card[data-ready="false"]{background:color-mix(in srgb,${T.text} 2.5%, transparent)}
.nb-card[data-ready="false"]:hover{border-color:color-mix(in srgb,${T.accent} 38%, transparent);
  background:color-mix(in srgb,${T.accent} 6%, transparent)}
.nb-card[data-ready="false"] .nb-card-state{color:${T.accent};font-weight:650}
.nb-card[data-ready="true"] .nb-card-state{color:${T.text3}}
.nb-card[data-ready="true"]:hover .nb-card-state{color:${T.text2}}
.nb-bar-track{height:3px;border-radius:2px;background:color-mix(in srgb,${T.text} 10%, transparent);
  overflow:hidden;margin-top:2px}
.nb-bar-fill{height:100%;background:${T.accent};border-radius:2px;transition:width .4s ease}
.nb-dot{width:6px;height:6px;border-radius:99px;background:${T.ok};box-shadow:0 0 6px ${T.ok}}

/* viewer */
.nb-view{flex:1;min-height:0;display:flex;flex-direction:column}
.nb-view-head{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid ${T.lineSoft}}
.nb-view-title{font-size:15px;font-weight:620;letter-spacing:-.01em}
.nb-view-body{flex:1;min-height:0;overflow:auto;padding:20px 24px}
.nb-doc{max-width:74ch;font-size:16px;line-height:1.66}
.nb-doc h2{font-size:19px;margin:22px 0 10px;letter-spacing:-.015em}
.nb-doc h2:first-child{margin-top:0}
.nb-doc h3{font-size:16px;margin:18px 0 6px;color:${T.text2}}
.nb-doc ul,.nb-doc ol{padding-left:22px;margin:0 0 12px}
.nb-doc li{margin:5px 0}
.nb-doc table{border-collapse:collapse;width:100%;font-size:14.5px;margin:12px 0}
.nb-doc th,.nb-doc td{border:1px solid ${T.line};padding:7px 10px;text-align:left}
.nb-doc th{background:${T.cardDeep};font-weight:620}
.nb-doc pre{background:${T.cardDeep};border:1px solid ${T.lineSoft};border-radius:9px;padding:12px;
  overflow:auto;font-size:13.5px}

/* stage (media) */
.nb-stage{display:flex;flex-direction:column;gap:14px}
.nb-screen{position:relative;border-radius:14px;overflow:hidden;background:#07080b;
  border:1px solid ${T.line};aspect-ratio:16/9;display:grid;place-items:center}
.nb-screen video,.nb-screen iframe{width:100%;height:100%;border:0;display:block;background:#07080b}
.nb-screen-audio{aspect-ratio:auto;padding:18px;display:flex;flex-direction:column;gap:14px;
  place-items:stretch;width:100%;
  background:linear-gradient(150deg,color-mix(in srgb,${T.accent} 16%, #0a0b10),#0a0b10)}
.nb-wave{display:flex;align-items:center;gap:2px;height:64px;width:100%}
.nb-wave i{flex:1 1 0;min-width:2px;background:color-mix(in srgb,${T.accent} 72%, white);
  border-radius:2px;opacity:.55;transition:opacity .2s,transform .2s}
.nb-wave i[data-past=true]{opacity:1}
.nb-ctrl{display:flex;align-items:center;gap:10px}
.nb-timeline{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none}
.nb-tl{display:grid;grid-template-columns:96px 1fr;gap:14px;padding:10px 0;border-top:1px solid ${T.lineSoft}}
.nb-tl:first-child{border-top:0}
.nb-tl-when{font-size:13px;font-weight:650;color:${T.accent};letter-spacing:.02em}
.nb-tl-what{font-size:15px;color:${T.text2}}

/* mind map */
.nb-map{width:100%;height:100%;min-height:320px;display:block;cursor:grab;
  border-radius:12px;background:radial-gradient(circle at 50% 45%,
   color-mix(in srgb,${T.accent} 9%, transparent), transparent 62%)}
.nb-map:active{cursor:grabbing}

/* flashcards */
.nb-deck{display:flex;flex-direction:column;gap:16px;max-width:620px;margin:0 auto}
.nb-flip{perspective:1400px;cursor:pointer;border:0;background:transparent;padding:0}
.nb-flip-inner{position:relative;width:100%;min-height:300px;transition:transform .5s cubic-bezier(.2,.7,.2,1);
  transform-style:preserve-3d}
.nb-flip[data-flipped=true] .nb-flip-inner{transform:rotateY(180deg)}
.nb-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;
  border:1px solid ${T.line};background:${T.card};padding:26px;display:flex;flex-direction:column;
  justify-content:center;gap:10px;font-size:19px;line-height:1.45}
.nb-face[data-side=back]{transform:rotateY(180deg);
  background:linear-gradient(160deg,color-mix(in srgb,${T.accent} 12%, ${T.card}),${T.card})}
.nb-face .nb-meta{position:absolute;top:16px;left:20px}
.nb-face-hint{font-size:12.5px;color:${T.text4};margin-top:auto;letter-spacing:.01em}

/* ops */
.nb-fleet{display:flex;flex-direction:column;gap:2px;padding:8px}
.nb-frow{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:10px;
  padding:8px 10px;border-radius:9px;border:1px solid transparent;background:transparent;
  cursor:pointer;text-align:left;color:${T.text};min-height:44px}
.nb-frow:hover{background:color-mix(in srgb,${T.text} 5%, transparent)}
.nb-frow[aria-current=true]{background:color-mix(in srgb,${T.accent} 11%, transparent);
  border-color:color-mix(in srgb,${T.accent} 24%, transparent)}
.nb-fname{font-size:14.5px;font-weight:600;line-height:1.25}
.nb-frole{font-size:12px;color:${T.text4};text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.nb-term{font-family:var(--ui-font-mono,ui-monospace,monospace);font-size:13.5px;line-height:1.55;flex:1 1 auto;
  background:#08090d;color:#d6d8e6;border-radius:10px;border:1px solid ${T.line};
  padding:12px 14px;min-height:120px;max-height:none;overflow:auto;white-space:pre-wrap;
  word-break:break-word}
.nb-term-in{display:flex;gap:8px;align-items:center;margin-top:10px}
.nb-term-in input{flex:1;height:38px;border-radius:9px;border:1px solid ${T.line};
  background:${T.cardDeep};color:${T.text};padding:0 12px;font-size:14px;
  font-family:var(--ui-font-mono,ui-monospace,monospace);outline:0}
.nb-term-in input:focus{border-color:color-mix(in srgb,${T.accent} 45%, transparent)}

/* status bar */
.nb-status{flex:0 0 32px;height:32px;display:flex;align-items:center;gap:16px;padding:0 14px;
  border-top:1px solid ${T.line};background:color-mix(in srgb,${T.text} 3%, transparent);
  font-size:12.5px;color:${T.text3}}
.nb-status b{color:${T.text2};font-weight:600}
.nb-sdot{width:7px;height:7px;border-radius:99px;display:inline-block;margin-right:6px}
.nb-void{display:grid;place-items:center;height:100%;padding:32px;text-align:center;color:${T.text3}}
.nb-void h3{color:${T.text};font-size:18px;margin:0 0 8px;letter-spacing:-.01em}
.nb-void p{margin:0;max-width:46ch;font-size:14.5px;line-height:1.6}

@media (max-width:1280px){
  .nb-root{--nb-rail:264px; --nb-studio:340px}
}
@media (max-width:1100px){
  .nb-body{grid-template-columns:240px minmax(0,1fr)}
  .nb-studio{display:none}
}
@media (max-width:820px){
  .nb-body{grid-template-columns:minmax(0,1fr)}
  .nb-rail{display:none}
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
