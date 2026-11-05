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


def test_build_cards_list_writes_concat_file(tmp_path):
    pytest.importorskip("PIL")
    segs = [{"text": "narration one " * 5, "headline": "One", "palette": "indigo"},
            {"text": "narration two " * 5, "headline": "Two", "palette": "mono"}]
    durs = [3.2, 4.1]
    lst = video._build_cards_list(tmp_path, segs, durs, "NB", "Ep", ["Src1", "Src2"])
    text = lst.read_text()
    assert "card_000.png" in text and "card_003.png" in text
    assert "duration 3.200" in text and "duration 4.000" in text  # end card tail
    assert text.count("file '") >= 5  # 4 entries + last-file repeat
    # every referenced image exists
    import re
    for m in re.finditer(r"file '([^']+)'", text):
        assert (tmp_path / m.group(1).split("/")[-1]).exists() or __import__("pathlib").Path(m.group(1)).exists()


def test_palettes_all_render(tmp_path):
    pytest.importorskip("PIL")
    for pal in video.PALETTES:
        p = tmp_path / f"{pal}.png"
        video._render_card(p, kind="beat", headline="H", palette=pal)
        assert p.exists()
