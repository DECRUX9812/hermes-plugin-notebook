"""Seed the demo notebook's artifacts through the plugin's REAL pipeline.

What is real: `artifacts.generate()`, `make_audio_overview()` and
`make_video_overview()` run unchanged — the same schema, renderers, edge-tts
synthesis, Pillow cards, ffmpeg assembly and timestamps the product uses.

What is authored: the model *output* (markdown bodies, JSON trees, podcast
script, video beats). The box's configured provider had no credits left on the
CLI path while this was built, so the text below was written by the agent
reading the six sources in `sources/`. Every number quoted is from them; the
labelling is marked in `tests/demo-sources.json`. Re-run with a working model
(`python3 tests/gen_artifacts.py`) to regenerate the same artifacts for real.

    HERMES_HOME=~/.hermes python3 tests/seed_demo.py --notebook commercial-fusion-2026
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from hermes_notebook import artifacts, audio, llmio, runtime, store, video  # noqa: E402


class _R:
    def __init__(self, text="", parsed=None):
        self.text = text
        self.parsed = parsed


LABELS = {
    "crs-toward-commercial-fusion-energy": (
        ["CRS", "policy", "federal funding", "FY2025 budget"],
        "Congressional Research Service briefing: fusion physics, the DOE/FES programme "
        "($790M in FY2025), inertial confinement (~$700M), and the policy questions a "
        "commercial build-out raises."),
    "reuters-us-fusion-roadmap-mid-2030s": (
        ["roadmap", "Reuters", "FIA funding", "engineering gaps"],
        "DOE's Fusion Science and Technology Roadmap (June) targets pilot plants by the "
        "mid-2030s; industry says it needs >$1B a year. FIA counts $4.48B raised to July "
        "2026 and $14.24B cumulative since 2021."),
    "ans-iter-assembly-progress": (
        ["ITER", "assembly", "schedule"],
        "ANS Nuclear Newswire on ITER's assembly campaign: sector-module installation "
        "running ahead of plan under the accelerated assembly approach."),
    "iter-two-thirds-tokamak-core": (
        ["ITER", "tokamak", "sector module", "milestone"],
        "ITER's own release: sixth of nine sector modules installed on 28 July 2026, "
        "~30 hours of lifting, a 1,100-tonne module, two-thirds of the torus in place, "
        "final module due 2027."),
    "iaea-world-fusion-outlook-2025": (
        ["IAEA", "outlook", "global fleet"],
        "IAEA's World Fusion Outlook 2025: the international reference on device counts, "
        "timelines and the regulatory picture across member states."),
    "wikipedia-fusion-power": (
        ["reference", "confinement", "tritium", "history"],
        "Reference article: confinement approaches, tritium breeding, the neutron-damage "
        "problem and the historical funding curve."),
}

SUMMARY = """The six sources agree on the physics and disagree on the clock.

**Where the money is.** Public money is flat and private money is not. The CRS briefing puts the DOE fusion energy sciences (FES) budget at **$790M for FY2025**, with the 2026 appropriation at **$806M** — about a fifth of it directed at ITER. Against that, the Fusion Industry Association (via Reuters) counts **$4.48B raised in the twelve months to July 2026** and **$14.24B cumulative since 2021**. The CRS puts cumulative private investment at "nearly $9B between 2021 and 2025" on its own survey basis, so the two trackers disagree on the total by roughly half — a difference in what is counted, not in direction.

**Where the machine is.** ITER installed its **sixth of nine** tokamak sector modules on 28 July 2026, roughly six months ahead of schedule, after a 30-hour lift of a ~1,100-tonne module. Two-thirds of the torus is now in place; the ninth module is planned for 2027. Assembly pace, not physics, is the thing that improved.

**Where the gap is.** The DOE roadmap (June) aims at pilot plants in the **mid-2030s**. The sources name three engineering problems that no roadmap schedule closes on its own: neutron-resistant structural materials, a working tritium breeding blanket, and a supply chain that can qualify both at scale. Reuters reports industry's own number for what the programme needs: **more than $1B a year for a decade**. Congress appropriated $790M.

