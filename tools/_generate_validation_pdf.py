from pathlib import Path

content = """BT
/F1 28 Tf
72 720 Td
(Atlas quality validation page) Tj
0 -36 Td
(High-resolution integration test) Tj
ET"""

objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    (f"<< /Length {len(content.encode('latin-1'))} >>\nstream\n{content}\nendstream").encode("latin-1"),
    b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
]

parts = [b"%PDF-1.4\n"]
offsets = [0]

for index, obj in enumerate(objects, start=1):
    offsets.append(sum(len(part) for part in parts))
    parts.append(f"{index} 0 obj\n".encode("latin-1") + obj + b"\nendobj\n")

xref_start = sum(len(part) for part in parts)
xref_rows = [f"xref\n0 {len(objects) + 1}\n", "0000000000 65535 f \n"]
xref_rows.extend(f"{offset:010d} 00000 n \n" for offset in offsets[1:])
trailer = f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n"

pdf_bytes = b"".join(parts) + "".join(xref_rows).encode("latin-1") + trailer.encode("latin-1")
Path("tmp-validation.pdf").write_bytes(pdf_bytes)
print("Wrote tmp-validation.pdf")
