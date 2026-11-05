"""Audio script normalization + artifact renderers (no TTS/ffmpeg needed)."""

import json

from hermes_notebook import artifacts, audio


def test_write_script_normalizes_speakers_and_drops_junk():
    script = {"title": "Ep 1", "segments": [
        {"speaker": "Alex", "text": "Welcome to the show."},
        {"speaker": "Sam", "text": "Great to be here."},
        {"speaker": "narrator", "text": "  "},          # too short → dropped
        {"speaker": "host_b", "text": "Let's dive in."},
        {"speaker": "???", "text": "Hmm."},               # unknown → alternates
        "not-a-dict",
    ]}
    segs, title = audio._write_script("nb", script)
    assert title == "Ep 1"
    assert all(set(s) == {"speaker", "text"} for s in segs)
    assert segs[0]["speaker"] == "host_a"   # Alex → host_a
    assert segs[1]["speaker"] == "host_b"   # Sam → host_b
    assert all(len(s["text"]) >= 3 for s in segs)
    speakers = {s["speaker"] for s in segs}
    assert speakers <= {"host_a", "host_b"}


def test_write_script_empty_raises():
    import pytest
    with pytest.raises(RuntimeError):
        audio._write_script("nb", {"segments": []})


def test_render_mind_map_nested_and_mermaid():
    data = {"title": "ML", "children": [
        {"label": "Supervised", "detail": "labels known",
         "children": [{"label": "Regression"}, {"label": "Classification"}]},
        {"label": "Unsupervised"},
    ]}
    md = artifacts._render_mind_map(data)
    assert "Supervised" in md and "Regression" in md
    assert "```mermaid" in md and "mindmap" in md
    assert "root((ML))" in md


def test_render_flashcards():
    data = {"cards": [{"front": "Q?", "back": "A.", "source": "Paper"},
                      {"front": "Q2?", "back": "A2."}]}
    md = artifacts._render_flashcards(data)
    assert "**Q:** Q?" in md and "**A:** A." in md and "Paper" in md
    assert "2 cards" in md


def test_render_quiz_with_choices():
    data = {"questions": [{"question": "Capital of France?",
                           "choices": ["Paris", "London", "Berlin", "Rome"],
                           "answer": "A", "explanation": "It's Paris."}]}
    md = artifacts._render_quiz(data)
    assert "Q1. Capital of France?" in md
    assert "A. Paris" in md and "**Answer:** A" in md


def test_kind_lists_cover_manifest():
    assert set(artifacts.ALL_KINDS) == set(artifacts.MD_KINDS) | set(artifacts.STRUCT_KINDS)
    assert "mind_map" in artifacts.ALL_KINDS
