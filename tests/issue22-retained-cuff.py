#!/usr/bin/env python3
"""Run the complete historical cuff contract in bounded native processes.

The full source proof runs once without a mode filter. Existing diagnostic
render branches then run in fresh processes, including the S03 source-order
and B02 cache/restoration branches. A partial child result is never accepted
as the release gate: exact source, render, literal-control and bypass sets
must all be complete before this parent emits PASS.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time


ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "tests/issue19-cuff-underlay.cjs"
ORIGINAL_TEST_SHA = "a8f40161ff82bc8656c4f204ace4986248ff16cde2fc69435bc4920fb9549cfd"
PINNED_FILES = {
    "tests/issue19-cuff-underlay.cjs": "e02d8ed71a35a41079bec67d85368d0d25f045809157b9aa39da765ef367c135",
    "tests/issue19-cuff-underlay-fixtures.json": "309f4f83473efb130fa3090a136ab3a7859c2c9701727c567e643a1f37a1f655",
    "tests/issue19-cuff-quantized-source-fixtures.json": "807d47e5fdf489489809fdf20502fa2d741639b521ff599ec913801e9bd9ff08",
    "tests/issue22-retained-source-baseline.cjs": "41f0d1ae4d2a615252e374300702e22262b614d091ca89c3afa3e10161db6477",
    "release/issue19/CUFF_QUANTIZED_SOURCE_AUDIT.json": "f76a0e3c3962162993f37568742991e7405e16d73ad53877dc1bb0707ea33ee9",
}
MODES = [f"S{i:02}" for i in range(1, 19)] + [f"B{i:02}" for i in range(1, 16)]
CACHE_LABELS = [
    "B02-pants-cache-original", "B02-pants-cache-brown",
    "B02-pants-cache-navy-eviction", "B02-pants-cache-restored",
]
S03_LABELS = ["S03-literal194", "S03-legacy-source-order"]
EXPECTED_LABELS = [mode + "-continuous" for mode in MODES] + S03_LABELS + CACHE_LABELS
# Literal source identities from the unchanged approved assembly/pant registry.
# Default garment modes alone cover only 20 of these 27 source hashes.
EXPECTED_SOURCES = set("""
13c352dcf6b1fbd33579683464b0665c005d7c18c7693bddf6640f4b7d90569b
286e71eaa35cca93e72215a9c6e6dd6ae29b382eecc9cc1f45b8ecac85d3ea21
342e872251fe8552c50003c7c451c8141e296ff5b1d09b814d982d192313bf9b
3889f11eb9a64e82df3feebba32b080b6e6891402bc6784774191fe697f44ec1
3d72be288401ef234e82574a092ade35c5600c3d518033084a0f58a00328941f
446e51ff4b184e0e5dc5e00678cbebd6bc92801e96cfd17ade0285fea308a4fb
50cd806ebcd5f91c84952b8b442fa3b5924976238fa5680b7d7bf057c7805125
52c24cdff50ccf3dddba6b226e53c24f0ed8d0bc0617a3c019d9b6fa097859c9
5497c5345fbce1527ba9ff8df5f6d6c98eb73264c2873e3fcfd9a81b9226b724
6a01018fb5b5bf215fea32495a3279885cc814fc75c9162928808db5c073ac9f
6c8f9d688a7a7f80977d2421d9590487d6d8241c520a99a66f85b85931f56036
6d5b3fe8dc1598129f0cfeb57d54624fd62b0bf942740ec780f339e20a4fdc49
7060c35c50269365298dc756ee96bd965e2b33a13ef4899967fccc1c08a8af89
7c4c2ed4925cb12f9c54fabae0f430a6746738a9c8045588641b60f30a34b13f
9213ab289d4751b83ef772849ab567d0ee99a3ead980acbf2b229c910633aed2
9e4993016379331dea117fe35bbc3e902e2c19b48fce51aefefbeff2b52df57b
a8135969ff9497dc1ca2537f6056da93dc048e1bdea3eb10992200f1eac661bd
a9738332853c28ba986e1d7baa34a7f242d70cd43bea5c4b734cd22f9cb782db
aea4f48752eb664abf5a6b7c327585e097dc539f37835f30a46890812e855861
b70676b6b10186285d653b0d8e03e24247a9004afba9bdcae2550558fafb24d2
c03a0a7bd871255b9938cc821c11b34b1c2496c7da77276f292ae7a1f8bf4739
c377dc38c99f0abcd71298345b84751cddbb4d2371c3e523147ef92b7a5ada01
c455c80d18d6afc4bf5d1a2764e24bb223ea54e3d486895b97d0c8c821d87c2b
c5dab4db1db4b6b64e73fd0bc468fa8b234b5f74abb4a797f5a7b4fd1fb8f53f
e295a0cec6c5d430e27f2be4959c7ca405ae5a4b476be5859f4e5ff303ceb4c3
ed8dc4d60dc595d27d6f9b1466b7a3fa3fd8e247a801362a36fd9f8879e5685e
f5682b9913ea203ce1d75dce767cc21bee00f16fd5bf23bcb12578b2e49ecd7b
""".split())
ZERO_PROOF_FIELDS = ["raw_avatar_overlap", "posed_avatar_overlap", "posed_shoe_overlap",
                     "legacy_difference", "continuous_difference"]
ZERO_RENDER_FIELDS = ["outside_bounds_changed", "old_opaque_foreground_changed",
                      "original_pants_coverage_lost", "pure_underlay_wrong",
                      "no_pants_foreground_changed", "opaque_hand_pixels_changed",
                      "seam_source_wrong", "frozen_domain_bad_source"]


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_json(filename, value):
    filename.write_text(json.dumps(value, indent=2) + "\n")


def verify_source_pins():
    for filename, expected in PINNED_FILES.items():
        require(digest((ROOT / filename).read_bytes()) == expected, f"Pinned oracle changed: {filename}")
    original = TEST.read_bytes()
    for marker in ("SOURCE_SCOPE_ONLY", "SHIRT_ONLY_EVIDENCE"):
        pattern = (rb" +// ISSUE22_" + marker.encode() + rb"_BEGIN\n.*? +// ISSUE22_"
                   + marker.encode() + rb"_END\n")
        original, count = re.subn(pattern, b"", original, flags=re.S)
        require(count == 1, f"Exactly one additive diagnostic block: {marker}")
    require(digest(original) == ORIGINAL_TEST_SHA,
            "Removing only the two additive diagnostics restores every original test byte")


def parse_lines(stdout, prefix):
    return [json.loads(line[len(prefix):]) for line in stdout.splitlines() if line.startswith(prefix)]


def one(stdout, prefix):
    records = parse_lines(stdout, prefix)
    require(len(records) == 1, f"Exactly one completed {prefix} record is required")
    return records[0]


def run_child(node, output, name, arguments):
    """Use wait4 for the child's actual peak RSS, not a cumulative parent value."""
    command = [node, "--expose-gc", str(TEST), *arguments]
    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--require=./tests/issue22-retained-source-baseline.cjs"
    started = time.monotonic()
    stdout_path, stderr_path = output / f"{name}.log", output / f"{name}.stderr"
    timed_out = False
    with stdout_path.open("w") as stdout_file, stderr_path.open("w") as stderr_file:
        child = subprocess.Popen(command, cwd=ROOT, env=env, stdout=stdout_file, stderr=stderr_file)
        while True:
            pid, status, usage = os.wait4(child.pid, os.WNOHANG)
            if pid:
                break
            if time.monotonic() - started > 180:
                timed_out = True
                child.kill()
                _, status, usage = os.wait4(child.pid, 0)
                break
            time.sleep(0.1)
        child.returncode = os.waitstatus_to_exitcode(status)
    resources = {"name": name, "arguments": arguments, "returncode": child.returncode,
                 "timed_out": timed_out, "elapsed_seconds": round(time.monotonic() - started, 3),
                 "peak_rss_kib": usage.ru_maxrss, "stdout": stdout_path.name, "stderr": stderr_path.name}
    write_json(output / f"{name}.resources.json", resources)
    require(not timed_out and child.returncode == 0,
            f"Historical cuff child {name} failed; inspect {stdout_path} and {stderr_path}: {resources}")
    require(resources["peak_rss_kib"] > 0, "Linux wait4 must report measured native child peak RSS")
    return stdout_path.read_text(), resources


