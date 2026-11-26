"""Regenerate the advent calendar's 24 Spotify QR images."""

import json
from pathlib import Path
import re

import qrcode
from qrcode.image.pure import PyPNGImage


ROOT = Path(__file__).resolve().parent
DAYS = set(range(1, 25))
TRACK_URL = re.compile(r"https://open\.spotify\.com/track/[A-Za-z0-9]{22}")


def generate():
    tracks = json.loads((ROOT / "tracks.json").read_text(encoding="utf-8"))
    urls_by_day = {}
    for track in tracks:
        day = track["day"]
        url = track["spotifyUrl"]
        if type(day) is not int or day not in DAYS or day in urls_by_day:
            raise ValueError(f"Invalid or duplicate calendar day: {day!r}")
        if not isinstance(url, str) or not TRACK_URL.fullmatch(url):
            raise ValueError(f"Day {day} needs a direct Spotify track URL")
        urls_by_day[day] = url

    if missing := DAYS - urls_by_day.keys():
        raise ValueError(f"Missing calendar days: {sorted(missing)}")
    if len(set(urls_by_day.values())) != len(DAYS):
        raise ValueError("Each day needs a unique Spotify track URL")

    qr_directory = ROOT / "qr"
    qr_directory.mkdir(exist_ok=True)
    for day, url in sorted(urls_by_day.items()):
        code = qrcode.QRCode(
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=16,
            border=4,
            image_factory=PyPNGImage,
        )
        code.add_data(url)
        code.make(fit=True)
        with (qr_directory / f"{day:02}.png").open("wb") as output:
            code.make_image().save(output)
    print(f"Generated {len(urls_by_day)} QR images in {qr_directory}")


if __name__ == "__main__":
    try:
        generate()
    except (OSError, ValueError, TypeError, KeyError) as error:
        raise SystemExit(f"Unable to generate QR images: {error}") from error
