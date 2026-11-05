# Hermes Plugin Competition — Submission Checklist

Deadline: **Nov 11, 2026, 5:00 PM EST** (Nov 12, 06:00 Beijing). Judged on
usefulness, reliability, polish, creativity — they favor plugins that do more
than a prompt or skill could. Prize pool $20k; accepted entries are listed in
the Hermes Marketplace.

## 1. Plugin repo — DONE (verify before submitting)

- [x] Standalone repo: `github.com/DECRUX9812/hermes-plugin-notebook`
- [x] `plugin.yaml` manifest v2, `provides_tools` matches the 16 registered tools
- [x] `hermes plugins validate .` — all checks pass (manifest, capabilities,
      security scan, no core overrides)
- [x] `hermes plugins doctor` — tools registered, import clean
- [x] 58 unit tests pass (`python -m pytest tests/ -q`)
- [x] E2E verified on live Hermes: create → add (auto-labels) → ask (cited) →
      generate quiz/slides/infographic/flashcards-csv → note → search → export →
      update → suggest → audio overview (mp3 + transcript + MEDIA share)
      → video overview (mp4, A/V streams verified in sync)
- [x] Full NotebookLM parity surface: 16 tools — chat threads, notes, search,
      source refresh/delete, rename, export, web discovery, slides, infographic,
      Anki CSV, video styles, duplicate detection
- [x] Catalog landing assets: `assets/banner.png` + 6 real-output screenshots,
      wired into `image:`/`screenshots:` in the catalog draft
- [ ] Final review pass on README screenshots/GIFs (optional polish)
- [ ] Tag a release `v0.1.0` on GitHub (optional but looks polished)

## 2. Catalog PR to NousResearch/hermes-agent

- [~] Catalog branch READY: `plugin-catalog/hermes-notebook` pushed to
      `DECRUX9812/hermes-agent-contrib` (commit 0bf3b7c, adds
      `plugin-catalog/hermes-notebook.yaml`). PR creation via API is blocked
      (GitHub FORBIDDEN — likely interaction limits on the account). Create it
      in the browser:
      https://github.com/NousResearch/hermes-agent/compare/main...DECRUX9812:hermes-agent-contrib:plugin-catalog/hermes-notebook
- [ ] `sha:` is pinned to the final code commit — bump it to
      `git -C ~/Code/hermes-plugin-notebook rev-parse HEAD~0` (the commit that
      contains the code; a later docs-only commit is fine to leave unpinned)
      and update every `…/<sha>/…` asset URL in the same edit
      (assets URLs must match the pin too)
- [ ] `hermes plugins validate` runs in catalog CI at the pinned SHA — it must
      pass there (it already does locally)
- [ ] PR title e.g. `plugin-catalog: add hermes-notebook`; body: what it does,
      test plan (doctor + validate + the E2E flow above), link to repo + demo
- [ ] Note in PR/description: entry submitted for the Plugin Competition

## 3. Demo video (<90 seconds, public, on X)

- [x] Demo video RENDERED: `~/Desktop/GetBB x Hermes/videos/hermes-notebook-demo/renders/demo-final.mp4`
      (88s, 1920x1080, ambient pad). Real plugin output: title → ingest with
      auto-labels → cited ask → mind_map/slides/audio artifacts → install CTA.
      Source project: same dir (`index.html` + `record.mjs`, re-recordable).
- [ ] Post it on X tagging **@NousResearch** (upload the mp4), keep the URL
- [ ] Upload the same video to YouTube/Loom as backup link
- [ ] (Optional reference arc below if a re-record is needed:)
  1. (0–8s) "NotebookLM, but inside Hermes — and it talks back."
  2. (8–20s) `/notebook new` + drag in 2–3 real sources (a PDF + a link)
      — show auto-label chips appearing
  3. (20–40s) `notebook_ask` a real question → show cited answer [S1]/[S2]
  4. (40–55s) `notebook_generate mind_map` or `flashcards` → open the artifact
  5. (55–75s) `notebook_audio` → play 10s of the two-host podcast + show mp3
     (or `notebook_video` → show the cinematic mp4 — stronger visual, slower to render)
  6. (75–90s) `/notebook suggest` or closing card: repo link
- [ ] Keep it real — judges score reliability; a genuine run beats a mock
- [ ] Post on X tagging **@NousResearch**, keep the URL
- [ ] Upload the same video to YouTube/Loom as backup link

## 4. Submission form

- [ ] Typeform: `https://form.typeform.com/to/FwJLvOln`
- [ ] Submit: catalog PR link + demo video link
- [ ] (Optional) drop the plugin link + one-line pitch in the Nous Research
      Discord hackathon thread when it opens after submissions close

## Known limitations to mention if asked

- Audio overview takes 1–3 min, video overview 3–6 min (per-segment neural
  TTS + Pillow cards + ffmpeg); needs network + ffmpeg on PATH.
- edge-tts is an unofficial Microsoft endpoint — it rate-limits; the plugin
  retries per segment and degrades to a fallback voice rather than dying.
- Context budgets are bounded (28k ask / 42k podcast chars); huge notebooks
  use head+tail digests for generation.
- Scanned PDFs need OCR first; YouTube needs public captions.
