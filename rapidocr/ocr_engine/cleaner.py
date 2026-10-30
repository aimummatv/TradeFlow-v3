"""Commercial Text Cleaner for Indian B2B Banking & Trade Invoices.
Cleans raw RapidOCR text to maximize extraction accuracy with LLM / NVIDIA NIM.
"""
import re


def clean_commercial_text(raw_text: str) -> str:
    if not raw_text:
        return ""

    lines = raw_text.splitlines()
    cleaned_lines = []

    for line in lines:
        l = line.strip()
        if not l:
            continue

        # 1. Normalize currency & banking abbreviations
        l = re.sub(r'\b[|!1\]]NR\b', 'INR', l, flags=re.IGNORECASE)
        l = re.sub(r'\bU[7T]\s*R\b', 'UTR', l, flags=re.IGNORECASE)
        l = re.sub(r'\bR\s*R\s*N\b', 'RRN', l, flags=re.IGNORECASE)
        l = re.sub(r'\bN\s*E\s*F\s*T\b', 'NEFT', l, flags=re.IGNORECASE)
        l = re.sub(r'\bR\s*T\s*G\s*S\b', 'RTGS', l, flags=re.IGNORECASE)
        l = re.sub(r'\bI\s*M\s*P\s*S\b', 'IMPS', l, flags=re.IGNORECASE)
        l = re.sub(r'\bU\s*P\s*I\b', 'UPI', l, flags=re.IGNORECASE)
        l = re.sub(r'\bReference\s*1D\b', 'Reference ID', l, flags=re.IGNORECASE)
        l = re.sub(r'\bAmoUnt\b', 'Amount', l, flags=re.IGNORECASE)

        # 2. Fix common OCR letter O/o instead of 0 in numbers and amounts
        # e.g. "INR 1,OO,OOO.OO" or "10O000"
        def fix_zeros_in_amount(match):
            val = match.group(0)
            return val.replace('O', '0').replace('o', '0')

        # Fix OCR scanning dot instead of comma in Indian lakh formatting e.g. 1.00,000.00 -> 1,00,000.00
        l = re.sub(r'(\d+)\.(\d{2},\d{3}(?:\.\d{2})?)', r'\1,\2', l)
        l = re.sub(r'(?:INR|Rs\.?|₹)\s*[0-9Oo,.]+', fix_zeros_in_amount, l, flags=re.IGNORECASE)
        l = re.sub(r'\b[0-9]{1,3}(?:,[0-9Oo]{2,3})*(?:\.[0-9Oo]{2})?\b', fix_zeros_in_amount, l)

        # 3. Fix letter O in dates e.g. 2026-O9-18 or 18/O9/2026
        l = re.sub(r'\b(\d{4})[-/.]([Oo]\d|\d[Oo])[-/.](\d{2})\b', lambda m: m.group(0).replace('O', '0').replace('o', '0'), l)
        l = re.sub(r'\b(\d{2})[-/.]([Oo]\d|\d[Oo])[-/.](\d{4})\b', lambda m: m.group(0).replace('O', '0').replace('o', '0'), l)

        # 4. Fix Account Numbers / UTRs where 'O' was scanned instead of '0' after bank prefixes
        # e.g. BARBO... -> BARB0... (IFSC 5th character is always digit 0)
        l = re.sub(r'\b([A-Z]{4})[Oo]([A-Z0-9]{6})\b', r'\g<1>0\g<2>', l)

        # 5. Normalize whitespace inside line
        l = re.sub(r'[ \t]+', ' ', l)

        cleaned_lines.append(l)

    return '\n'.join(cleaned_lines)
