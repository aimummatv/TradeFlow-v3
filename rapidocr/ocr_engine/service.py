"""RapidOCR Service Adapter for TradeFlow.
Processes Images (PNG, JPG, WEBP) and PDFs (multi-page via PyMuPDF) using ONNX runtime.
"""
import os
import time
import io
import warnings
from typing import List, Dict, Any, Optional

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError as e:
    raise ImportError(f"rapidocr-onnxruntime is not installed in the environment: {e}")

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS = 25_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)
import numpy as np

from .cleaner import clean_commercial_text


class OCRService:
    def __init__(self):
        # Initialize RapidOCR ONNX engine with default lightweight models
        self.engine = RapidOCR()

    def scan_path(self, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            return {
                "success": False,
                "error": f"File does not exist: {file_path}",
                "text": "",
                "raw_text": "",
                "confidence": 0.0,
                "duration_ms": 0,
                "pages": []
            }

        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return self.scan_pdf(file_path)
        else:
            return self.scan_image(file_path)

    def scan_image(self, image_input: Any) -> Dict[str, Any]:
        start_time = time.perf_counter()

        try:
            # RapidOCR accepts file path, PIL Image, or numpy array
            # Apply ImageOps.exif_transpose to ensure phone camera portrait orientations are upright
            if isinstance(image_input, str):
                img = Image.open(image_input)
                img = ImageOps.exif_transpose(img)
                img_np = np.array(img.convert("RGB"))
                ocr_result, elapse = self.engine(img_np)
            elif isinstance(image_input, Image.Image):
                img = ImageOps.exif_transpose(image_input)
                img_np = np.array(img.convert("RGB"))
                ocr_result, elapse = self.engine(img_np)
            elif isinstance(image_input, np.ndarray):
                ocr_result, elapse = self.engine(image_input)
            elif isinstance(image_input, (bytes, bytearray)):
                img = Image.open(io.BytesIO(image_input))
                img = ImageOps.exif_transpose(img)
                img_np = np.array(img.convert("RGB"))
                ocr_result, elapse = self.engine(img_np)
            else:
                return {
                    "success": False,
                    "error": f"Unsupported image input type: {type(image_input)}",
                    "text": "",
                    "raw_text": "",
                    "confidence": 0.0,
                    "duration_ms": 0,
                    "pages": []
                }

            items = []
            scores = []
            raw_lines = []

            if ocr_result:
                for entry in ocr_result:
                    box = entry[0]
                    text = entry[1]
                    score = float(entry[2])
                    items.append({
                        "text": text,
                        "confidence": round(score, 4),
                        "box": box
                    })
                    scores.append(score)
                    raw_lines.append(text)

            raw_text = "\n".join(raw_lines)
            clean_text = clean_commercial_text(raw_text)
            avg_conf = round(sum(scores) / len(scores), 4) if scores else 0.0
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return {
                "success": True,
                "text": clean_text,
                "raw_text": raw_text,
                "confidence": avg_conf,
                "duration_ms": elapsed_ms,
                "items": items,
                "pages": [
                    {
                        "page_number": 1,
                        "text": clean_text,
                        "raw_text": raw_text,
                        "confidence": avg_conf,
                        "items": items
                    }
                ]
            }

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "raw_text": "",
                "confidence": 0.0,
                "duration_ms": elapsed_ms,
                "pages": []
            }

    def scan_pdf(self, pdf_path: str, dpi: int = 200) -> Dict[str, Any]:
        if fitz is None:
            return {
                "success": False,
                "error": "PyMuPDF (fitz) is not installed for PDF rendering",
                "text": "",
                "raw_text": "",
                "confidence": 0.0,
                "duration_ms": 0,
                "pages": []
            }

        start_time = time.perf_counter()

        try:
            doc = fitz.open(pdf_path)
            total_pages = len(doc)
            if total_pages > 20:
                doc.close()
                raise ValueError('OCR supports up to 20 PDF pages per request')
            pages_output = []
            all_scores = []
            all_raw_lines = []

            for page_index in range(total_pages):
                page = doc[page_index]
                # Render page to high-quality pixmap (200 DPI for crisp OCR)
                zoom = dpi / 72.0
                if page.rect.width * page.rect.height * zoom * zoom > 25_000_000:
                    doc.close()
                    raise ValueError('PDF page exceeds the 25 megapixel OCR limit')
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)

                # Convert pixmap samples to numpy array
                img_np = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))

                ocr_result, _ = self.engine(img_np)

                page_items = []
                page_scores = []
                page_raw_lines = []

                if ocr_result:
                    for entry in ocr_result:
                        box = entry[0]
                        text = entry[1]
                        score = float(entry[2])
                        page_items.append({
                            "text": text,
                            "confidence": round(score, 4),
                            "box": box
                        })
                        page_scores.append(score)
                        page_raw_lines.append(text)
                        all_scores.append(score)

                page_raw_text = "\n".join(page_raw_lines)
                page_clean_text = clean_commercial_text(page_raw_text)
                all_raw_lines.extend(page_raw_lines)

                page_conf = round(sum(page_scores) / len(page_scores), 4) if page_scores else 0.0

                pages_output.append({
                    "page_number": page_index + 1,
                    "text": page_clean_text,
                    "raw_text": page_raw_text,
                    "confidence": page_conf,
                    "items": page_items
                })

            doc.close()

            raw_text = "\n".join(all_raw_lines)
            clean_text = clean_commercial_text(raw_text)
            avg_conf = round(sum(all_scores) / len(all_scores), 4) if all_scores else 0.0
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            all_items = []
            for p in pages_output:
                all_items.extend(p.get("items", []))

            return {
                "success": True,
                "text": clean_text,
                "raw_text": raw_text,
                "confidence": avg_conf,
                "duration_ms": elapsed_ms,
                "items": all_items,
                "pages": pages_output
            }

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "raw_text": "",
                "confidence": 0.0,
                "duration_ms": elapsed_ms,
                "pages": []
            }
