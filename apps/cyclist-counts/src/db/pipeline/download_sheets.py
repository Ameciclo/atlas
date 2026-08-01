#!/usr/bin/env python3
"""
Download Google Sheets "Dados" tab as CSV files.

Supports public sheets only (no authentication required).
Extracts spreadsheet ID and GID from URL, then downloads via the
export CSV endpoint.

Usage:
  # Single sheet
  python download_sheets.py "https://docs.google.com/spreadsheets/d/.../edit?gid=..."

  # Batch from file (one URL per line)
  python download_sheets.py --batch links.txt

  # Pipe URLs via stdin
  cat links.txt | python download_sheets.py -

  # Specify output directory
  python download_sheets.py --out ./csvs/ "https://..."
"""

import argparse
import csv as csv_module
import os
import re
import sys
import time
from urllib.parse import parse_qs, urlparse

import requests


def extract_sheet_info(url: str) -> tuple[str, str] | None:
    """
    Extract spreadsheet ID and GID from a Google Sheets URL.

    Returns (spreadsheet_id, gid) or None if parsing fails.
    """
    # Match spreadsheet ID: /d/<ID>/
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if not match:
        print(f"  ⚠️  Could not extract spreadsheet ID from: {url}", file=sys.stderr)
        return None

    sheet_id = match.group(1)
    gid = "0"

    parsed = urlparse(url)

    # Try query string: ?gid=123
    qs_gid = parse_qs(parsed.query).get("gid")
    if qs_gid:
        gid = qs_gid[0]
        return sheet_id, gid

    # Try fragment: #gid=123
    fragment = parsed.fragment
    if fragment:
        frag_match = re.search(r"gid=(\d+)", fragment)
        if frag_match:
            gid = frag_match.group(1)
            return sheet_id, gid

    # No GID found, use default first sheet
    print(f"  ℹ️  No GID found, using default sheet (gid=0)", file=sys.stderr)
    return sheet_id, gid


def build_export_url(sheet_id: str, gid: str) -> str:
    """Build the CSV export URL for a specific sheet tab."""
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


def build_resumo_url(sheet_id: str) -> str:
    """Build the CSV export URL for the first sheet (Resumo)."""
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"


def fetch_resumo(sheet_id: str) -> tuple[str | None, str]:
    """Download the first sheet (Resumo) as CSV."""
    url = build_resumo_url(sheet_id)
    try:
        resp = requests.get(url, timeout=30)
        resp.encoding = "utf-8"
        if resp.ok and resp.text.strip():
            return resp.text, "resumo"
    except requests.RequestException:
        pass
    return None, "resumo failed"


def fetch_csv(sheet_id: str, gid: str) -> tuple[str | None, str, str]:
    """
    Download a sheet's CSV using the export endpoint.

    Returns (csv_text, source_description, suggested_filename).
    On failure, returns (None, error_description, "").
    """
    export_url = build_export_url(sheet_id, gid)
    try:
        resp = requests.get(export_url, timeout=30)
        resp.encoding = "utf-8"
        if resp.ok and resp.text.strip():
            cd = resp.headers.get("content-disposition", "")
            filename = ""
            filename_match = re.search(r'filename="?([^";]+)"?', cd)
            if filename_match:
                filename = filename_match.group(1)
            return resp.text, f"export?gid={gid}", filename
    except requests.RequestException:
        pass

    return None, f"export failed for gid={gid}", ""


def is_csv_content(text: str) -> bool:
    """Heuristic: does this look like CSV content (not HTML error page)?"""
    text = text.strip()
    if not text:
        return False
    # Google Sheets CSV starts with a leading comma or header
    if text.startswith(",") or text.startswith('","'):
        return True
    if "Dados quantitativos" in text or "Dados qualitativos" in text:
        return True
    # Likely HTML error page
    if text.startswith("<") or text.startswith("<!DOCTYPE"):
        return False
    return True


def sanitize_filename(name: str) -> str:
    """Sanitize a string for use as a filename."""
    return re.sub(r"[^a-zA-Z0-9._\- ]", "_", name).strip()


def download_sheet(url: str, output_dir: str) -> tuple[str | None, str | None]:
    """
    Download both Resumo (first sheet) and Dados (with GID) for a Google Sheet.

    Returns (resumo_path, dados_path). Either may be None on failure.
    """
    info = extract_sheet_info(url)
    if not info:
        return None, None

    sheet_id, gid = info

    print(f"📥 Downloading sheet/{sheet_id} (gid={gid})...", file=sys.stderr)

    resumo_path = None
    resumo_text, resumo_source = fetch_resumo(sheet_id)
    if resumo_text and is_csv_content(resumo_text):
        filepath = os.path.join(output_dir, f"{sheet_id}_resumo.csv")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(resumo_text)
        resumo_path = filepath
        print(f"  ✅ Resumo → {os.path.basename(filepath)}", file=sys.stderr)
    else:
        print(f"  ⚠️  Resumo not available", file=sys.stderr)

    dados_path = None
    dados_text, dados_source, _ = fetch_csv(sheet_id, gid)
    if dados_text and is_csv_content(dados_text):
        filepath = os.path.join(output_dir, f"{sheet_id}_dados.csv")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(dados_text)
        dados_path = filepath
        print(f"  ✅ Dados → {os.path.basename(filepath)}", file=sys.stderr)
    else:
        print(f"  ❌ Dados failed: {dados_source}", file=sys.stderr)

    return resumo_path, dados_path


def main():
    parser = argparse.ArgumentParser(
        description="Download Google Sheets as CSV files."
    )
    parser.add_argument(
        "url",
        nargs="?",
        help="Google Sheets URL to download",
    )
    parser.add_argument(
        "--batch",
        help="File with one Google Sheets URL per line (or CSV with 'link' column)",
    )
    parser.add_argument(
        "--out",
        default=".",
        help="Output directory for downloaded CSVs (default: current dir)",
    )
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)

    urls = []

    if args.url == "-":
        # Read URLs from stdin
        urls = [line.strip() for line in sys.stdin if line.strip()]
    elif args.url:
        urls = [args.url]

    if args.batch:
        with open(args.batch, encoding="utf-8") as f:
            content = f.read()
            f.seek(0)
            first_line = content.strip().split("\n")[0].strip()

            if first_line.startswith("http"):
                # Plain text: one URL per line
                urls.extend(
                    line.strip() for line in f
                    if line.strip().startswith("http")
                )
            else:
                # CSV format: detect column with URLs
                reader = csv_module.DictReader(f)
                for row in reader:
                    for key in row:
                        if key.lower() in {"link", "url", "planilha"}:
                            candidate = row[key].strip()
                            if candidate.startswith("http"):
                                urls.append(candidate)
                                break

    if not urls:
        print("❌ No URLs provided.", file=sys.stderr)
        parser.print_help()
        sys.exit(1)

    print(f"\n📋 Processing {len(urls)} URL(s)...\n", file=sys.stderr)

    success = 0
    failed = 0

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}]", file=sys.stderr)
        resumo_path, dados_path = download_sheet(url, args.out)
        if dados_path:
            success += 1
        else:
            failed += 1
        if i < len(urls):
            time.sleep(0.5)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"✅ Downloaded: {success} Dados + Resumo pairs", file=sys.stderr)
    if failed:
        print(f"❌ Failed: {failed}", file=sys.stderr)
    print(f"{'='*50}\n", file=sys.stderr)


if __name__ == "__main__":
    main()
