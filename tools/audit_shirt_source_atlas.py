#!/usr/bin/env python3
"""Read a supplied catalogue PDF and compare its same-ID images with app thumbnails.

Diagnostic output may contain private catalogue photographs. Keep output outside
the published application. No image in the application is modified.
"""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def paste_fit(sheet, pic, box):
    pic = pic.convert('RGBA')
    pic.thumbnail((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS)
    x = box[0] + (box[2] - box[0] - pic.width) // 2
    y = box[1] + (box[3] - box[1] - pic.height) // 2
    sheet.paste(pic, (x, y), pic)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--catalogue', default='evidence/five_round_20261119/CATALOGUE.json')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    pdf_path, output = Path(args.pdf), Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    data = json.loads((ROOT / args.catalogue).read_text())
    shirts = sorted(data['shirts'], key=lambda row: row['id'])
    document = fitz.open(pdf_path)
    pages, records = {}, []
    for index, page in enumerate(document):
        text = page.get_text()
        match = re.match(r'\s*(DS\d{3})\s*-', text)
        if not match:
            continue
        identity = match.group(1)
        if identity in pages:
            raise ValueError('Duplicate authoritative page: ' + identity)
        images = page.get_images(full=True)
        if len(images) != 1:
            raise ValueError('Expected one authoritative image for ' + identity)
        raw = document.extract_image(images[0][0])['image']
        pages[identity] = Image.open(io.BytesIO(raw)).convert('RGBA')
        records.append({'id': identity, 'page': index + 1, 'image_sha256': hashlib.sha256(raw).hexdigest(), 'text': text})
    if set(pages) != {row['id'] for row in shirts}:
        raise ValueError('Source PDF and active shirt roster differ')
    font = ImageFont.truetype('DejaVuSans.ttf', 16)
    title = ImageFont.truetype('DejaVuSans-Bold.ttf', 18)
    for offset in range(0, len(shirts), 5):
        group = shirts[offset:offset + 5]
        sheet = Image.new('RGB', (1120, 75 + 286 * len(group)), '#edeae5')
        draw = ImageDraw.Draw(sheet)
        draw.text((16, 10), 'SAME-ID SOURCE COMPARISON — approved context differences retained', font=title, fill='#20242a')
        headings = ['Authoritative PDF image', 'Suit / No Tie', 'Suit / tied', 'Non-suit / No Tie', 'Non-suit / tied']
        for column, label in enumerate(headings):
            draw.text((16 + 220 * column, 42), label, font=font, fill='#20242a')
        for row, shirt in enumerate(group):
            y = 76 + row * 286
            draw.text((16, y), shirt['id'] + '  ' + shirt['record'].get('label', shirt['id']), font=font, fill='#20242a')
            pictures = [pages[shirt['id']]]
            for key, state in [('thumbnails', 'no_tie'), ('thumbnails', 'tied'), ('nonSuitThumbnails', 'no_tie'), ('nonSuitThumbnails', 'tied')]:
                descriptor = (shirt.get(key) or {}).get(state)
                if descriptor is None and key == 'nonSuitThumbnails':
                    descriptor = shirt['thumbnails'].get(state)
                pictures.append(Image.open(ROOT / descriptor['src']) if descriptor else None)
            for column, picture in enumerate(pictures):
                x = 16 + column * 220
                box = (x, y + 26, x + 200, y + 264)
                draw.rectangle(box, fill='#c9d1d8', outline='#89939a')
                if picture is not None:
                    paste_fit(sheet, picture, box)
                else:
                    draw.text((x + 30, y + 128), 'NO TIE ONLY', font=font, fill='#33434f')
        sheet.save(output / ('shirt-source-%02d.png' % (offset // 5 + 1)))
    index = {'pdf': pdf_path.name, 'pdf_sha256': hashlib.sha256(pdf_path.read_bytes()).hexdigest(), 'pages': len(document), 'shirts': records}
    (output / 'INDEX.json').write_text(json.dumps(index, indent=2) + '\n')
    print(json.dumps({'source_ids': len(pages), 'sheets': (len(shirts) + 4) // 5, 'output': str(output)}))


if __name__ == '__main__':
    main()
