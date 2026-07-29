#!/usr/bin/env python3
"""Executable acceptance checks for the controlled MemPalace pilot."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "scripts" / "mempalace-hot-memory.json"
SEED_WRAPPER = ROOT / "scripts" / "seed-mempalace-hot-memory.sh"
HOT_SEARCH_WRAPPER = ROOT / "scripts" / "mempalace-hot-search.sh"
METRICS_SCRIPT = ROOT / "scripts" / "mempalace-pilot-metrics.py"
MEMPALACE_BIN = Path(
    os.environ.get("MEMPALACE_BIN", str(Path.home() / ".local/bin/mempalace"))
)
KG_PATH = Path.home() / ".mempalace/knowledge_graph.sqlite3"


def run(command: list[str], timeout: int = 45) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def assert_equal(actual: str, expected: str, label: str, errors: list[str]) -> None:
    if actual.strip() != expected:
        errors.append(f"{label}: beklenen={expected!r}, gerçek={actual.strip()!r}")


def output_field(output: str, field: str) -> str | None:
    match = re.search(rf"(?m)^{re.escape(field)}=(.+)$", output)
    return match.group(1).strip() if match else None


def verify_timers(errors: list[str]) -> None:
    for unit in ("mempalace-weekly.timer", "mempalace-nightly.timer"):
        enabled = run(["systemctl", "--user", "is-enabled", unit])
        active = run(["systemctl", "--user", "is-active", unit])
        assert_equal(enabled.stdout, "disabled", f"{unit} enabled", errors)
        assert_equal(active.stdout, "inactive", f"{unit} active", errors)


def verify_no_maintenance_process(errors: list[str]) -> None:
    processes = run(
        [
            "pgrep",
            "-a",
            "-f",
            (
                "^/home/emrah/.local/share/uv/tools/mempalace/bin/python "
                "/home/emrah/.local/bin/mempalace (compress|sweep|sync)"
            ),
        ]
    )
    if processes.stdout.strip():
        errors.append(f"Bakım süreci hâlâ çalışıyor:\n{processes.stdout}")


def verify_drawer_floor(manifest: dict, errors: list[str]) -> None:
    status = run([str(MEMPALACE_BIN), "status"], timeout=90)
    match = re.search(r"MemPalace Status — ([0-9]+) drawers", status.stdout + status.stderr)
    if not match:
        errors.append("Toplam drawer sayısı status çıktısından okunamadı.")
        return
    actual = int(match.group(1))
    baseline = int(manifest["pilot"]["baseline_drawers"])
    if actual < baseline:
        errors.append(f"Drawer sayısı azaldı: baseline={baseline}, gerçek={actual}")


def verify_search_cases(manifest: dict, errors: list[str]) -> None:
    wing = manifest["pilot"]["wing"]
    room = manifest["pilot"]["room"]
    for case in manifest["evaluation_cases"]:
        result = run(
            [
                str(MEMPALACE_BIN),
                "search",
                case["query"],
                "--wing",
                wing,
                "--room",
                room,
                "--results",
                "3",
            ],
            timeout=90,
        )
        output = result.stdout + result.stderr
        normalized = output.casefold()
        if result.returncode != 0:
            errors.append(f"{case['id']}: arama komutu başarısız:\n{output}")
            continue
        room_marker = f"{wing} / {room}".casefold()
        if room_marker not in normalized:
            errors.append(f"{case['id']}: sonuç hot-memory odasından gelmedi.")
        for expected in case["expected"]:
            if expected.casefold() not in normalized:
                errors.append(f"{case['id']}: beklenen ifade yok: {expected!r}")
        for forbidden in case["forbidden"]:
            if forbidden.casefold() in normalized:
                errors.append(f"{case['id']}: yasak/bayat ifade döndü: {forbidden!r}")


def verify_kg(manifest: dict, errors: list[str]) -> None:
    if not KG_PATH.is_file():
        errors.append(f"Bilgi grafiği bulunamadı: {KG_PATH}")
        return
    with sqlite3.connect(KG_PATH) as connection:
        for fact in manifest["kg_facts"]:
            row = connection.execute(
                """
                SELECT t.source_file, t.source_drawer_id
                FROM triples t
                JOIN entities s ON s.id = t.subject
                JOIN entities o ON o.id = t.object
                WHERE s.name = ?
                  AND t.predicate = ?
                  AND o.name = ?
                  AND t.valid_to IS NULL
                LIMIT 1
                """,
                (fact["subject"], fact["predicate"], fact["object"]),
            ).fetchone()
            if row is None:
                errors.append(
                    f"KG gerçeği eksik: {fact['subject']} → "
                    f"{fact['predicate']} → {fact['object']}"
                )
                continue
            source_file, source_drawer_id = row
            if not source_file or not source_drawer_id:
                errors.append(
                    f"KG kaynağı eksik: {fact['predicate']} → {fact['object']}"
                )


def verify_source_confirmation(manifest: dict, errors: list[str]) -> None:
    if not SEED_WRAPPER.is_file():
        errors.append(f"Kaynak teyit komutu bulunamadı: {SEED_WRAPPER}")
        return

    live = run(["bash", str(SEED_WRAPPER), "--verify-only"], timeout=90)
    live_output = live.stdout + live.stderr
    if live.returncode != 0 or "Kaynak teyidi geçti" not in live_output:
        errors.append(
            "Canlı hot-memory kaynak teyidi başarısız veya salt-okunur teyit "
            f"modu yok:\n{live_output}"
        )

    stale_manifest = json.loads(json.dumps(manifest))
    stale_manifest["source_registry"]["AGENTS.md"]["approved_sha256"] = "0" * 64
    with tempfile.TemporaryDirectory(prefix="mempalace-source-drift-") as temp_dir:
        temp_manifest = Path(temp_dir) / "stale-manifest.json"
        temp_manifest.write_text(
            json.dumps(stale_manifest, ensure_ascii=False),
            encoding="utf-8",
        )
        stale = run(
            [
                "bash",
                str(SEED_WRAPPER),
                "--verify-only",
                "--manifest",
                str(temp_manifest),
            ],
            timeout=90,
        )
        sentinel = Path(temp_dir) / "mempalace-was-called"
        fake_mempalace = Path(temp_dir) / "fake-mempalace"
        fake_mempalace.write_text(
            "#!/usr/bin/env bash\n"
            "set -euo pipefail\n"
            'touch "${MEMPALACE_TEST_SENTINEL:?}"\n',
            encoding="utf-8",
        )
        fake_mempalace.chmod(0o700)
        wrapped = run(
            [
                "env",
                f"MEMPALACE_HOT_MANIFEST={temp_manifest}",
                f"MEMPALACE_BIN={fake_mempalace}",
                f"MEMPALACE_TEST_SENTINEL={sentinel}",
                "bash",
                str(HOT_SEARCH_WRAPPER),
                "kaynak sapması kabul testi",
            ],
            timeout=90,
        )
        wrapper_called_mempalace = sentinel.exists()
    if stale.returncode == 0:
        errors.append(
            "Kaynak sapması fail-closed çalışmadı: geçersiz kaynak işaretli "
            "manifest aramaya izin verebilir."
        )
    if wrapped.returncode == 0 or wrapper_called_mempalace:
        errors.append(
            "Varsayılan sorgu kaynak sapmasında fail-closed durmadı; "
            "MemPalace araması çağrıldı."
        )


def verify_metrics_mechanism(errors: list[str]) -> None:
    if not METRICS_SCRIPT.is_file():
        errors.append(f"Gerçek süre ölçüm komutu bulunamadı: {METRICS_SCRIPT}")
        return

    questions = tuple(
        f"Kabul testi ham soru {index}: proje kuralı nedir?"
        for index in range(1, 11)
    )
    with tempfile.TemporaryDirectory(prefix="mempalace-ab-metrics-") as temp_dir:
        store = Path(temp_dir) / "metrics.jsonl"
        trials: list[tuple[str, str]] = []
        for question in questions[:2]:
            begun = run(
                [
                    sys.executable,
                    str(METRICS_SCRIPT),
                    "--store",
                    str(store),
                    "begin",
                    question,
                ]
            )
            output = begun.stdout + begun.stderr
            trial_id = output_field(output, "trial_id")
            arm = output_field(output, "arm")
            if begun.returncode != 0 or not trial_id or not arm:
                errors.append(f"A/B deneyi başlatılamadı:\n{output}")
                return
            trials.append((trial_id, arm))

        if {arm for _, arm in trials} != {"hot-memory", "repo-first"}:
            errors.append(f"A/B kolları dengeli atanmadı: {trials!r}")

        for trial_id, _ in trials:
            completed = run(
                [
                    sys.executable,
                    str(METRICS_SCRIPT),
                    "--store",
                    str(store),
                    "complete",
                    trial_id,
                    "--outcome",
                    "correct",
                    "--source-verified",
                    "yes",
                ]
            )
            if completed.returncode != 0:
                errors.append(
                    f"A/B deneyi tamamlanamadı ({trial_id}):\n"
                    f"{completed.stdout}{completed.stderr}"
                )

        report = run(
            [
                sys.executable,
                str(METRICS_SCRIPT),
                "--store",
                str(store),
                "report",
            ]
        )
        report_output = report.stdout + report.stderr
        if report.returncode != 0 or "Örneklem yetersiz" not in report_output:
            errors.append(
                "A/B raporu küçük örneklemde kazanç uydurmadan yetersiz veri "
                f"demedi:\n{report_output}"
            )

        for question in questions[2:]:
            begun = run(
                [
                    sys.executable,
                    str(METRICS_SCRIPT),
                    "--store",
                    str(store),
                    "begin",
                    question,
                ]
            )
            output = begun.stdout + begun.stderr
            trial_id = output_field(output, "trial_id")
            if begun.returncode != 0 or not trial_id:
                errors.append(f"Tam örneklem A/B deneyi başlatılamadı:\n{output}")
                return
            completed = run(
                [
                    sys.executable,
                    str(METRICS_SCRIPT),
                    "--store",
                    str(store),
                    "complete",
                    trial_id,
                    "--outcome",
                    "correct",
                    "--source-verified",
                    "yes",
                ]
            )
            if completed.returncode != 0:
                errors.append(
                    f"Tam örneklem A/B deneyi tamamlanamadı ({trial_id}):\n"
                    f"{completed.stdout}{completed.stderr}"
                )

        full_report = run(
            [
                sys.executable,
                str(METRICS_SCRIPT),
                "--store",
                str(store),
                "report",
            ]
        )
        full_report_output = full_report.stdout + full_report.stderr
        if (
            full_report.returncode != 0
            or "Gözlenen pilot farkı:" not in full_report_output
        ):
            errors.append(
                "A/B raporu yeterli örneklemde gözlenen medyan farkı "
                f"üretmedi:\n{full_report_output}"
            )

        stored_text = store.read_text(encoding="utf-8") if store.is_file() else ""
        for question in questions:
            if question in stored_text:
                errors.append("A/B kaydı ham kullanıcı sorusunu saklıyor.")


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    errors: list[str] = []

    if not MEMPALACE_BIN.is_file():
        errors.append(f"MemPalace komutu bulunamadı: {MEMPALACE_BIN}")
    else:
        verify_timers(errors)
        verify_no_maintenance_process(errors)
        verify_drawer_floor(manifest, errors)
        verify_search_cases(manifest, errors)
        verify_kg(manifest, errors)

    verify_source_confirmation(manifest, errors)
    verify_metrics_mechanism(errors)

    if errors:
        print("MemPalace pilot doğrulaması BAŞARISIZ:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        "MemPalace pilot doğrulaması BAŞARILI: timer, veri tabanı tabanı, "
        "10 kritik sorgu, arama öncesi kaynak teyidi, kaynaklı KG gerçekleri "
        "ve gerçek görev süresi A/B ölçüm mekanizması geçti."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
