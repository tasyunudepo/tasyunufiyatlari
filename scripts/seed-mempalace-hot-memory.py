#!/usr/bin/env python3
"""Seed the controlled MemPalace hot-memory pilot without deleting data."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from mempalace.backends.chroma import ChromaBackend
from mempalace.config import MempalaceConfig
from mempalace.knowledge_graph import KnowledgeGraph


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument(
        "--manifest",
        default="scripts/mempalace-hot-memory.json",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument(
        "--verify-only",
        action="store_true",
        help="Kayıtları değiştirmeden kaynak ve drawer bütünlüğünü doğrula.",
    )
    return parser.parse_args()


def result_ids(result: object) -> list[str]:
    if hasattr(result, "ids"):
        return list(getattr(result, "ids") or [])
    if isinstance(result, dict):
        return list(result.get("ids") or [])
    return []


def result_documents(result: object) -> list[str]:
    if hasattr(result, "documents"):
        return list(getattr(result, "documents") or [])
    if isinstance(result, dict):
        return list(result.get("documents") or [])
    return []


def result_metadatas(result: object) -> list[dict]:
    if hasattr(result, "metadatas"):
        return list(getattr(result, "metadatas") or [])
    if isinstance(result, dict):
        return list(result.get("metadatas") or [])
    return []


def stable_drawer_id(wing: str, key: str) -> str:
    safe_key = "".join(char if char.isalnum() else "_" for char in key).strip("_")
    return f"drawer_hot_{wing}_{safe_key}"


def load_manifest(root: Path, manifest_path: str) -> dict:
    path = (root / manifest_path).resolve()
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_sources(
    root: Path,
    entries: list[dict],
    source_registry: dict,
) -> None:
    errors: list[str] = []
    checked_sources: set[str] = set()
    for entry in entries:
        source_file = entry["source_file"]
        source = (root / source_file).resolve()
        if not source.is_file():
            errors.append(f"{entry['key']}: kaynak bulunamadı: {source}")
            continue
        if source_file not in checked_sources:
            registry_entry = source_registry.get(source_file)
            if not isinstance(registry_entry, dict):
                errors.append(
                    f"{source_file}: manifestte onaylı kaynak kaydı bulunamadı"
                )
            else:
                approved_sha = registry_entry.get("approved_sha256")
                actual_sha = hashlib.sha256(source.read_bytes()).hexdigest()
                if approved_sha != actual_sha:
                    errors.append(
                        f"{source_file}: kanonik kaynak onaylı hash'ten sapmış "
                        f"(onaylı={approved_sha!r}, gerçek={actual_sha!r}); "
                        "seed ve arama kapatıldı"
                    )
                if not registry_entry.get("approval_basis"):
                    errors.append(
                        f"{source_file}: kaynak onay dayanağı belirtilmemiş"
                    )
                if not registry_entry.get("approved_on"):
                    errors.append(f"{source_file}: kaynak onay tarihi belirtilmemiş")
            checked_sources.add(source_file)
        source_text = source.read_text(encoding="utf-8")
        if entry["source_contains"] not in source_text:
            errors.append(
                f"{entry['key']}: kanonik kaynak işareti dosyada yok: "
                f"{entry['source_contains']!r}"
            )
    if errors:
        raise RuntimeError("\n".join(errors))


def expected_metadata(
    root: Path,
    pilot: dict,
    source_registry: dict,
    entry: dict,
) -> dict:
    content = entry["content"].strip()
    source_path = (root / entry["source_file"]).resolve()
    registry_entry = source_registry[entry["source_file"]]
    return {
        "wing": pilot["wing"],
        "room": pilot["room"],
        "source_file": entry["source_file"],
        "source_anchor": entry["source_contains"][:500],
        "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "source_approval_sha256": registry_entry["approved_sha256"],
        "source_approval_basis": registry_entry["approval_basis"],
        "source_approved_on": registry_entry["approved_on"],
        "content_sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "memory_key": entry["key"],
        "authority": pilot["authority"],
        "valid_from": pilot["valid_from"],
        "chunk_index": 0,
        "added_by": "codex-mempalace-pilot",
    }


def verify_seeded_entries(
    collection: object,
    root: Path,
    pilot: dict,
    source_registry: dict,
    entries: list[dict],
    drawer_ids: dict[str, str],
) -> None:
    errors: list[str] = []
    for entry in entries:
        drawer_id = drawer_ids[entry["key"]]
        existing = collection.get(
            ids=[drawer_id],
            include=["documents", "metadatas"],
        )
        ids = result_ids(existing)
        documents = result_documents(existing)
        metadatas = result_metadatas(existing)
        expected_document = entry["content"].strip()
        expected = expected_metadata(root, pilot, source_registry, entry)

        if drawer_id not in ids:
            errors.append(f"{entry['key']}: sıcak hafıza drawer'ı eksik")
            continue
        if not documents or documents[0] != expected_document:
            errors.append(f"{entry['key']}: sıcak hafıza içeriği manifestten sapmış")
        if not metadatas:
            errors.append(f"{entry['key']}: kaynak metadata'sı eksik")
            continue
        for key, expected_value in expected.items():
            actual_value = metadatas[0].get(key)
            if actual_value != expected_value:
                errors.append(
                    f"{entry['key']}: {key} sapmış "
                    f"(beklenen={expected_value!r}, gerçek={actual_value!r})"
                )

    if errors:
        raise RuntimeError(
            "Kaynak teyidi başarısız; varsayılan arama kapatıldı. "
            "Kanonik değişikliği inceleyip manifesti onayladıktan sonra seed "
            "komutunu yeniden çalıştırın:\n"
            + "\n".join(errors)
        )


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    manifest = load_manifest(root, args.manifest)
    pilot = manifest["pilot"]
    source_registry = manifest["source_registry"]
    entries = manifest["entries"]
    validate_sources(root, entries, source_registry)

    drawer_ids = {
        entry["key"]: stable_drawer_id(pilot["wing"], entry["key"])
        for entry in entries
    }

    if args.dry_run:
        print(f"Kaynak doğrulaması geçti: {len(entries)} kayıt")
        for entry in entries:
            print(f"DRY-RUN {drawer_ids[entry['key']]} ← {entry['source_file']}")
        print(f"DRY-RUN KG gerçekleri: {len(manifest['kg_facts'])}")
        return 0

    config = MempalaceConfig()
    backend = ChromaBackend()
    collection = backend.get_collection(
        config.palace_path,
        collection_name=config.collection_name,
        create=not args.verify_only,
    )

    if args.verify_only:
        verify_seeded_entries(
            collection,
            root,
            pilot,
            source_registry,
            entries,
            drawer_ids,
        )
        print(
            f"Kaynak teyidi geçti: {len(entries)} sıcak hafıza kaydı kanonik "
            "dosya, manifest ve drawer ile birebir eşleşiyor."
        )
        return 0

    written = 0
    unchanged = 0
    for entry in entries:
        drawer_id = drawer_ids[entry["key"]]
        content = entry["content"].strip()
        existing = collection.get(
            ids=[drawer_id],
            include=["documents", "metadatas"],
        )
        existing_ids = result_ids(existing)
        existing_docs = result_documents(existing)
        existing_metas = result_metadatas(existing)
        expected_entry_metadata = expected_metadata(
            root,
            pilot,
            source_registry,
            entry,
        )
        metadata_matches = bool(existing_metas) and all(
            existing_metas[0].get(key) == value
            for key, value in expected_entry_metadata.items()
        )

        if (
            existing_ids
            and existing_docs
            and existing_docs[0] == content
            and metadata_matches
        ):
            unchanged += 1
            continue

        metadata = dict(expected_entry_metadata)
        metadata["filed_at"] = datetime.now().isoformat()
        collection.upsert(
            ids=[drawer_id],
            documents=[content],
            metadatas=[metadata],
        )
        inserted = collection.get(ids=[drawer_id], include=[])
        if drawer_id not in result_ids(inserted):
            raise RuntimeError(f"Drawer yazıldı fakat geri okunamadı: {drawer_id}")
        written += 1

    with KnowledgeGraph() as kg:
        for fact in manifest["kg_facts"]:
            entry = next(item for item in entries if item["key"] == fact["entry_key"])
            kg.add_triple(
                fact["subject"],
                fact["predicate"],
                fact["object"],
                valid_from=pilot["valid_from"],
                source_file=entry["source_file"],
                source_drawer_id=drawer_ids[fact["entry_key"]],
                adapter_name="codex-mempalace-pilot",
            )

    print(
        f"Hot-memory seed tamamlandı: {written} yazıldı/güncellendi, "
        f"{unchanged} değişmeden kaldı, {len(manifest['kg_facts'])} KG gerçeği doğrulandı."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"HATA: {error}", file=sys.stderr)
        raise SystemExit(1)
