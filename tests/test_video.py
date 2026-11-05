"""Video overview: script normalization, card rendering, concat list — no TTS/ffmpeg."""

import pytest

from hermes_notebook import video


def test_write_video_script_normalizes():
    parsed = {"title": "Ep", "segments": [
        {"text": "  The   cell's   power plant.  ", "headline": "Mitochondria",
         "palette": "forest"},
        {"text": "x" * 5, "headline": "too short"},          # dropped
        {"text": "A real narration beat about revolutions.", "headline": "",
         "palette": "bogus"},                              # palette → indigo
        "junk",
    ]}
    segs, title = video._write_video_script(parsed)
    assert title == "Ep"
    assert len(segs) == 2
    assert segs[0]["palette"] == "forest"
    assert segs[0]["headline"] == "Mitochondria"
    assert segs[1]["palette"] == "indigo" and segs[1]["headline"] == "…"
    assert all(set(s) == {"text", "headline", "palette"} for s in segs)


def test_write_video_script_empty_raises():
    with pytest.raises(RuntimeError):
        video._write_video_script({"segments": []})


def test_render_beat_card_produces_png(tmp_path):
    pytest.importorskip("PIL")
    out = tmp_path / "card.png"
    video._render_card(out, kind="beat", headline="Test Headline",
                       sub="a subtitle line", palette="ember",
                       notebook_title="My Notebook", index=2, total=10)
    assert out.exists() and out.stat().st_size > 5000
    from PIL import Image
    im = Image.open(out)
    assert im.size == (video.CARD_W, video.CARD_H)


def test_render_title_and_end_cards(tmp_path):
    pytest.importorskip("PIL")
    t = tmp_path / "t.png"
    video._render_card(t, kind="title", ep_title="Big Story", notebook_title="NB")
    e = tmp_path / "e.png"
    video._render_card(e, kind="end", sources=["Paper A", "Paper B"])
    assert t.stat().st_size > 5000 and e.stat().st_size > 5000


def test_plan_cards_aligns_one_to_one(tmp_path):
    pytest.importorskip("PIL")
    segs = [{"text": "narration zero " * 5, "headline": "Zero", "palette": "indigo"},
            {"text": "narration one " * 5, "headline": "One", "palette": "mono"},
            {"text": "narration two " * 5, "headline": "Two", "palette": "ember"}]
    cards = video._plan_cards(tmp_path, segs, "NB", "Ep", ["Src1", "Src2"])
    # N segments → N narration-aligned cards + 1 end card
    assert len(cards) == len(segs) + 1
    assert cards[0][1] == 0 and cards[0][2] == "title"     # seg0 rides title card
    assert [c[1] for c in cards[1:-1]] == [1, 2]           # beats 1..N-1
    assert cards[-1][1] == -1 and cards[-1][2] == "end"
    for png, _i, _k in cards:
        assert png.exists() and png.stat().st_size > 5000


def test_palettes_all_render(tmp_path):
    pytest.importorskip("PIL")
    for pal in video.PALETTES:
        p = tmp_path / f"{pal}.png"
        video._render_card(p, kind="beat", headline="H", palette=pal)
        assert p.exists()


def test_video_script_prompt_styles():
    from hermes_notebook import video
    base = {"title": "T", "description": ""}
    cine = video._video_script_prompt(base, "digest", "short", "", "cinematic")
    expl = video._video_script_prompt(base, "digest", "short", "", "explainer")
    assert "CINEMATIC" in cine and "QUICK EXPLAINER" in expl
    assert cine != expl
    # unknown style falls back to cinematic inside make_video_overview
    assert video.STYLES == ("cinematic", "explainer")
