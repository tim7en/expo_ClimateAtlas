from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "js" / "moderator-drafts.js"


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (ROOT / path).resolve()


def normalize_draft(raw_draft: object) -> dict[str, object] | None:
    if not isinstance(raw_draft, dict):
        return None

    atlas_id = str(raw_draft.get("atlasId") or "").strip()
    region_id = str(raw_draft.get("regionId") or raw_draft.get("id") or "").strip()
    if not region_id:
        return None

    try:
        atlas_preview_page = int(raw_draft.get("atlasPreviewPage") or 0)
    except (TypeError, ValueError):
        atlas_preview_page = 0

    atlas_preview_page = atlas_preview_page if atlas_preview_page > 0 else 0

    try:
        custom_order = int(raw_draft.get("customOrder") or 0)
    except (TypeError, ValueError):
        custom_order = 0

    custom_order = custom_order if custom_order > 0 else 0

    normalized = {
        "atlasId": atlas_id,
        "regionId": region_id,
        "isCustomPlate": bool(raw_draft.get("isCustomPlate")),
        "name": str(raw_draft.get("name") or raw_draft.get("title") or "").strip(),
        "uz": str(raw_draft.get("uz") or raw_draft.get("localName") or "").strip(),
        "type": str(raw_draft.get("type") or "").strip(),
        "scale": str(raw_draft.get("scale") or "").strip(),
        "map": str(raw_draft.get("map") or raw_draft.get("mapPath") or "").strip(),
        "customOrder": custom_order,
        "caption": str(raw_draft.get("caption") or "").strip(),
        "summary": str(raw_draft.get("summary") or "").strip(),
        "moderatorNote": str(raw_draft.get("moderatorNote") or raw_draft.get("note") or "").strip(),
        "sourcePdf": str(raw_draft.get("sourcePdf") or raw_draft.get("pdfName") or "").strip(),
        "sourceFileSize": str(raw_draft.get("sourceFileSize") or "").strip(),
        "projectPdfName": str(raw_draft.get("projectPdfName") or raw_draft.get("projectPdfFileName") or "").strip(),
        "projectPdfPath": str(raw_draft.get("projectPdfPath") or "").strip(),
        "projectPdfSavedAt": str(raw_draft.get("projectPdfSavedAt") or "").strip(),
        "projectDraftPath": str(raw_draft.get("projectDraftPath") or raw_draft.get("descriptionPath") or "").strip(),
        "projectDraftSavedAt": str(raw_draft.get("projectDraftSavedAt") or "").strip(),
        "atlasPreviewPath": str(raw_draft.get("atlasPreviewPath") or raw_draft.get("atlasPreviewFile") or "").strip(),
        "atlasPreviewSavedAt": str(raw_draft.get("atlasPreviewSavedAt") or "").strip(),
        "atlasPreviewImage": str(raw_draft.get("atlasPreviewImage") or raw_draft.get("atlasPlateImage") or "").strip(),
        "atlasPreviewPage": atlas_preview_page,
        "updatedAt": str(raw_draft.get("updatedAt") or "").strip(),
    }

    return normalized


def load_handoff(path: Path) -> list[dict[str, object]]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))

    if isinstance(payload, list):
        raw_drafts = payload
    elif isinstance(payload, dict):
        raw_drafts = payload.get("drafts")
    else:
        raise ValueError("Handoff file must be a JSON array or an object with a 'drafts' field.")

    if not isinstance(raw_drafts, list):
        raise ValueError("The handoff file did not contain a valid draft list.")

    normalized_drafts: list[dict[str, object]] = []
    for raw_draft in raw_drafts:
        normalized = normalize_draft(raw_draft)
        if normalized:
            normalized_drafts.append(normalized)

    if not normalized_drafts:
        raise ValueError("No valid moderator drafts were found in the handoff file.")

    return normalized_drafts


def write_js_module(output_path: Path, drafts: list[dict[str, object]]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(drafts, ensure_ascii=False, indent=2)
    output_path.write_text(f"window.MODERATOR_DRAFTS = {payload};\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply an exported atlas moderator handoff JSON to js/moderator-drafts.js."
    )
    parser.add_argument("handoff", help="Path to the exported moderator handoff JSON file.")
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Path to the generated moderator drafts JS file.",
    )
    args = parser.parse_args()

    handoff_path = resolve_path(args.handoff)
    output_path = resolve_path(args.output)

    drafts = load_handoff(handoff_path)
    write_js_module(output_path, drafts)

    try:
        relative_output = output_path.relative_to(ROOT)
    except ValueError:
        relative_output = output_path

    print(f"Applied {len(drafts)} moderator draft(s) to {relative_output}")


if __name__ == "__main__":
    main()