def validate_identity(stdout, summary, quantized):
    header = one(stdout, "ISSUE22_HISTORICAL_CONTRACT=")
    require(header["test"] == TEST.name and header["current_issue22_validation"] is False,
            "Every child must explicitly identify the retained historical contract")
    require(header["entrypoint"] == "avatar-v3-issue22-baseline.html", "Exact historical entrypoint")
    require(header["runtime_sha256"] == quantized["candidate_runtime_sha256"], "Exact header runtime")
    for key in ("runtime_sha256", "baseline_runtime_sha256", "rejected_runtime_sha256"):
        expected = quantized["candidate_runtime_sha256" if key == "runtime_sha256" else key]
        require(summary[key] == expected, f"Every child retains the original {key}")
    require(summary["checks"] > 0 and summary["original_source_files"] > 0,
            "Completed original assertions and source-byte integrity checks")


def validate_proof(proof):
    require(proof["sources"] == len(proof["records"]), "Exact source proof count")
    hashes = [row["source_sha256"] for row in proof["records"]]
    require(len(set(hashes)) == len(hashes), "No duplicated source may replace another original source")
    require(set(hashes) <= EXPECTED_SOURCES, "Source proof must contain only approved source identities")
    for row in proof["records"]:
        require(all(row[key] == 0 for key in ZERO_PROOF_FIELDS), "All original source-order/overlap assertions")
        require(row["covered_pixels"] > 26000 and row["opaque_pixels"] > 24000,
                "Non-vacuous original source coverage")
    return {row["source_sha256"]: row for row in proof["records"]}


