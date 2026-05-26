from __future__ import annotations

import csv
import json
import re
import unicodedata
from hashlib import sha1
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "source"
OUTPUT = ROOT / "js" / "source-library.js"
REPORT_PARTS = ("Отчеты", "Отчеты")

COLLECTIONS = {
    "01_Regional_Maps": ("regional-maps", "Regional maps", "map"),
    "02_Atlas_Thematic_Maps": ("thematic-maps", "Atlas thematic maps", "map"),
    "03_Drivers_of_Change_Chapter_12_37": ("drivers-of-change", "Drivers of change", "map"),
    "04_Climate_Chapter_136_156": ("climate-chapter", "Climate chapter", "map"),
}

TOPIC_PATTERNS = [
    ("climate", ("климат", "climate", "temperature", "precipitation", "ndc")),
    ("air", ("воздух", "air", "pm2.5", "dust", "пыль", "бур")),
    ("water", ("вод", "water", "river", "reservoir", "ramsar", "wetland", "precipitation")),
    ("biodiversity", ("биоразнообраз", "ecosystem", "red book", "красная книг")),
    ("urban", ("город", "urban", "housing", "земель", "livable")),
    ("chemicals", ("хим", "chemical", "waste", "отход", "endocrine")),
    ("investment", ("инвест", "investment", "infrastructure", "strategy", "стратег")),
    ("adaptation", ("адаптац", "устойчив", "resilience", "adaptation")),
]

REPORT_ALIASES = {
    "15": "NDC 3.0 ambitions and GHG emissions reduction opportunities",
    "16": "Updated Nationally Determined Contribution through 2035",
    "17": "NDC 3.0 progress and implementation assessment",
}

REPORT_EXTRA_KEYWORDS = {
    "15": [
        "NDC 3.0",
        "NDC3",
        "GHG",
        "greenhouse gas",
        "emissions reduction",
        "mitigation ambition",
        "ambition",
    ],
    "16": [
        "NDC 3.0",
        "NDC3",
        "2035",
        "greenhouse gas",
        "emissions reduction",
        "nationally determined contribution",
    ],
    "17": [
        "NDC 3.0",
        "NDC3",
        "implementation",
        "progress",
        "greenhouse gas",
        "emissions reduction",
    ],
}

GIT_LFS_POINTER_HEADER = b"version https://git-lfs.github.com/spec/v1\n"


def slugify(value: str, fallback: str = "document") -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")
    return slug or fallback


def format_bytes(byte_count: int) -> str:
    if byte_count < 1024:
        return f"{byte_count} B"
    if byte_count < 1024 * 1024:
        return f"{byte_count / 1024:.1f} KB"
    return f"{byte_count / (1024 * 1024):.1f} MB"


