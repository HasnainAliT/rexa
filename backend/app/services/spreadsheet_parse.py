"""Parse CSV / Excel class rosters into column + row maps."""
from __future__ import annotations

import csv
import io
from typing import Any


def parse_tabular_bytes(data: bytes, filename: str) -> dict[str, Any]:
    name = (filename or "roster.csv").lower()
    if name.endswith(".xlsx") or name.endswith(".xlsm"):
        return _parse_xlsx(data, filename)
    return _parse_csv(data, filename)


def _parse_csv(data: bytes, filename: str) -> dict[str, Any]:
    text = data.decode("utf-8-sig", errors="replace")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    columns = [c or f"Column {i + 1}" for i, c in enumerate(reader.fieldnames or [])]
    rows: list[dict[str, str]] = []
    for raw in reader:
        row = {col: (raw.get(col) or "").strip() for col in columns}
        if any(row.values()):
            rows.append(row)
    if not columns:
        raise ValueError("No header row found in this file.")
    if not rows:
        raise ValueError("No data rows found in this file.")
    return {"filename": filename, "columns": columns, "rows": rows, "row_count": len(rows)}


def _parse_xlsx(data: bytes, filename: str) -> dict[str, Any]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:  # pragma: no cover
        raise ValueError("Excel support requires openpyxl.") from exc

    workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    sheet = workbook.active
    if sheet is None:
        raise ValueError("This workbook has no worksheets.")

    iterator = sheet.iter_rows(values_only=True)
    header_row = next(iterator, None)
    if not header_row:
        raise ValueError("No header row found in this workbook.")

    columns: list[str] = []
    for index, cell in enumerate(header_row):
        label = str(cell).strip() if cell is not None else ""
        columns.append(label or f"Column {index + 1}")

    rows: list[dict[str, str]] = []
    for values in iterator:
        row = {
            columns[i]: "" if value is None else str(value).strip()
            for i in range(len(columns))
        }
        if any(row.values()):
            rows.append(row)

    workbook.close()
    if not rows:
        raise ValueError("No data rows found in this workbook.")
    return {"filename": filename, "columns": columns, "rows": rows, "row_count": len(rows)}
