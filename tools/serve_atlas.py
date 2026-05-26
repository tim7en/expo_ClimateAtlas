from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import perf_counter
from urllib import error, parse, request

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8010


@dataclass(frozen=True)
class AiConfig:
    api_key: str
    base_url: str
    chat_path: str
    model: str
    image_detail: str
    timeout: float


def load_dotenv_file(path: Path) -> None:
    if not path.is_file():
        return

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return

    for raw_line in lines:
        line = raw_line.strip()

        if not line or line.startswith("#"):
            continue

        if line.lower().startswith("export "):
            line = line[7:].strip()

        if "=" not in line:
            continue

        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()

        if not name or name in os.environ:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]

        os.environ[name] = value


def read_text_env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name, "").strip()

        if value:
            return value

    return default


def read_float_env(name: str, default: float) -> float:
    raw_value = os.getenv(name, "").strip()

    if not raw_value:
        return default

    try:
        return max(5.0, float(raw_value))
    except ValueError:
        return default


def read_choice_env(*names: str, choices: set[str], default: str) -> str:
    value = read_text_env(*names, default=default).lower()
    return value if value in choices else default


def load_ai_config() -> AiConfig:
    return AiConfig(
        api_key=read_text_env("ATLAS_AI_API_KEY", "OPENAI_API_KEY", "OPENAI_API"),
        base_url=read_text_env("ATLAS_AI_BASE_URL", "OPENAI_BASE_URL", default="https://api.openai.com/v1").rstrip("/"),
        chat_path=f"/{os.getenv('ATLAS_AI_CHAT_PATH', 'chat/completions').strip().lstrip('/')}",
        model=read_text_env("ATLAS_AI_MODEL", "OPENAI_MODEL", default="gpt-4.1-mini") or "gpt-4.1-mini",
        image_detail=read_choice_env(
            "ATLAS_AI_IMAGE_DETAIL",
            "OPENAI_IMAGE_DETAIL",
            choices={"low", "auto", "high"},
            default="low",
        ),
        timeout=read_float_env("ATLAS_AI_TIMEOUT", 60.0),
    )


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def collapse_whitespace(value: str) -> str:
    return " ".join(str(value or "").split())


def trim_prompt_text(value: str, max_chars: int = 5000) -> str:
    text = collapse_whitespace(value)

    if len(text) <= max_chars:
        return text

    trimmed = text[:max_chars].rsplit(" ", 1)[0].strip()
    return f"{trimmed} ..."


def build_system_prompt() -> str:
    return (
        "You write short English evidence notes for climate and environment map pages in an offline library. "
        "Describe only what is visible on the page or directly supported by the supplied extracted text. "
        "Prioritize climate, temperature, precipitation, drought, snow, hydrology, wind, solar, terrain, water stress, hazards, and regional contrasts when present. "
        "Do not invent numbers, dates, trends, or policy claims that are not visible or stated. "
        "If the page is partly unreadable, say what is still visible and note the uncertainty briefly. "
        "Return plain English only, in 2 short paragraphs and an optional final sentence starting with 'Why it matters:'."
    )


def build_user_prompt(payload: dict) -> str:
    lines = [
        "Write a concise English note for the current page.",
        f"Title: {str(payload.get('title') or '').strip()}",
        f"Alias: {str(payload.get('alias') or '').strip()}",
        f"Collection: {str(payload.get('collection') or '').strip()} ({str(payload.get('collectionId') or '').strip()})",
        f"Category: {str(payload.get('category') or '').strip()}",
        f"Page: {int(payload.get('pageNumber') or 0)} of {int(payload.get('pageCount') or 0)}",
    ]

    topics = [str(topic).strip() for topic in payload.get("topics") or [] if str(topic).strip()]
    keywords = [str(keyword).strip() for keyword in payload.get("keywords") or [] if str(keyword).strip()]

    if topics:
        lines.append(f"Topics: {', '.join(topics[:8])}")

    if keywords:
        lines.append(f"Keywords: {', '.join(keywords[:10])}")

    page_text = trim_prompt_text(str(payload.get("pageText") or ""))
    if page_text:
        lines.extend(
            [
                "Extracted page text:",
                page_text,
            ]
        )

    lines.append("Focus on what this map or visual shows and why it matters in climate terms.")
    return "\n".join(lines)


def flatten_message_content(value) -> str:
    if isinstance(value, str):
        return value.strip()

    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, str):
                if item.strip():
                    parts.append(item.strip())
                continue

            if not isinstance(item, dict):
                continue

            text = item.get("text") or item.get("content") or item.get("value")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())

        return "\n\n".join(parts).strip()

    return ""


def extract_api_error_message(raw_body: str, fallback: str) -> str:
    try:
        parsed = json.loads(raw_body)
    except json.JSONDecodeError:
        return fallback

    error_payload = parsed.get("error")
    if isinstance(error_payload, dict):
        message = str(error_payload.get("message") or "").strip()
        if message:
            return message

    if isinstance(error_payload, str) and error_payload.strip():
        return error_payload.strip()

    return fallback


def extract_explanation(response_payload: dict) -> str:
    output_text = str(response_payload.get("output_text") or "").strip()
    if output_text:
        return output_text

    choices = response_payload.get("choices") or []
    if not choices:
        return ""

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        return ""

    return flatten_message_content(message.get("content"))


