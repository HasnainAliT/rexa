"""Extract plain text from uploaded student-answer PDFs and Word documents."""
from __future__ import annotations

import zipfile
from io import BytesIO
from xml.etree import ElementTree as ET

from pypdf import PdfReader


MAX_FILE_BYTES = 10 * 1024 * 1024
WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_pdf_text(data: bytes, filename: str = "upload.pdf") -> tuple[str, int]:
    if not data:
        raise ValueError("The PDF file is empty.")
    if len(data) > MAX_FILE_BYTES:
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


def extract_docx_text(data: bytes, filename: str = "upload.docx") -> str:
    if not data:
        raise ValueError("The Word document is empty.")
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("Word document is larger than 10 MB.")
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            xml = archive.read("word/document.xml")
    except Exception as exc:  # noqa: BLE001 — invalid/corrupt docx
        raise ValueError(f"Could not read {filename} as a Word document.") from exc

    root = ET.fromstring(xml)
    texts = [
        node.text.strip()
        for node in root.iter(f"{WORD_NS}t")
        if node.text and node.text.strip()
    ]
    text = " ".join(texts).strip()
    if not text:
        raise ValueError("No text was found in this Word document.")
    return text
