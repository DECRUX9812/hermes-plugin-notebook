# Hermes Plugin Competition — Submission Checklist

Deadline: **Nov 11, 2026, 5:00 PM EST** (Nov 12, 06:00 Beijing). Judged on
usefulness, reliability, polish, creativity — they favor plugins that do more
than a prompt or skill could. Prize pool $20k; accepted entries are listed in
the Hermes Marketplace.

## 1. Plugin repo — DONE (verify before submitting)

- [x] Standalone repo: `github.com/DECRUX9812/hermes-plugin-notebook`
- [x] `plugin.yaml` manifest v2, `provides_tools` matches the 9 registered tools
- [x] `hermes plugins validate .` — all checks pass (manifest, capabilities,
      security scan, no core overrides)
- [x] `hermes plugins doctor` — tools registered, import clean
- [x] 42 unit tests pass (`python -m pytest tests/ -q`)
- [x] E2E verified on live Hermes: create → add (auto-labels) → ask (cited) →
      generate quiz → suggest → audio overview (mp3 + transcript + MEDIA share)
      → video overview (mp4, A/V streams verified in sync)
- [x] Catalog landing assets: `assets/banner.png` + 6 real-output screenshots,
      wired into `image:`/`screenshots:` in the catalog draft
- [ ] Final review pass on README screenshots/GIFs (optional polish)
- [ ] Tag a release `v0.1.0` on GitHub (optional but looks polished)

## 2. Catalog PR to NousResearch/hermes-agent

- [ ] Copy `submission/hermes-notebook.catalog.yaml` →
      `plugin-catalog/hermes-notebook.yaml` in a fresh branch of
      `hermes-agent` (fork: `DECRUX9812/hermes-agent-contrib` already exists)
- [ ] `sha:` is already pinned to `05b3c11…` — bump it to
      `git -C ~/Code/hermes-plugin-notebook rev-parse HEAD` if any code
      changes land before submission (assets URLs must match the pin too)
- [ ] `hermes plugins validate` runs in catalog CI at the pinned SHA — it must
      pass there (it already does locally)
- [ ] PR title e.g. `plugin-catalog: add hermes-notebook`; body: what it does,
      test plan (doctor + validate + the E2E flow above), link to repo + demo
- [ ] Note in PR/description: entry submitted for the Plugin Competition

## 3. Demo video (<90 seconds, public, on X)

- [ ] Screen-record a tight flow — suggested 75s arc:
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
