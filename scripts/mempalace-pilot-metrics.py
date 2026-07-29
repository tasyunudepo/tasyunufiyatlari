#!/usr/bin/env python3
"""Gerçek proje sorularında MemPalace zaman etkisini A/B olarak ölç."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import statistics
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path


ARMS = ("hot-memory", "repo-first")
MIN_VERIFIED_CORRECT_PER_ARM = 5
DEFAULT_STORE = Path(
    os.environ.get(
        "MEMPALACE_PILOT_METRICS",
        str(Path.home() / ".mempalace" / "pilot-ab-metrics.jsonl"),
    )
).expanduser()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Gerçek görev başlangıcı ile kaynakça teyitli cevap arasındaki süreyi "
            "ölçer; ham soru metnini saklamaz."
        )
    )
    parser.add_argument(
        "--store",
        type=Path,
        default=DEFAULT_STORE,
        help=f"JSONL kayıt yolu (varsayılan: {DEFAULT_STORE})",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    begin = commands.add_parser("begin", help="Yeni gerçek görev ölçümü başlat.")
    begin.add_argument("question", help="Yalnız hash ve kelime sayısı saklanır.")

    complete = commands.add_parser(
        "complete",
        help="Görevi gerçek sonuç ve kaynak teyidiyle tamamla.",
    )
    complete.add_argument("trial_id")
    complete.add_argument(
        "--outcome",
        choices=("correct", "incorrect", "not-found"),
        required=True,
    )
    complete.add_argument(
        "--source-verified",
        choices=("yes", "no"),
        required=True,
    )

    commands.add_parser("report", help="Yeterli örneklem varsa gözlenen farkı raporla.")
    return parser.parse_args()


def read_events(store: Path) -> list[dict]:
    if not store.is_file():
        return []
    events: list[dict] = []
    for line_number, line in enumerate(
        store.read_text(encoding="utf-8").splitlines(),
        start=1,
    ):
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"Ölçüm kaydı bozuk: {store}:{line_number}: {error}"
            ) from error
        if not isinstance(event, dict):
            raise RuntimeError(f"Ölçüm kaydı nesne değil: {store}:{line_number}")
        events.append(event)
    return events


def append_event(store: Path, event: dict) -> None:
    store.parent.mkdir(parents=True, exist_ok=True)
    with store.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
    try:
        store.chmod(0o600)
    except OSError:
        pass


def choose_balanced_arm(events: list[dict]) -> str:
    begins = [event for event in events if event.get("event") == "begin"]
    if len(begins) % 2 == 0:
        return secrets.choice(ARMS)
    previous_arm = begins[-1].get("arm")
    if previous_arm not in ARMS:
        raise RuntimeError("Önceki ölçüm kolu geçersiz; kayıt dosyasını inceleyin.")
    return ARMS[1] if previous_arm == ARMS[0] else ARMS[0]


def begin_trial(store: Path, question: str) -> int:
    normalized_question = " ".join(question.split())
    if not normalized_question:
        raise RuntimeError("Soru boş olamaz.")

    events = read_events(store)
    arm = choose_balanced_arm(events)
    question_sha = hashlib.sha256(normalized_question.encode("utf-8")).hexdigest()
    trial_id = f"mp-{uuid.uuid4().hex[:12]}"
    append_event(
        store,
        {
            "schema_version": 1,
            "event": "begin",
            "trial_id": trial_id,
            "arm": arm,
            "question_sha256": question_sha,
            "question_word_count": len(normalized_question.split()),
            "started_at": utc_now(),
            "started_epoch": time.time(),
        },
    )

    print(f"trial_id={trial_id}")
    print(f"arm={arm}")
    if arm == "hot-memory":
        print(
            "Yöntem: Önce `bash scripts/mempalace-hot-search.sh \"<sorgu>\"`; "
            "sonucu kanonik kaynakta teyit et."
        )
    else:
        print(
            "Yöntem: MemPalace kullanmadan `rg` ve kanonik repo dosyalarıyla ara; "
            "bulguyu kaynakta teyit et."
        )
    print(
        "Cevap teyit edilince: "
        f"python3 scripts/mempalace-pilot-metrics.py complete {trial_id} "
        "--outcome correct --source-verified yes"
    )
    return 0


def complete_trial(
    store: Path,
    trial_id: str,
    outcome: str,
    source_verified: str,
) -> int:
    events = read_events(store)
    begins = [
        event
        for event in events
        if event.get("event") == "begin" and event.get("trial_id") == trial_id
    ]
    if len(begins) != 1:
        raise RuntimeError(
            f"Tekil başlangıç kaydı bulunamadı: {trial_id} (adet={len(begins)})"
        )
    if any(
        event.get("event") == "complete" and event.get("trial_id") == trial_id
        for event in events
    ):
        raise RuntimeError(f"Ölçüm daha önce tamamlanmış: {trial_id}")

    begin = begins[0]
    try:
        started_epoch = float(begin["started_epoch"])
    except (KeyError, TypeError, ValueError) as error:
        raise RuntimeError(f"Başlangıç zamanı geçersiz: {trial_id}") from error
    elapsed_seconds = round(max(0.0, time.time() - started_epoch), 3)
    verified = source_verified == "yes"
    append_event(
        store,
        {
            "schema_version": 1,
            "event": "complete",
            "trial_id": trial_id,
            "arm": begin["arm"],
            "outcome": outcome,
            "source_verified": verified,
            "elapsed_seconds": elapsed_seconds,
            "completed_at": utc_now(),
        },
    )
    print(f"trial_id={trial_id}")
    print(f"arm={begin['arm']}")
    print(f"elapsed_seconds={elapsed_seconds:.3f}")
    print(f"verified_correct={str(outcome == 'correct' and verified).lower()}")
    return 0


def completed_trials(events: list[dict]) -> list[dict]:
    begins = {
        event["trial_id"]: event
        for event in events
        if event.get("event") == "begin" and event.get("trial_id")
    }
    completed: list[dict] = []
    seen: set[str] = set()
    for event in events:
        if event.get("event") != "complete":
            continue
        trial_id = event.get("trial_id")
        if trial_id in seen or trial_id not in begins:
            continue
        begin = begins[trial_id]
        completed.append(
            {
                **event,
                "arm": begin.get("arm"),
                "question_word_count": begin.get("question_word_count"),
            }
        )
        seen.add(trial_id)
    return completed


def report(store: Path) -> int:
    trials = completed_trials(read_events(store))
    successful: dict[str, list[float]] = {arm: [] for arm in ARMS}
    totals: dict[str, int] = {arm: 0 for arm in ARMS}

    for trial in trials:
        arm = trial.get("arm")
        if arm not in ARMS:
            continue
        totals[arm] += 1
        if trial.get("outcome") == "correct" and trial.get("source_verified") is True:
            try:
                successful[arm].append(float(trial["elapsed_seconds"]))
            except (KeyError, TypeError, ValueError):
                continue

    for arm in ARMS:
        verified_count = len(successful[arm])
        accuracy = (verified_count / totals[arm] * 100) if totals[arm] else 0.0
        median_text = (
            f"{statistics.median(successful[arm]):.1f} sn"
            if successful[arm]
            else "yok"
        )
        print(
            f"{arm}: tamamlanan={totals[arm]}, "
            f"teyitli_doğru={verified_count}, "
            f"teyitli_doğruluk=%{accuracy:.1f}, "
            f"medyan_süre={median_text}"
        )

    missing = {
        arm: max(0, MIN_VERIFIED_CORRECT_PER_ARM - len(successful[arm]))
        for arm in ARMS
    }
    if any(missing.values()):
        print(
            "Örneklem yetersiz: zaman kazancı hesaplanmadı. "
            f"En az {MIN_VERIFIED_CORRECT_PER_ARM} teyitli doğru görev/kol gerekli; "
            f"eksik hot-memory={missing['hot-memory']}, "
            f"repo-first={missing['repo-first']}."
        )
        return 0

    hot_median = statistics.median(successful["hot-memory"])
    repo_median = statistics.median(successful["repo-first"])
    observed_delta = repo_median - hot_median
    if observed_delta > 0:
        percentage = (observed_delta / repo_median * 100) if repo_median else 0.0
        print(
            "Gözlenen pilot farkı: hot-memory medyanı repo-first kolundan "
            f"{observed_delta:.1f} sn (%{percentage:.1f}) daha hızlı."
        )
    elif observed_delta < 0:
        print(
            "Gözlenen pilot farkı: hot-memory medyanı repo-first kolundan "
            f"{abs(observed_delta):.1f} sn daha yavaş."
        )
    else:
        print("Gözlenen pilot farkı: iki kolun medyan süresi eşit.")
    print("Bu sonuç pilot örneklemindeki gözlenen farktır; nedensellik kanıtı değildir.")
    return 0


def main() -> int:
    args = parse_args()
    store = args.store.expanduser().resolve()
    if args.command == "begin":
        return begin_trial(store, args.question)
    if args.command == "complete":
        return complete_trial(
            store,
            args.trial_id,
            args.outcome,
            args.source_verified,
        )
    if args.command == "report":
        return report(store)
    raise RuntimeError(f"Bilinmeyen komut: {args.command}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"HATA: {error}", file=sys.stderr)
        raise SystemExit(1)
