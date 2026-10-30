"""Exercise the real OCR engine with generated fixtures; no business data is used."""
import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'rapidocr'))
from PIL import Image, ImageDraw, ImageFont
import pymupdf
from ocr_engine.service import OCRService

engine = OCRService()
scratch = Path(__file__).resolve().parents[2] / '.tradeflow-tests'
scratch.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='ocr-', dir=scratch) as directory:
    image = Image.new('RGB', (1200, 400), 'white')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 48)
    draw = ImageDraw.Draw(image)
    draw.text((40, 40), 'TRADEFLOW PAYMENT RECEIPT', fill='black', font=font)
    draw.text((40, 130), 'Amount INR 10000.00', fill='black', font=font)
    image_path = Path(directory) / 'receipt.png'
    image.save(image_path)
    result = engine.scan_path(str(image_path))
    assert result['success'], result.get('error')
    assert '10000' in result['raw_text'], result['raw_text']
    pdf_path = Path(directory) / 'receipt.pdf'
    document = pymupdf.open()
    page = document.new_page(width=600, height=200)
    page.insert_image(page.rect, filename=str(image_path))
    document.save(pdf_path)
    document.close()
    pdf = engine.scan_path(str(pdf_path))
    assert pdf['success'] and len(pdf['pages']) == 1, pdf.get('error')
    assert '10000' in pdf['raw_text'], pdf['raw_text']
    assert not engine.scan_path(str(Path(directory) / 'missing.pdf'))['success']
    many_path = Path(directory) / 'many.pdf'
    document = pymupdf.open()
    for _ in range(21):
        document.new_page()
    document.save(many_path)
    document.close()
    assert not engine.scan_path(str(many_path))['success']
    print(json.dumps({'passed': 4, 'checks': ['image OCR', 'PDF OCR', 'missing file', 'PDF page limit'], 'image_confidence': result['confidence'], 'pdf_confidence': pdf['confidence']}))
