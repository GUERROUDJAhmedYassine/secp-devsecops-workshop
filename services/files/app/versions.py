import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.config import sanitize_filename, uploads_root
from app.models import FileVersionRecord


VERSION_ID_PATTERN = re.compile(r"^\d{20}$")


def _root_for_file(file_id: uuid.UUID) -> Path:
    root = (uploads_root() / ".versions" / str(file_id)).resolve()
    uploads = uploads_root().resolve()
    if uploads not in root.parents and root != uploads:
        raise ValueError("Invalid version storage path")
    return root


def _version_id_to_datetime(version_id: str) -> datetime:
    parsed = datetime.strptime(version_id, "%Y%m%d%H%M%S%f")
    return parsed.replace(tzinfo=timezone.utc)


def capture_file_version(file_id: uuid.UUID, source_path: Path, filename: str) -> None:
    if not source_path.exists() or not source_path.is_file():
        return

    version_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    safe_name = sanitize_filename(filename or source_path.name)
    destination_dir = _root_for_file(file_id)
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination_path = destination_dir / f"{version_id}_{safe_name}"
    shutil.copy2(source_path, destination_path)


def list_file_versions(file_id: uuid.UUID, filename: str) -> list[FileVersionRecord]:
    version_dir = _root_for_file(file_id)
    if not version_dir.exists():
        return []

    records: list[FileVersionRecord] = []
    for path in version_dir.iterdir():
        if not path.is_file():
            continue
        version_id = path.name.split("_", 1)[0]
        if not VERSION_ID_PATTERN.fullmatch(version_id):
            continue
        records.append(
            FileVersionRecord(
                id=version_id,
                file_id=file_id,
                filename=filename,
                file_size=path.stat().st_size,
                created_at=_version_id_to_datetime(version_id),
            )
        )
    records.sort(key=lambda record: record.created_at, reverse=True)
    return records


def get_file_version_path(file_id: uuid.UUID, version_id: str) -> Path | None:
    if not VERSION_ID_PATTERN.fullmatch(version_id):
        return None

    version_dir = _root_for_file(file_id)
    if not version_dir.exists():
        return None

    for path in version_dir.glob(f"{version_id}_*"):
        if path.is_file():
            return path
    return None