def validate_records(records, expected_labels, corridors, quantized):
    labels = [row["label"] for row in records]
    require(len(labels) == len(set(labels)), "No duplicate render may replace an omitted case")
    require(sorted(labels) == sorted(expected_labels), "Exact complete assigned render label set")
    for row in records:
        mode = row["selection"].get("suitId") or row["selection"].get("blazerId")
        require(mode in MODES and row["label"].startswith(mode + "-"), "Record belongs to its actual garment")
        require(row["original_pants_sha256"] in EXPECTED_SOURCES, "Rendered trousers have full source proof")
        require(all(row[key] == 0 for key in ZERO_RENDER_FIELDS), "Every original preservation oracle passed")
        require(row["seam_source_pixels"] == corridors[mode]["source_owned_interior_pixels"],
                "Every garment retains its complete frozen seam domain")
        require(row["old_opaque_foreground_pixels"] > 40000 and row["opaque_hand_pixels"] > 5000,
                "Non-vacuous original foreground and hand controls")
        require(row["original_pants_opaque_pixels"] > 24000 and row["transparent_exterior_pixels"] > 10000,
                "Non-vacuous original trouser and exterior controls")
        controls = [control for control in quantized["controls"] if control["mode"] == mode]
        observed = row["quantized_source_over_records"]
        require(row["quantized_original_source_controls"] == len(controls) == len(observed),
                "Every literal source-over control is represented")
        require(sorted(tuple(item["xy"]) for item in observed) == sorted(tuple(item["xy"]) for item in controls),
                "Exact literal source-over point set")
        for item in observed:
            original = next(control for control in controls if control["xy"] == item["xy"])
            require(item["original_jacket_sha256"] == original["source_hashes"]["jacket"], "Original control jacket")
            require(item["rejected_raw_fitted_rgba"] == original["rejected_raw_fitted_rgba"], "Original rejected foreground")
            require(item["original_raw_hands_rgba"] == original["original_raw_hands_rgba"], "Original hand controls")
            require(item["original_pants_alpha"] == original["original_raw_pants_rgba"][3], "Original trouser alpha")
            require(item["actual_rgba"] == item["expected_rgba"], "Exact original-source RGBA composition")


