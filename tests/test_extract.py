"""Extraction: format detection, HTML→text, SSRF guard, caps."""

import pytest

from hermes_notebook import extract


def test_kind_for_path_matrix(tmp_path):
    cases = {
        "a.pdf": "pdf", "b.docx": "docx", "c.pptx": "pptx", "d.xlsx": "xlsx",
        "e.epub": "epub", "f.ipynb": "ipynb", "g.png": "image",
        "h.txt": "text", "i.md": "text", "j.py": "text", "k": "text",
        "l.bin": "unknown", "m.doc": "unknown",
    }
    for name, want in cases.items():
        assert extract.kind_for_path(tmp_path / name) == want, name


def test_extract_text_file(tmp_path):
    p = tmp_path / "note.md"
    p.write_text("# Hello\n\nSome **markdown** text.")
    kind, text = extract.extract_file(p)
    assert kind == "text" and "markdown" in text


def test_extract_unknown_raises(tmp_path):
    p = tmp_path / "blob.bin"
    p.write_text("binary-ish")
    with pytest.raises(extract.ExtractionError):
        extract.extract_file(p)


def test_html_to_text_strips_scripts_and_tags():
    html = """<html><head><style>x{}</style><script>evil()</script></head>
    <body><h1>Title</h1><p>Hello <b>world</b></p><ul><li>one</li><li>two</li></ul></body></html>"""
    text = extract.html_to_text(html)
    assert "Title" in text and "Hello" in text and "one" in text
    assert "evil" not in text and "<p>" not in text


def test_cap_truncates_huge_text():
    big = "x" * (extract.MAX_EXTRACT_CHARS + 1000)
    out = extract._cap(big)
    assert len(out) < extract.MAX_EXTRACT_CHARS + 200
    assert "omitted" in out


def test_assert_public_url_blocks_local_and_private():
    for bad in ["http://localhost/x", "http://127.0.0.1/x", "http://169.254.169.254/latest",
                "http://10.0.0.5/internal", "http://[::1]/x", "file:///etc/passwd", "ftp://x"]:
        with pytest.raises(extract.ExtractionError):
            extract.assert_public_url(bad)


def test_ipynb_extract(tmp_path):
    import json
    p = tmp_path / "nb.ipynb"
    p.write_text(json.dumps({"cells": [
        {"cell_type": "markdown", "source": ["# Title\n", "intro text"], "metadata": {}, "outputs": []},
        {"cell_type": "code", "source": ["print(1)"], "metadata": {},
         "outputs": [{"output_type": "stream", "name": "stdout", "text": ["1\n"]}],
         "execution_count": 1},
    ], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}))
    kind, text = extract.extract_file(p)
    assert kind == "ipynb"
    assert "intro text" in text and "print(1)" in text and "1" in text
