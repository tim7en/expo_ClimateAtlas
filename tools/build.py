from __future__ import annotations

import argparse
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = ROOT / "index.html"
DEFAULT_OUTPUT = ROOT / "dist" / "uzbekistan-atlas.html"

STYLESHEET_PATTERN = re.compile(
    r'<link\s+[^>]*rel=["\']stylesheet["\'][^>]*href=["\'](?P<href>[^"\']+)["\'][^>]*>',
    re.IGNORECASE,
)
SCRIPT_PATTERN = re.compile(
    r'<script\s+[^>]*src=["\'](?P<src>[^"\']+)["\'][^>]*>\s*</script>',
    re.IGNORECASE,
)
CSS_URL_PATTERN = re.compile(
    r'url\(\s*(?P<quote>["\']?)(?P<path>[^)"\']+)(?P=quote)\s*\)',
    re.IGNORECASE,
)
QUOTED_ASSET_PATTERN = re.compile(
    r'(?P<quote>["\'])(?P<path>(?:\.?\.?/)?assets/[^"\']+\.(?:avif|gif|jpe?g|png|svg|webp|woff2?|ttf|otf))(?P=quote)',
    re.IGNORECASE,
)
HTML_ASSET_PATTERN = re.compile(
    r'(?P<attr>\b(?:src|href)=)(?P<quote>["\'])(?P<path>(?:\.?\.?/)?assets/[^"\']+)(?P=quote)',
    re.IGNORECASE,
)


def inject_runtime_config(html_text: str, public_mode: bool) -> str:
    if not public_mode:
        return html_text

    config_script = (
        "<script>\n"
        "window.ATLAS_CONFIG = Object.assign({}, window.ATLAS_CONFIG, {\n"
        "  showModerator: false,\n"
        "  useBrowserDrafts: false\n"
        "});\n"
        "</script>\n"
    )

    if "</head>" in html_text:
        return html_text.replace("</head>", f"{config_script}</head>", 1)

    return f"{config_script}{html_text}"


def resolve_cli_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (ROOT / path).resolve()


def resolve_local_asset(base_dir: Path, raw_path: str) -> Path | None:
    candidate = raw_path.strip()
    if not candidate or candidate.startswith(("data:", "http://", "https://", "//", "#")):
        return None
    return (base_dir / candidate).resolve()


def file_to_data_uri(path: Path) -> str:
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{payload}"


def inline_css_urls(css_text: str, base_dir: Path) -> str:
    def replace(match: re.Match[str]) -> str:
        asset_path = resolve_local_asset(base_dir, match.group("path"))
        if not asset_path or not asset_path.is_file():
            return match.group(0)
        return f'url("{file_to_data_uri(asset_path)}")'

    return CSS_URL_PATTERN.sub(replace, css_text)


def inline_quoted_assets(text: str, base_dir: Path) -> str:
    def replace(match: re.Match[str]) -> str:
        asset_path = resolve_local_asset(base_dir, match.group("path"))
        if not asset_path or not asset_path.is_file():
            return match.group(0)
        quote = match.group("quote")
        return f"{quote}{file_to_data_uri(asset_path)}{quote}"

    return QUOTED_ASSET_PATTERN.sub(replace, text)


def inline_stylesheets(html_text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        stylesheet_path = resolve_local_asset(ROOT, match.group("href"))
        if not stylesheet_path or not stylesheet_path.is_file():
            return match.group(0)
        stylesheet = stylesheet_path.read_text(encoding="utf-8")
        stylesheet = inline_css_urls(stylesheet, stylesheet_path.parent)
        stylesheet = inline_quoted_assets(stylesheet, stylesheet_path.parent)
        return f"<style>\n{stylesheet}\n</style>"

    return STYLESHEET_PATTERN.sub(replace, html_text)


def inline_scripts(html_text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        script_path = resolve_local_asset(ROOT, match.group("src"))
        if not script_path or not script_path.is_file():
            return match.group(0)
        script_text = script_path.read_text(encoding="utf-8")
        script_text = inline_quoted_assets(script_text, ROOT)
        return f"<script>\n{script_text}\n</script>"

    return SCRIPT_PATTERN.sub(replace, html_text)


def inline_html_assets(html_text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        asset_path = resolve_local_asset(ROOT, match.group("path"))
        if not asset_path or not asset_path.is_file():
            return match.group(0)
        quote = match.group("quote")
        return f"{match.group('attr')}{quote}{file_to_data_uri(asset_path)}{quote}"

    return HTML_ASSET_PATTERN.sub(replace, html_text)


def build_bundle(index_path: Path, output_path: Path, public_mode: bool = False) -> Path:
    html_text = index_path.read_text(encoding="utf-8")
    html_text = inject_runtime_config(html_text, public_mode)
    html_text = inline_stylesheets(html_text)
    html_text = inline_scripts(html_text)
    html_text = inline_html_assets(html_text)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html_text, encoding="utf-8")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bundle the atlas source files into one offline HTML deliverable."
    )
    parser.add_argument(
        "--index",
        default=str(DEFAULT_INDEX),
        help="Path to the source index.html file.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Path for the bundled HTML output.",
    )
    parser.add_argument(
        "--public",
        action="store_true",
        help="Build a public kiosk bundle that hides moderator UI and ignores browser-local drafts.",
    )
    args = parser.parse_args()

    index_path = resolve_cli_path(args.index)
    output_path = resolve_cli_path(args.output)
    built_path = build_bundle(index_path, output_path, public_mode=args.public)

    try:
        relative_path = built_path.relative_to(ROOT)
    except ValueError:
        relative_path = built_path

    mode = "public" if args.public else "editor"
    print(f"Built {relative_path} ({mode} mode)")


if __name__ == "__main__":
    main()
