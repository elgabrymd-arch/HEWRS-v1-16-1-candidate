#!/usr/bin/env python3
"""Build a controlled, additive Stage 10 preference-persistence overlay.

Preserves the historical Stage 10 bundle's owner-feedback modules and applies
only the already-reviewed src/application.js preference-storage changes.
Does not publish, merge, remove files, or read browser storage.
"""
from __future__ import annotations
import base64
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/application.js"
ENTRY = ROOT / "stage10-integration.html"
DIST = ROOT / "dist/stage10-home-preferences"
MARKER = "/* SOURCE: src/application.js */\n"
NEW_KEY = "hewrs:home-preferences:v1:"

def digest(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()

def replace_once(text: str, old: str, new: str, context: str) -> str:
    found = text.count(old)
    if found != 1:
        raise ValueError(f"{context}: expected 1 match, found {found}")
    return text.replace(old, new, 1)

def extracted_fixed_segment(source: str, start: str, end: str) -> str:
    a = source.index(start)
    b = source.index(end, a)
    return source[a:b]

def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    html = ENTRY.read_text(encoding="utf-8")
    tag_re = re.compile(
        r'<script defer src="(runtime/hewrs-[0-9a-f]{20}\.js)" '
        r'integrity="sha256-([A-Za-z0-9+/=]+)"></script>'
    )
    matches = list(tag_re.finditer(html))
    if len(matches) != 1:
        raise ValueError(f"Expected one Stage 10 runtime script, found {len(matches)}")
    match = matches[0]
    old_path = match.group(1)
    old_bytes = (ROOT / old_path).read_bytes()
    old_sha = digest(old_bytes)
    if base64.b64encode(bytes.fromhex(old_sha)).decode() != match.group(2):
        raise ValueError("Stage 10 runtime does not match its published integrity attribute")
    original = old_bytes.decode("utf-8")
    if original.count(MARKER) != 1:
        raise ValueError("Stage 10 application module marker not unique")
    start = original.index(MARKER) + len(MARKER)
    end = original.index("\n;\n", start)
    stage_app = original[start:end]
    if "HEWRS_COMBINED_V1_25_0_R1_STAGE10" not in stage_app:
        raise ValueError("This is not the expected Stage 10 application")
    if "connection.ownerFeedback.set(ownerFeedback)" not in stage_app:
        raise ValueError("Owner feedback integration missing; refusing to replace runtime")
    if NEW_KEY in stage_app:
        raise ValueError("Stage 10 runtime is already patched")

    anchor = ("const store=root.HEWRSLocalState.create(connection,root.HEWRS_INPUT_SHA256,backend),"
              "ui=root.HEWRSFaceliftModel.create(connection),urlCache=new Map();")
    new_block = extracted_fixed_segment(
        source, "// Home category choices have their own versioned, source-locked storage.",
        "function resolveUrl(d)"
    )
    if NEW_KEY not in new_block or "function persistHomePreferences()" not in new_block:
        raise ValueError("Reviewed source persistence implementation not available")
    patched = replace_once(stage_app, anchor, anchor + "\n" + new_block.rstrip("\n"),
                           "Insert isolated Home preference storage")

    old_status = ("function status(text,error=false){$('status').textContent=text;"
                  "$('home-notice').textContent=text;$('home-notice').dataset.error=String(error);}")
    new_status = next(line for line in source.splitlines() if line.startswith("function status(text,error=false)"))
    patched = replace_once(patched, old_status, new_status, "Preserve storage warning")

    old_apply = "ui.commit();dismissSheet(false);if(before!==JSON.stringify(ui.snapshot()))"
    new_apply = "ui.commit();persistHomePreferences();dismissSheet(false);if(before!==JSON.stringify(ui.snapshot()))"
    if new_apply not in source:
        raise ValueError("Source does not persist picker Apply")
    patched = replace_once(patched, old_apply, new_apply, "Persist committed picker selection")

    old_reset = "ui.reset();producing=null;dismissSheet(false);"
    new_reset = "ui.reset();persistHomePreferences();producing=null;dismissSheet(false);"
    if new_reset not in source:
        raise ValueError("Source does not persist Reset")
    patched = replace_once(patched, old_reset, new_reset, "Persist explicit Reset")

    old_boot = "if(saved?.mode==='anchor')ui.fromSelection(saved.selection);else ui.reset();setMode(mode);"
    new_boot = ("if(!restoreHomePreferences()){if(saved?.mode==='anchor'&&!homePreferenceStorageBlocked)"
                "ui.fromSelection(saved.selection);else ui.reset();}setMode(mode);")
    if new_boot not in source:
        raise ValueError("Source does not include reviewed restore behavior")
    patched = replace_once(patched, old_boot, new_boot, "Restore Home preferences on boot")

    old_ready = ("status(saved?'Ready. Your saved outfit is available under View current outfit.':"
                 "'Ready. Choose preferences or Generate Options.');showPage('home');")
    new_ready = ("status(homePreferenceStorageWarning|| (saved?'Ready. Your saved outfit is available under View current outfit.':"
                 "'Ready. Choose preferences or Generate Options.'),!!homePreferenceStorageWarning);showPage('home');")
    if new_ready not in source:
        raise ValueError("Source does not include reviewed startup warning")
    patched = replace_once(patched, old_ready, new_ready, "Show Home restoration warning")

    if patched.count(NEW_KEY) != 1:
        raise ValueError("Expected exactly one persisted preference key")
    if "connection.ownerFeedback.set(ownerFeedback)" not in patched:
        raise ValueError("Owner feedback initialization was lost")
    if stage_app == patched:
        raise ValueError("No Stage 10 correction applied")
    result = (original[:start] + patched + original[end:]).encode("utf-8")
    new_sha = digest(result)
    new_file = f"runtime/hewrs-{new_sha[:20]}.js"
    new_sri = base64.b64encode(bytes.fromhex(new_sha)).decode()
    new_tag = f'<script defer src="{new_file}" integrity="sha256-{new_sri}"></script>'
    new_html = html[:match.start()] + new_tag + html[match.end():]
    if len(new_html.split("hewrs-stage10-integration-panel.js")) != 2:
        raise ValueError("Stage 10 integration panel binding unexpectedly changed")
    if len(new_html.split("feedback-candidate/reviewed/automatic-image-panel.js")) != 2:
        raise ValueError("Stage 10 image integration binding unexpectedly changed")

    # Preserve all original non-application modules, in byte-identical order.
    if original[:start] != result[:start].decode("utf-8") or original[end:] != result[len((original[:start] + patched).encode("utf-8")):].decode("utf-8"):
        raise ValueError("Non-application runtime bytes were altered")
    if new_sha == old_sha:
        raise ValueError("New runtime must differ from baseline")

    (DIST / "runtime").mkdir(parents=True, exist_ok=True)
    (DIST / new_file).write_bytes(result)
    (DIST / ENTRY.name).write_text(new_html, encoding="utf-8")
    # The test preview is a separate local-only filename. Never overwrite the user's live page.
    (ROOT / "stage10-home-preferences-test.html").write_text(new_html, encoding="utf-8")
    (ROOT / new_file).write_bytes(result)
    manifest = {
        "schema": "hewrs.stage10-home-preferences-overlay.v1",
        "entrypoint": ENTRY.name,
        "source_module": "src/application.js",
        "prior_runtime": {"path": old_path, "sha256": old_sha},
        "replacement_runtime": {"path": new_file, "sha256": new_sha,
                                "integrity": "sha256-" + new_sri},
        "entrypoint_sha256": digest(new_html.encode("utf-8")),
        "other_modules_preserved_byte_identical": True,
        "owner_feedback_preserved": True,
        "additional_stage10_scripts_preserved": True,
        "wear_and_favorites_storage_unchanged": True,
        "not_published": True,
        "installation": "Overlay these two files over an existing complete HEWRS tree; do not delete any other files"
    }
    (DIST / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (DIST / "READ_FIRST.txt").write_text(
        "HEWRS Stage 10 Home preference persistence — controlled overlay\n\n"
        "Only two application files are to be installed:\n"
        "  1. stage10-integration.html\n"
        f"  2. {new_file}\n\n"
        "All other existing assets, index files, Stage 10 panels, preference/history\n"
        "records, Favorites and wardrobes remain untouched. Do not delete or\n"
        "replace other files. Do not clear browser storage.\n\n"
        "This archive is an incremental overlay, not a standalone HEWRS app.\n"
        "The GitHub test workflow produces it without deploying to GitHub Pages.\n"
        "Review MANIFEST.json and verify the live baseline before applying.\n",
        encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    main()
