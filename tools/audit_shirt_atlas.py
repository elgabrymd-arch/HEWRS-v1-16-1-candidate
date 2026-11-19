#!/usr/bin/env python3
"""Create diagnostic sheets from existing registered thumbnails; edits no assets."""
import argparse
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogue', default='evidence/five_round_20261119/CATALOGUE.json')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    shirts = sorted(json.loads((ROOT / args.catalogue).read_text())['shirts'], key=lambda item: item['id'])
    destination = Path(args.output)
    destination.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype('DejaVuSans.ttf', 15)
    title_font = ImageFont.truetype('DejaVuSans-Bold.ttf', 17)
    index = []
    for offset in range(0, len(shirts), 5):
        group = shirts[offset:offset + 5]
        sheet = Image.new('RGB', (864, 70 + 302 * len(group)), '#edeae5')
        draw = ImageDraw.Draw(sheet)
        draw.text((16, 12), 'REGISTERED SHIRT THUMBNAILS — source audit, no image replacement', font=title_font, fill='#20242a')
        headings = ['Suit / No Tie', 'Suit / tied collar', 'Non-suit / No Tie', 'Non-suit / tied collar']
        for column, heading in enumerate(headings):
            draw.text((16 + column * 212, 42), heading, font=font, fill='#20242a')
        for row, shirt in enumerate(group):
            y = 70 + row * 302
            label = shirt['id'] + '  ' + shirt['manifest']['label']
            draw.text((16, y), textwrap.shorten(label, width=100, placeholder='…'), font=font, fill='#20242a')
            for column, (source, mode) in enumerate([('thumbnails', 'no_tie'), ('thumbnails', 'tied'), ('nonSuitThumbnails', 'no_tie'), ('nonSuitThumbnails', 'tied')]):
                descriptor = (shirt.get(source) or {}).get(mode)
                fallback = False
                if source == 'nonSuitThumbnails' and descriptor is None:
                    descriptor = shirt['thumbnails'].get(mode)
                    fallback = descriptor is not None
                x = 16 + column * 212
                draw.rectangle((x, y + 27, x + 192, y + 251), fill='#c9d1d8', outline='#89939a')
                if descriptor:
                    with Image.open(ROOT / descriptor['src']) as image:
                        image = image.convert('RGBA')
                        if image.size != (192, 224):
                            image.thumbnail((192, 224), Image.Resampling.LANCZOS)
                        sheet.paste(image, (x, y + 27), image)
                    suffix = ' / same source' if fallback else ''
                    draw.text((x, y + 260), descriptor['sha256'][:10] + suffix, font=font, fill='#33434f')
                else:
                    draw.text((x + 20, y + 125), 'NO TIE ONLY', font=font, fill='#33434f')
            index.append({'id': shirt['id'], 'sheet': 'shirt-thumbnails-%02d.png' % (offset // 5 + 1), 'row': row})
        sheet.save(destination / ('shirt-thumbnails-%02d.png' % (offset // 5 + 1)))
    (destination / 'INDEX.json').write_text(json.dumps(index, indent=2) + '\n')
    print(json.dumps({'shirts': len(shirts), 'sheets': (len(shirts) + 4) // 5, 'output': str(destination)}))


if __name__ == '__main__':
    main()
