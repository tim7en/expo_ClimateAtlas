from __future__ import annotations

import argparse
import re
import unicodedata
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "atlas"


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (ROOT / path).resolve()


def collect_pdf_files(inputs: list[str]) -> list[Path]:
    candidates = inputs or ["pdfs"]
    discovered: list[Path] = []

    for raw_path in candidates:
        path = resolve_path(raw_path)
        if path.is_file() and path.suffix.lower() == ".pdf":
            discovered.append(path)
            continue

        if path.is_dir():
            discovered.extend(sorted(item for item in path.glob("*.pdf") if item.is_file()))

    unique_files: list[Path] = []
    seen: set[str] = set()

    for pdf_path in discovered:
        key = str(pdf_path).lower()
        if key in seen:
            continue
        seen.add(key)
        unique_files.append(pdf_path)

    return unique_files


def export_pdf(pdf_path: Path, output_dir: Path, dpi: int) -> list[Path]:
    prefix = slugify(pdf_path.stem)
    written_files: list[Path] = []
    zoom = dpi / 72
    matrix = fitz.Matrix(zoom, zoom)

    with fitz.open(pdf_path) as document:
        page_count = document.page_count
        padding = max(2, len(str(page_count)))

        for page_number in range(page_count):
            page = document.load_page(page_number)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            filename = f"{prefix}-{page_number + 1:0{padding}d}.jpg"
            output_path = output_dir / filename
            pixmap.save(output_path)
            written_files.append(output_path)

    return written_files


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export atlas PDFs into JPG pages for the showcase app."
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        help="PDF file(s) or directory paths. Defaults to ./pdfs.",
    )
    parser.add_argument(
        "--output-dir",
        default="assets/maps",
        help="Directory where JPG exports will be written.",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=220,
        help="Render resolution in DPI.",
    )
    args = parser.parse_args()

    pdf_files = collect_pdf_files(args.inputs)
    if not pdf_files:
        parser.exit(
            status=1,
            message="No PDF files found. Put sources under ./pdfs or pass a PDF path explicitly.\n",
        )

    output_dir = resolve_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total_exports = 0
    for pdf_path in pdf_files:
        print(f"Processing {pdf_path.name}...")
        written_files = export_pdf(pdf_path, output_dir, args.dpi)
        total_exports += len(written_files)
        for output_path in written_files:
            try:
                relative_path = output_path.relative_to(ROOT)
            except ValueError:
                relative_path = output_path
            print(f"  saved {relative_path}")

    print(f"Done. Exported {total_exports} JPG file(s).")


if __name__ == "__main__":
    main()