def main(output):
    output.mkdir(parents=True, exist_ok=True)
    verify_source_pins()
    node = shutil.which("node")
    require(node is not None, "Node is required for the original native cuff test")
    fixture = json.loads((ROOT / "tests/issue19-cuff-underlay-fixtures.json").read_text())
    quantized = json.loads((ROOT / "tests/issue19-cuff-quantized-source-fixtures.json").read_text())
    corridors = {row["mode"]: row for row in fixture["frozen_seam_corridors"]["records"]}
    require(set(corridors) == set(MODES) and len(corridors) == 33, "Exact complete original garment inventory")
    require(len(EXPECTED_SOURCES) == 27 and len(EXPECTED_LABELS) == 39, "Complete explicit coverage inventory")
    workers, records, bypasses = [], [], []
    started = time.monotonic()
    stdout, resources = run_child(node, output, "00-full-source-scope", ["--source-scope-only"])
    source_summary = one(stdout, "ISSUE19_CUFF_SOURCE_SCOPE_ONLY=")
    validate_identity(stdout, source_summary, quantized)
    require(source_summary["status"] == "PASS_SOURCE_SCOPE_ONLY_NOT_RELEASE_GATE", "Source-only result remains partial")
    require(not parse_lines(stdout, "ISSUE19_CUFF_UNDERLAY=") and not parse_lines(stdout, "CUFF_UNDERLAY_CASE="),
            "Source-only child cannot masquerade as a completed render contract")
    source_proof = one(stdout, "CUFF_UNDERLAY_SOURCE_SCOPE=")
    full_proof = validate_proof(source_proof)
    require(set(full_proof) == EXPECTED_SOURCES and source_summary["source_scope_records"] == 27,
            "All 27 original sources, including seven omitted by default-mode subsets, must be proven")
    require(source_summary["proof"] == source_proof["records"], "Full final source proof equals actual executed proof")
    workers.append({**resources, "status": source_summary["status"], "checks": source_summary["checks"],
                    "source_scope_records": 27, "cases": 0})
    print("RETAINED_CUFF_WORKER=" + json.dumps(workers[-1]), flush=True)
    remaining = [mode for mode in MODES if mode != "B02"]
    batches = [(remaining[i:i + 2], False) for i in range(0, len(remaining), 2)] + [(["B02"], True)]
    for number, (modes, cache) in enumerate(batches, 1):
        arguments = ["--diagnostic-mode", ",".join(modes)] + (["--diagnostic-cache"] if cache else [])
        stdout, resources = run_child(node, output, f"{number:02}-{'-'.join(modes)}" + ("-cache" if cache else ""), arguments)
        summary = one(stdout, "ISSUE19_CUFF_UNDERLAY=")
        validate_identity(stdout, summary, quantized)
        require(summary["status"] == "PASS_LIMITED_DIAGNOSTIC_NOT_RELEASE_GATE", "Render child remains explicitly partial")
        require(not parse_lines(stdout, "ISSUE19_CUFF_SOURCE_SCOPE_ONLY="), "Render child executes its complete assigned branch")
        expected = [mode + "-continuous" for mode in modes]
        expected += S03_LABELS if "S03" in modes else []
        expected += CACHE_LABELS if cache else []
        require(summary["jackets"] == len(modes) and summary["cases"] == len(expected), "Exact assigned child counts")
        require(summary["records"] == parse_lines(stdout, "CUFF_UNDERLAY_CASE="), "Summary equals each actually emitted render record")
        require(summary["regions"] == fixture["cuff_bounds_xywh"], "Original cuff domains remain exact")
        validate_records(summary["records"], expected, corridors, quantized)
        partial_proof = validate_proof(one(stdout, "CUFF_UNDERLAY_SOURCE_SCOPE="))
        expected_partial = {row["original_pants_sha256"] for row in summary["records"] if row["label"].endswith("-continuous")}
        require(set(partial_proof) == expected_partial and len(partial_proof) == summary["source_scope_records"],
                "Every assigned default source has its original independent proof")
        for source_hash, proof in partial_proof.items():
            require(proof == full_proof[source_hash], "Repeated limited/full source proof must match field-for-field")
        shirt_only = parse_lines(stdout, "CUFF_SHIRT_ONLY_CASE=")
        require(len(shirt_only) == (2 if cache else 0), "Exactly the cache child must execute both shirt-only bypass controls")
        workers.append({**resources, "status": summary["status"], "checks": summary["checks"],
                        "source_scope_records": len(partial_proof), "cases": len(summary["records"]),
                        "shirt_only_controls": len(shirt_only)})
        records.extend(summary["records"])
        bypasses.extend(shirt_only)
        print("RETAINED_CUFF_WORKER=" + json.dumps(workers[-1]), flush=True)
    validate_records(records, EXPECTED_LABELS, corridors, quantized)
    by_label = {row["label"]: row for row in records}
    legacy, continuous = (by_label[label] for label in ("S03-legacy-source-order", "S03-continuous"))
    require(legacy["original_plan"] == "legacy-array" and continuous["original_plan"] == "continuous-object",
            "Both original source-order paths execute")
    require(legacy["original_order"] != continuous["original_order"], "Original source orders genuinely differ")
    first, brown, navy, restored = (by_label[label] for label in CACHE_LABELS)
    require(len({row["original_pants_sha256"] for row in (first, brown, navy)}) == 3, "All three cache source identities")
    require(len({row["cuff_rgba_sha256"] for row in (first, brown, navy)}) == 3, "All three visible cache colors")
    require(first["pure_underlay_pixels"] > 0 and brown["pure_underlay_pixels"] > 0, "Non-vacuous cache color assertions")
    require(restored["after_rgba_sha256"] == first["after_rgba_sha256"], "Exact full-frame restoration after eviction")
    require(sorted((row["shirtId"], row["state"]) for row in bypasses) == [("DS003", "NO_TIE"), ("DS035", "T001")],
            "Both exact historical shirt-only bypass controls, without duplicates")
    for row in bypasses:
        require(row["before_rgba_sha256"] == row["after_rgba_sha256"] and row["cuff_fitting_applied"] is False,
                "Exact complete shirt-only frame and disabled cuff fitting")
    quantized_keys = [(row["selection"].get("suitId") or row["selection"].get("blazerId"), tuple(point["xy"]))
                      for row in records if row["label"].endswith("-continuous")
                      for point in row["quantized_source_over_records"]]
    expected_keys = [(control["mode"], tuple(control["xy"])) for control in quantized["controls"]]
    require(len(quantized_keys) == 17 and len(set(quantized_keys)) == 17 and sorted(quantized_keys) == sorted(expected_keys),
            "All 17 unique rounded-alpha literal source controls across seven garments")
    verify_source_pins()
    report = {
        "status": "PASS_COMPLETE_HISTORICAL_CUFF_CONTRACT_NOT_VISUAL_APPROVAL",
        "runtime_sha256": quantized["candidate_runtime_sha256"],
        "baseline_runtime_sha256": quantized["baseline_runtime_sha256"],
        "rejected_runtime_sha256": quantized["rejected_runtime_sha256"],
        "original_test_sha256_without_additive_diagnostics": ORIGINAL_TEST_SHA,
        "oracle_file_sha256": PINNED_FILES, "source_scope_records": len(full_proof),
        "jackets": len(MODES), "cases": len(records), "shirt_only_controls": len(bypasses),
        "quantized_source_controls": len(quantized_keys), "quantized_source_garments": len({mode for mode, _ in quantized_keys}),
        "s03_source_order_cases": 2, "cache_states": len(CACHE_LABELS),
        "native_child_processes": len(workers), "checks": sum(worker["checks"] for worker in workers),
        "peak_child_rss_kib": max(worker["peak_rss_kib"] for worker in workers),
        "elapsed_seconds": round(time.monotonic() - started, 3), "workers": workers,
        "source_proof": source_proof["records"], "records": records, "shirt_only_records": bypasses,
    }
    write_json(output / "RESULT.json", report)
    print("ISSUE22_RETAINED_CUFF=" + json.dumps({key: value for key, value in report.items()
                                               if key not in ("workers", "source_proof", "records", "oracle_file_sha256")}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "evidence/issue22/retained-cuff")
    options = parser.parse_args()
    try:
        main(options.output.resolve())
    except Exception as error:
        options.output.mkdir(parents=True, exist_ok=True)
        write_json(options.output / "RESULT.json", {"status": "FAIL", "error": str(error)})
        raise