**What none of the sources settle.** Levelised cost. The CRS is explicit that no defensible figure exists yet; anyone quoting one is quoting a projection.
"""

BRIEFING = """## Bottom line

Fusion in 2026 is a **funding story with an engineering tail**. Private capital has taken over the risk that public programmes used to carry, and the flagship public machine is finally assembling at pace — but the three items that decide whether a plant ever sells power (materials, tritium, supply chain) are untouched by either.

## What changed this year

- **ITER's assembly is ahead of plan.** Sixth of nine sector modules placed 28 July 2026, ~30 hours per lift, final module due 2027 [S3][S4].
- **The DOE roadmap exists.** Released June, targeting early deployment by the mid-2030s, with a Milestone-based programme ($415M, 2022-2027) reimbursing eight companies on pre-negotiated technical targets [S2].
- **Private funding set a record.** $4.48B in the twelve months to July 2026; $14.24B cumulative since 2021 [S2].

## Decisions on the table

1. **Appropriations, not authorisation.** The 2022 legislation authorised up to $1.1B for FES in FY2027; Congress appropriated $790M for FY2025 and $806M for 2026 [S1][S2]. Authorised ceiling is not a budget.
2. **Milestone payments vs. grants.** The Milestone programme pays on delivered targets. That is a different instrument from a research grant and should be judged on different metrics.
3. **ITER's share.** About 21% of the FES budget goes to ITER. Cutting it buys domestic programme money at the cost of the only operating multi-national machine [S1].

## Risks the sources name

- **Materials.** Neutron-resistant structural material qualified for plant lifetimes does not exist commercially [S2].
- **Tritium.** Without a breeding blanket there is no fuel cycle; the world's civil tritium inventory is measured in kilograms [S2][S6].
- **Cost.** No source offers a levelised cost figure it will defend [S1].
- **Timeline inertia.** A 2027 last-module milestone plus first-plasma and nuclear campaigns leaves little slack before a mid-2030s pilot [S3][S4].
"""

STUDY = """## The five ideas you need

### 1. Confinement
Magnetic (tokamak, stellarator) holds a low-density plasma for seconds to minutes; inertial (laser, z-pinch) compresses a fuel capsule in nanoseconds. ITER is magnetic; NIF is inertial.

### 2. Net energy, defined
Scientific breakeven compares fusion output to laser energy on target, not to energy drawn from the grid. A plant needs engineering gain an order of magnitude higher, plus a thermal cycle.

### 3. The tritium problem
Deuterium is abundant; tritium is not. A D-T plant must breed its own tritium in a lithium blanket, and no blanket has yet run at plant-relevant neutron flux.

### 4. Neutron damage
14 MeV neutrons displace atoms in the first wall. Structural materials must survive tens of displacements per atom — the reason a dedicated irradiation facility is on every roadmap.

### 5. The money shape
Public R&D is flat (~$790M FES in FY2025); private capital is a record ($4.48B in the year to July 2026). The gap between them is the story of the decade.

## Check yourself

1. Why is scientific breakeven not the same as a power plant? *(Grid energy vs. on-target laser energy; thermal conversion; duty cycle.)*
2. What does the ITER module count tell you, and what does it not? *(Assembly pace vs. first plasma and nuclear operation.)*
3. Name the two fuel-cycle dependencies of a D-T plant. *(Tritium breeding and a lithium supply chain.)*
4. What would make you distrust a quoted cost of fusion electricity in 2026? *(No operating plant; the CRS says no defensible figure exists.)*
5. Why does the FIA's cumulative total differ from the CRS's? *(Different survey populations and what counts as "fusion investment".)*
"""

FAQ = """**How much does the US government spend on fusion?**
$790M for fusion energy sciences in FY2025; the FY2026 appropriation is $806M, about 21% of which goes to ITER. Inertial confinement fusion is funded separately at roughly $700M. [S1]

**How much has private fusion raised?**
$4.48B in the twelve months to July 2026, and $14.24B cumulative since 2021, per the Fusion Industry Association. The CRS's own survey puts cumulative private investment at nearly $9B for 2021-2025. [S2][S1]

**When will fusion deliver power to the grid?**
The DOE roadmap targets early deployment by the mid-2030s. The IAEA's outlook is longer-horizon and does not endorse that date. Treat the mid-2030s as a policy target, not a forecast. [S2][S5]

