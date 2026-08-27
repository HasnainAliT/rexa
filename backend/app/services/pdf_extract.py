"""Extract plain text from uploaded student-answer PDFs."""
from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


MAX_PDF_BYTES = 10 * 1024 * 1024


def extract_pdf_text(data: bytes, filename: str = "upload.pdf") -> tuple[str, int]:
    if not data:
        raise ValueError("The PDF file is empty.")
    if len(data) > MAX_PDF_BYTES:
        raise ValueError("PDF is larger than 10 MB.")

    try:
        reader = PdfReader(BytesIO(data))
    except Exception as exc:  # noqa: BLE001 — invalid/corrupt PDF
        raise ValueError(f"Could not read {filename} as a PDF.") from exc

    pages: list[str] = []
    for page in reader.pages:
        pages.append((page.extract_text() or "").strip())

    text = "\n\n".join(part for part in pages if part).strip()
    if not text:
        raise ValueError(
            "No text was found in this PDF. Scanned image PDFs need typed text, not photos of handwriting."
        )
    return text, len(reader.pages)