def clean_title_from_stem(stem: str) -> str:
    title = re.sub(r"^\d+(?:\.\d+)?\.?\s*", "", stem).strip()
    title = re.sub(r"^\d+_Page(?:s)?_\d+(?:_\d+)?_", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^\d+_Section_Cover_", "", title, flags=re.IGNORECASE)
    title = title.replace("_", " ")
    title = re.sub(r"\s+", " ", title).strip()
    return title or stem


def get_report_prefix(path: Path) -> str:
    match = re.match(r"^(\d+(?:\.\d+)?)\.", path.name)
    return match.group(1) if match else ""


def infer_topics(*values: str) -> list[str]:
    haystack = " ".join(values).lower()
    topics = [
        label
        for label, patterns in TOPIC_PATTERNS
        if any(pattern in haystack for pattern in patterns)
    ]
    return topics or ["environment"]


def read_docx_report_rows() -> dict[int, dict[str, str]]:
    docx_paths = sorted(SOURCE_DIR.rglob("*.docx"), key=lambda path: len(path.parts))
    if not docx_paths:
        return {}

    validate_resolved_source_files(docx_paths, "DOCX metadata files")

    with ZipFile(docx_paths[0]) as archive:
        xml_text = archive.read("word/document.xml")

    root = ET.fromstring(xml_text)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    rows: dict[int, dict[str, str]] = {}

    for row_index, table_row in enumerate(root.findall(".//w:tbl/w:tr", namespace)):
        if row_index == 0:
            continue

        cells: list[str] = []
        for table_cell in table_row.findall("w:tc", namespace):
            paragraphs: list[str] = []
            for paragraph in table_cell.findall(".//w:p", namespace):
                text = "".join(text_node.text or "" for text_node in paragraph.findall(".//w:t", namespace)).strip()
                if text:
                    paragraphs.append(text)
            cells.append(" ".join(paragraphs).strip())

        if len(cells) >= 4:
            rows[row_index] = {
                "publication": cells[1],
                "year": cells[2],
                "partner": cells[3],
            }

    return rows


def read_map_titles() -> dict[tuple[str, str], str]:
    mapping_path = SOURCE_DIR / "RENAMING_MAPPING.csv"
    if not mapping_path.exists():
        return {}

    with mapping_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        rows = csv.DictReader(csv_file)
        return {
            (row["group_folder"], row["renamed_file"]): row["pdf_name"]
            for row in rows
            if row.get("group_folder") and row.get("renamed_file") and row.get("pdf_name")
        }


def iter_source_pdfs() -> list[Path]:
    return sorted(
        path
        for path in SOURCE_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() == ".pdf"
    )


def is_git_lfs_pointer(path: Path) -> bool:
    with path.open("rb") as source_file:
        header = source_file.read(256)

    return header.startswith(GIT_LFS_POINTER_HEADER) and b"\noid sha256:" in header


def validate_resolved_source_files(paths: list[Path], label: str) -> None:
    pointer_paths = [path for path in paths if is_git_lfs_pointer(path)]
    if not pointer_paths:
        return

    sample = "\n".join(
        f" - {path.relative_to(ROOT).as_posix()}"
        for path in pointer_paths[:5]
    )
    remainder = len(pointer_paths) - 5
    more = f"\n - ... and {remainder} more" if remainder > 0 else ""
    raise SystemExit(
        f"Source {label} in assets/source are still Git LFS pointer files.\n"
        "Run `git lfs install` once, then `git lfs pull` in this repo before rebuilding the library.\n"
        "Pointer files found:\n"
        f"{sample}{more}"
    )


def is_report_path(path: Path) -> bool:
    parts = path.relative_to(SOURCE_DIR).parts
    return len(parts) >= 3 and parts[0:2] == REPORT_PARTS


def build_document(path: Path, report_rows: dict[int, dict[str, str]], map_titles: dict[tuple[str, str], str]) -> dict[str, object]:
    relative_path = path.relative_to(ROOT).as_posix()
    source_relative = path.relative_to(SOURCE_DIR)
    parts = source_relative.parts
    file_size = path.stat().st_size
    prefix = get_report_prefix(path)
    report_number = int(float(prefix)) if prefix else 0
    report_meta = report_rows.get(report_number, {})

    category = "reference"
    category_label = "Source PDF"
    collection_id = "source-atlases"
    collection = "Source atlases"
    title = clean_title_from_stem(path.stem)
    year = ""
    partner = ""
    order = 9000

    if is_report_path(path):
        category = "report"
        category_label = "Report"
        collection_id = "reports"
        collection = "Analytical reports"
        title = report_meta.get("publication") or title
        if "." in prefix:
            title = clean_title_from_stem(path.stem)
        year = report_meta.get("year", "")
        partner = report_meta.get("partner", "")
        order = report_number * 100 + int((float(prefix) % 1) * 10) if prefix else 10000
    elif parts and parts[0] in COLLECTIONS:
        collection_id, collection, category = COLLECTIONS[parts[0]]
        category_label = "Map"
        title = map_titles.get((parts[0], path.name), title)
        order_match = re.match(r"^(\d+)", path.name)
        order = list(COLLECTIONS).index(parts[0]) * 1000 + int(order_match.group(1) if order_match else 999)
    else:
        order_match = re.match(r"^(\d+)", path.name)
        order = 8000 + int(order_match.group(1) if order_match else 999)

    year_match = re.search(r"\b(20\d{2}|19\d{2}|2100)\b", f"{title} {path.name}")
    if not year and year_match:
        year = year_match.group(1)

    topics = infer_topics(title, collection, partner, path.name)
    digest = sha1(relative_path.encode("utf-8")).hexdigest()[:10]
    base_slug = slugify(title, "document")
    alias = REPORT_ALIASES.get(prefix, "")
    keywords = [category, collection_id, collection, *topics, year, partner, path.stem, alias, *REPORT_EXTRA_KEYWORDS.get(prefix, [])]

    return {
        "id": f"{base_slug}-{digest}",
        "title": title,
        "alias": alias,
        "category": category,
        "categoryLabel": category_label,
        "collection": collection,
        "collectionId": collection_id,
        "path": relative_path,
        "fileName": path.name,
        "folder": "/".join(parts[:-1]),
        "size": file_size,
        "sizeLabel": format_bytes(file_size),
        "year": year,
        "partner": partner,
        "prefix": prefix,
        "topics": topics,
        "keywords": sorted(set(keyword for keyword in keywords if keyword)),
        "order": order,
    }


def build_library() -> list[dict[str, object]]:
    pdf_paths = iter_source_pdfs()
    validate_resolved_source_files(pdf_paths, "PDF assets")
    report_rows = read_docx_report_rows()
    map_titles = read_map_titles()
    documents = [
        build_document(path, report_rows, map_titles)
        for path in pdf_paths
    ]
    return sorted(documents, key=lambda item: (str(item["category"] != "report"), int(item["order"]), str(item["title"]).lower()))


def main() -> None:
    documents = build_library()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(documents, ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "// Generated by tools/build_source_library.py from assets/source.\n"
        f"window.SOURCE_LIBRARY = {payload};\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {len(documents)} documents")


if __name__ == "__main__":
    main()