def request_ai_explanation(payload: dict, ai_config: AiConfig) -> tuple[str, str, int]:
    endpoint = f"{ai_config.base_url}{ai_config.chat_path}"
    request_body = {
        "model": ai_config.model,
        "temperature": 0.2,
        "max_tokens": 340,
        "messages": [
            {
                "role": "system",
                "content": build_system_prompt(),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": build_user_prompt(payload),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": str(payload.get("imageDataUrl") or "").strip(),
                            "detail": ai_config.image_detail,
                        },
                    },
                ],
            },
        ],
    }

    http_request = request.Request(
        endpoint,
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {ai_config.api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    started_at = perf_counter()
    try:
        with request.urlopen(http_request, timeout=ai_config.timeout) as response:
            raw_response = response.read().decode("utf-8")
    except error.HTTPError as exc:
        raw_body = exc.read().decode("utf-8", errors="replace")
        message = extract_api_error_message(raw_body, f"AI provider error ({exc.code}).")
        raise RuntimeError(message) from exc
    except error.URLError as exc:
        raise RuntimeError(f"Could not reach the AI provider: {exc.reason}.") from exc

    try:
        response_payload = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        raise RuntimeError("The AI provider returned invalid JSON.") from exc

    explanation = extract_explanation(response_payload)
    if not explanation:
        raise RuntimeError("The AI provider returned an empty explanation.")

    response_model = str(response_payload.get("model") or ai_config.model).strip() or ai_config.model
    duration_ms = max(0, round((perf_counter() - started_at) * 1000))
    return explanation.strip(), response_model, duration_ms


class AtlasRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    @property
    def ai_config(self) -> AiConfig:
        return self.server.ai_config

    def get_request_path(self) -> str:
        return parse.urlsplit(self.path).path.rstrip("/") or "/"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_head(self):
        if self.get_request_path() == "/api/ai-status":
            self.send_json(
                {
                    "configured": bool(self.ai_config.api_key),
                    "model": self.ai_config.model,
                    "imageDetail": self.ai_config.image_detail,
                    "chatPath": self.ai_config.chat_path,
                    "updatedAt": utc_timestamp(),
                }
            )
            return None

        return super().send_head()

    def do_POST(self) -> None:
        if self.get_request_path() != "/api/explain-page":
            self.send_json({"error": "Not found."}, status=HTTPStatus.NOT_FOUND)
            return

        self.handle_explain_page()

    def handle_explain_page(self) -> None:
        if not self.ai_config.api_key:
            self.send_json(
                {
                    "error": "No AI API key is configured. Set ATLAS_AI_API_KEY, OPENAI_API_KEY, or OPENAI_API and restart the atlas server.",
                },
                status=HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return

        try:
            payload = self.read_json_body()
        except ValueError as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return

        title = str(payload.get("title") or "").strip()
        image_data_url = str(payload.get("imageDataUrl") or "").strip()
        page_number = int(payload.get("pageNumber") or 0)

        if not title:
            self.send_json({"error": "The request is missing a document title."}, status=HTTPStatus.BAD_REQUEST)
            return

        if page_number < 1:
            self.send_json({"error": "The request is missing a valid page number."}, status=HTTPStatus.BAD_REQUEST)
            return

        if not image_data_url.startswith("data:image/"):
            self.send_json({"error": "The request is missing the current page image."}, status=HTTPStatus.BAD_REQUEST)
            return

        try:
            explanation, model, duration_ms = request_ai_explanation(payload, self.ai_config)
        except RuntimeError as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_GATEWAY)
            return

        self.send_json(
            {
                "explanation": explanation,
                "model": model,
                "durationMs": duration_ms,
                "updatedAt": utc_timestamp(),
            }
        )

    def read_json_body(self) -> dict:
        raw_length = self.headers.get("Content-Length", "").strip()

        if not raw_length:
            raise ValueError("Missing request body.")

        try:
            content_length = int(raw_length)
        except ValueError as exc:
            raise ValueError("Invalid Content-Length header.") from exc

        if content_length <= 0:
            raise ValueError("Missing request body.")

        body = self.rfile.read(content_length).decode("utf-8")

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise ValueError("Request body must be valid JSON.") from exc

        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")

        return payload

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        response_body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_body)))
        self.end_headers()
        self.wfile.write(response_body)


class AtlasServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], ai_config: AiConfig):
        super().__init__(server_address, AtlasRequestHandler)
        self.ai_config = ai_config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Serve the atlas locally with an optional AI explanation endpoint."
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host interface to bind.")
    parser.add_argument("--port", default=DEFAULT_PORT, type=int, help="Port to listen on.")
    return parser.parse_args()


def main() -> None:
    load_dotenv_file(ROOT / ".env")
    args = parse_args()
    ai_config = load_ai_config()
    server = AtlasServer((args.host, args.port), ai_config)
    origin = f"http://{args.host}:{args.port}"

    print(f"Serving atlas at {origin}/")
    if ai_config.api_key:
        print(f"AI explanations enabled with model {ai_config.model} and {ai_config.image_detail} image detail.")
    else:
        print("AI explanations are disabled. Set ATLAS_AI_API_KEY, OPENAI_API_KEY, or OPENAI_API to enable /api/explain-page.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping atlas server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
