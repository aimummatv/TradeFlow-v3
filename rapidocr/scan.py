#!/usr/bin/env python3
"""CLI interface for RapidOCR scanner in TradeFlow.
Outputs machine-readable JSON to stdout for easy calling from Node.js or scripts.
"""
import sys
import os
import json
import argparse

# Add current directory to sys.path so ocr_engine is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from ocr_engine.service import OCRService


def main():
    parser = argparse.ArgumentParser(description="RapidOCR Scanner CLI")
    parser.add_argument("--file", "-f", help="Path to document file (PDF, PNG, JPG, WEBP, etc.)")
    parser.add_argument("--dpi", type=int, default=200, help="DPI for PDF rendering (default: 200)")
    args = parser.parse_args()

    if not args.file:
        print(json.dumps({"success": False, "error": "No file path provided. Use --file <path>"}, ensure_ascii=True))
        sys.exit(1)

    file_path = os.path.abspath(args.file)
    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"File not found: {file_path}"}, ensure_ascii=True))
        sys.exit(1)

    try:
        service = OCRService()
        result = service.scan_path(file_path)
        print(json.dumps(result, ensure_ascii=True))
        sys.exit(0 if result.get("success") else 1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=True))
        sys.exit(1)


if __name__ == "__main__":
    main()