**How far along is ITER?**
Two-thirds of the tokamak core is installed: six of nine sector modules, the sixth placed 28 July 2026 about six months ahead of schedule, with the final module planned for 2027. [S4][S3]

**What is still unsolved?**
Neutron-resistant structural materials, a tritium breeding blanket, and a supply chain able to qualify both — plus a levelised cost figure nobody will defend. [S2][S1]

**Does the Milestone programme fund companies or labs?**
Companies: $415M over 2022-2027, reimbursing eight firms after pre-negotiated technical targets. [S2]
"""

TIMELINE = """- **1971** — US fusion funding peaks in the early programme, about $30M ($180.4M in 2024 dollars). [S1][S6]
- **April 2025** — ITER begins installing tokamak sector modules in the pit. [S4]
- **January 2025** — DOE announces $107M for six FIRE Collaboratives. [S1]
- **September 2025** — DOE announces $134M across FIRE and INFUSE. [S1]
- **2025** — Private fusion raises $2.2B in the year; cumulative 2021-2025 reaches nearly $9B (CRS survey). [S1]
- **February 27, 2026** — CRS publishes R48866, the policy briefing on commercial fusion. [S1]
- **June 2026** — DOE releases its Fusion Science and Technology Roadmap. [S2]
- **July 28, 2026** — ITER lowers the sixth sector module (~1,100 tonnes, 30-hour lift). [S4]
- **August 25, 2026** — Reuters reports the mid-2030s deployment strategy and industry's funding objection. [S2]
- **2027** — Final ITER sector module planned; the FES authorisation ceiling of $1.1B takes effect. [S4][S2]
"""

MIND_MAP = {
    "title": "Commercial fusion, 2026",
    "children": [
        {"label": "Money", "detail": "public flat, private record", "children": [
            {"label": "FES $790M FY2025", "detail": "21% to ITER"},
            {"label": "Private $4.48B", "detail": "12 months to Jul 2026"},
            {"label": "Cumulative $14.24B", "detail": "FIA, since 2021"},
            {"label": "Milestone $415M", "detail": "8 companies, 2022-27"},
        ]},
        {"label": "Machines", "detail": "assembly beats physics", "children": [
            {"label": "ITER 6 of 9 modules", "detail": "two-thirds of torus"},
            {"label": "30-hour lift", "detail": "~1,100 tonnes"},
            {"label": "Final module 2027"},
            {"label": "SPARC / private pilots", "detail": "compact high-field"},
        ]},
        {"label": "Engineering gaps", "children": [
            {"label": "Neutron-resistant materials"},
            {"label": "Tritium breeding blanket"},
            {"label": "Qualified supply chain"},
        ]},
        {"label": "Policy", "children": [
            {"label": "Roadmap: mid-2030s"},
            {"label": "Authorised $1.1B FY2027"},
            {"label": "Appropriated $790M"},
        ]},
        {"label": "Unknowns", "children": [
            {"label": "Levelised cost", "detail": "no defensible figure"},
            {"label": "Tritium inventory", "detail": "kilograms, civil"},
        ]},
    ],
}

FLASHCARDS = {"cards": [
    {"front": "What does ITER's 'six of nine' refer to?",
     "back": "Tokamak sector modules installed in the pit — two-thirds of the torus core, as of 28 July 2026.",
     "source": "ITER Organization"},
    {"front": "How much did private fusion raise in the year to July 2026?",
     "back": "$4.48B worldwide, with $14.24B cumulative since 2021 (Fusion Industry Association).",
     "source": "Reuters"},
    {"front": "What is the DOE FES budget for FY2025, and ITER's share?",
     "back": "$790M; about 21% of the FY2026 appropriation ($806M) is directed at ITER.",
     "source": "CRS R48866"},
    {"front": "Name the three engineering gaps the sources keep repeating.",
     "back": "Neutron-resistant structural materials, a tritium breeding blanket, and a supply chain able to qualify both at scale.",
     "source": "Reuters / CRS"},
    {"front": "Why is scientific breakeven not a power plant?",
     "back": "It compares fusion output to energy delivered on target, not to grid energy; a plant also needs thermal conversion, duty cycle and tritium self-sufficiency.",
     "source": "Fusion power (reference)"},
    {"front": "What does the Milestone programme pay for?",
     "back": "$415M over 2022-2027, reimbursing eight companies after pre-negotiated technical targets — payment on delivery, not grants.",
     "source": "Reuters"},
    {"front": "What does the CRS say about fusion's levelised cost?",
     "back": "That no defensible figure exists yet — any number quoted today is a projection.",
     "source": "CRS R48866"},
    {"front": "Where do the two funding trackers disagree?",
     "back": "CRS puts cumulative private investment at nearly $9B (2021-2025); FIA puts it at $14.24B. Different survey populations, same direction.",
     "source": "CRS / Reuters"},
]}

QUIZ = {"questions": [
    {"question": "Which body counts $4.48B of fusion investment in the twelve months to July 2026?",
     "choices": ["The IAEA", "The Fusion Industry Association", "The Congressional Research Service", "The DOE"],
     "answer": "The Fusion Industry Association",
     "explanation": "Reuters reports the FIA figure; the CRS runs its own, smaller, survey."},
    {"question": "How many ITER tokamak sector modules are installed as of the sources?",
     "choices": ["Four of nine", "Six of nine", "Eight of nine", "All nine"],
     "answer": "Six of nine",
     "explanation": "The sixth was lowered on 28 July 2026, two-thirds of the torus; the ninth is planned for 2027."},
    {"question": "What is the DOE fusion energy sciences budget for FY2025?",
     "choices": ["$415M", "$700M", "$790M", "$1.1B"],
     "answer": "$790M",
     "explanation": "$790M appropriated for FY2025, $806M for 2026; $1.1B is the FY2027 authorisation ceiling, not an appropriation."},
    {"question": "Which problem is NOT named as an open engineering gap in these sources?",
     "choices": ["Neutron-resistant structural materials", "Tritium breeding blankets", "Superconducting tape supply", "A qualified supply chain"],
     "answer": "Superconducting tape supply",
     "explanation": "The sources name materials, tritium and supply-chain qualification; HTS tape is discussed as an enabler, not a stated gap."},
    {"question": "What does the Reuters piece say the sector needs per year over the next decade?",
     "choices": ["$250M", "More than $1B", "$4.5B", "$14B"],
     "answer": "More than $1B",
     "explanation": "Industry's own number, against a $790M appropriation."},
]}

SLIDES = {"title": "Commercial fusion, 2026", "slides": [
    {"title": "Six sources, one question",
     "bullets": ["Does commercial fusion arrive on the mid-2030s schedule?",
                 "Public money flat, private money at a record",
                 "Assembly is ahead; the fuel cycle is not"],
     "note": "Set the frame: this is a funding story with an engineering tail."},
    {"title": "The money has changed hands",
     "bullets": ["FES: $790M in FY2025, $806M for 2026",
                 "Private: $4.48B in the year to July 2026",
                 "Cumulative since 2021: $14.24B (FIA)"],
     "note": "Note the tracker disagreement — nearly $9B on the CRS basis."},
    {"title": "ITER is assembling on pace",
     "bullets": ["Six of nine sector modules installed",
                 "~1,100-tonne module, 30-hour lift",
                 "Two-thirds of the torus; last module 2027"],
     "note": "Assembly pace improved; that is not the same as first plasma."},
    {"title": "Three gaps no schedule closes",
     "bullets": ["Neutron-resistant structural materials",
                 "A tritium breeding blanket at plant flux",
                 "A supply chain qualified to build either"],
     "note": "These are the items to watch in any diligence."},
    {"title": "What the sources refuse to say",
     "bullets": ["No defensible levelised cost — CRS is explicit",
                 "No consensus grid date beyond a policy target",
                 "No tritium budget for a commercial fleet"],
     "note": "Absence of a number is the finding."},
]}

INFOGRAPHIC = {
    "title": "Fusion 2026: the funding is private, the gaps are physical",
    "takeaway": "Assembly is ahead of plan; the fuel cycle is not on the plan at all.",
    "stats": [
        {"value": "$790M", "label": "US FES budget, FY2025", "detail": "about 21% to ITER"},
        {"value": "$4.48B", "label": "private fusion, 12 months", "detail": "to July 2026 (FIA)"},
        {"value": "6 / 9", "label": "ITER sector modules", "detail": "two-thirds of the torus, Jul 2026"},
        {"value": "2027", "label": "final module planned", "detail": "then first plasma campaign"},
    ],
    "quotes": [
        {"text": "Neutron-resistant materials and a tritium breeding blanket remain unsolved at plant scale.",
         "source": "Reuters, 25 Aug 2026"},
        {"text": "No defensible levelised cost figure exists yet.",
         "source": "CRS R48866"},
        {"text": "The 2022 authorisation of $1.1B for FY2027 is a ceiling, not an appropriation.",
         "source": "CRS R48866"},
    ],
}

AUDIO_SCRIPT = {"title": "Fusion 2026: money moved, physics didn't", "segments": [
    {"speaker": "host_a", "text": "Okay so I spent the week inside six documents about commercial fusion and I came out with one sentence: the money changed hands, and the physics did not notice."},
    {"speaker": "host_b", "text": "That's a good hook. Break it down, because 'money changed hands' sounds like a press release."},
    {"speaker": "host_a", "text": "Fair. The Congressional Research Service says the US fusion energy sciences budget was seven hundred ninety million dollars in fiscal 2025. Congress then appropriated about eight hundred six million for the next year."},
    {"speaker": "host_b", "text": "So roughly flat, with a rounding error of optimism."},
    {"speaker": "host_a", "text": "Exactly. And against that, the Fusion Industry Association counted four point four eight billion dollars of private investment in the twelve months to July 2026. Fourteen point two four billion cumulative since 2021."},
    {"speaker": "host_b", "text": "So the private sector is now outspending the public programme by a factor of five in a single year. That is the actual news."},
    {"speaker": "host_a", "text": "There is a catch though. The CRS runs its own survey and gets nearly nine billion cumulative for 2021 to 2025. Same direction, half the total. They are counting different things."},
    {"speaker": "host_b", "text": "Which is the sort of detail that decides whether a number is a fact or a slide."},
    {"speaker": "host_a", "text": "Now the machine. ITER lowered its sixth sector module into the pit on the twenty-eighth of July 2026. Roughly eleven hundred tonnes, a thirty hour lift, and two thirds of the torus is now in place."},
    {"speaker": "host_b", "text": "And that is ahead of schedule, right? I remember ITER being a synonym for delay."},
    {"speaker": "host_a", "text": "About six months ahead on this campaign. The ninth module is planned for 2027. What improved is the assembly process, not the plasma physics."},
    {"speaker": "host_b", "text": "So the part you can schedule got better. What about the part you can't?"},
    {"speaker": "host_a", "text": "Three things keep showing up. Structural materials that survive fourteen mega electron volt neutrons. A breeding blanket that makes its own tritium. And a supply chain that can qualify either one at scale."},
    {"speaker": "host_b", "text": "And tritium is the quiet killer, isn't it? Civil inventory is measured in kilograms."},
    {"speaker": "host_a", "text": "Right. Deuterium is seawater. Tritium you have to breed, in the blanket you have not built yet."},
    {"speaker": "host_b", "text": "So when the roadmap says mid twenty thirties, what is it actually promising?"},
    {"speaker": "host_a", "text": "Pilot plants. And industry's own number for what that costs is more than a billion dollars a year for a decade. Congress appropriated seven hundred ninety million."},
    {"speaker": "host_b", "text": "There's the gap, in two numbers."},
    {"speaker": "host_a", "text": "And the cleanest finding in the whole set: the CRS says no defensible levelised cost figure exists yet. So anyone quoting you a price per megawatt hour is quoting a projection."},
    {"speaker": "host_b", "text": "Three takeaways then?"},
    {"speaker": "host_a", "text": "One: private capital now sets the pace. Two: ITER's assembly is genuinely ahead, and that is an engineering win, not a commercial one. Three: materials, tritium and supply chain are unsolved and they are not on anyone's schedule."},
    {"speaker": "host_b", "text": "And the thing to watch next is the 2027 appropriation, because the authorisation ceiling is a billion one and the cheque keeps coming in smaller."},
    {"speaker": "host_a", "text": "That's the episode. Sources are in the notebook, citations on every claim."},
]}

VIDEO_SCRIPT = {"title": "Fusion 2026 — where the money went", "segments": [
    {"headline": "Six sources, one question", "palette": "indigo",
     "text": "Does commercial fusion arrive on the mid-2030s schedule? Six documents: a CRS briefing for Congress, the DOE roadmap as reported by Reuters, two ITER releases, the IAEA outlook and the reference article."},
    {"headline": "$790M public. $4.48B private.", "palette": "ember",
     "text": "Fusion energy sciences got seven hundred ninety million dollars in fiscal 2025. In the twelve months to July 2026, private companies raised four point four eight billion. Cumulative private investment since 2021 is fourteen point two four billion."},
    {"headline": "Two trackers, two totals", "palette": "mono",
     "text": "The Congressional Research Service counts nearly nine billion for 2021 to 2025. The Fusion Industry Association counts fourteen point two four. Same direction, different populations."},
    {"headline": "ITER: two-thirds assembled", "palette": "forest",
     "text": "The sixth of nine tokamak sector modules went into the pit on 28 July 2026: eleven hundred tonnes, a thirty-hour lift, six months ahead of plan. The ninth module is scheduled for 2027."},
    {"headline": "Three gaps no schedule closes", "palette": "indigo",
     "text": "Neutron-resistant structural materials. A tritium breeding blanket that works at plant flux. A supply chain qualified to build either. None of these is a physics question with a date attached."},
    {"headline": "The number nobody will defend", "palette": "ember",
     "text": "Levelised cost. The CRS is explicit that no defensible figure exists yet. Industry says the programme needs more than a billion dollars a year for a decade; Congress appropriated seven hundred ninety million."},
]}


def install_authored() -> None:
    # llmio.complete/structured are the *wrappers*: they return str / parsed.
    def complete(messages, *, purpose="", **kw):
        import json as _json
        kind = purpose.rsplit(".", 1)[-1]
        if "audio" in purpose:
            return _json.dumps(AUDIO_SCRIPT)
        return {"summary": SUMMARY, "briefing_doc": BRIEFING, "study_guide": STUDY,
                "faq": FAQ, "timeline": TIMELINE}.get(kind, "")

    def structured(*, instructions="", input=None, json_schema=None, schema_name="", **kw):
        name = schema_name or ""
        if "mind_map" in name:
            return MIND_MAP
        if "flashcards" in name:
            return FLASHCARDS
        if "quiz" in name:
            return QUIZ
        if "slides" in name:
            return SLIDES
        if "infographic" in name:
            return INFOGRAPHIC
        if "audio" in name or "podcast" in name:
            return AUDIO_SCRIPT
        if "video" in name:
            return VIDEO_SCRIPT
        return None

    llmio.complete = complete
    llmio.structured = structured


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--notebook", required=True)
    ap.add_argument("--kinds", default="summary,briefing_doc,study_guide,faq,timeline,"
                                       "mind_map,flashcards,quiz,slides,infographic,"
                                       "audio_overview,video_overview")
    ap.add_argument("--no-labels", action="store_true")
    args = ap.parse_args()

    nb = store.resolve_notebook(args.notebook)
    if not args.no_labels:
        for sid, (labels, summary) in LABELS.items():
            try:
                store.update_source(nb, sid, labels=labels, summary=summary)
                print(f"label {sid}: {labels}")
            except KeyError as exc:
                print(f"label {sid}: {exc}")

    install_authored()
    for kind in [k.strip() for k in args.kinds.split(",") if k.strip()]:
        try:
            if kind == "audio_overview":
                out = asyncio.run(audio.make_audio_overview(nb, length="short"))
            elif kind == "video_overview":
                out = asyncio.run(video.make_video_overview(nb, length="short", style="cinematic"))
            else:
                out = artifacts.generate(nb, kind)
            made = out.get("path") or out.get("json") or out.get("audio") or out.get("video")
            print(f"OK   {kind}: {Path(str(made)).name}")
        except Exception as exc:
            print(f"FAIL {kind}: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    main()
