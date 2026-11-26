# Christmas Advent Calendar

A static December 2026 advent calendar. Doors unlock at midnight in America/Vancouver. The browser remembers which doors have successfully displayed a QR code. The calendar applies Vancouver’s year-round UTC−7 even on devices with older time zone data. [B.C. government time change announcement](https://news.gov.bc.ca/releases/2026AG0013-000209)

## Run locally

From the project directory, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://localhost:8000/) in your browser. Stop the server with Ctrl+C.

## Update the listening program

Edit the day’s entry in `tracks.json`. Use a direct Spotify track URL in the form `https://open.spotify.com/track/<id>` and round the recording’s duration to the nearest minute. Use `null` for an unknown composition year. The `listenFor` field is optional.

From the project directory, install the generator’s dependencies in a virtual environment and regenerate all 24 PNGs:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install qrcode pypng
.venv/bin/python generate_qr.py
```

Commit `tracks.json` and the generated `qr/01.png` through `qr/24.png` together to keep each recording and its notes in sync. Scan the codes with a phone from the calendar before sharing it. The deployed site uses the JSON and PNG files directly.

A missing or unreadable PNG shows a friendly message and leaves the door unmarked.

## Preview a date

Add a valid `?date=YYYY-MM-DD` to the local URL. For example, [December 5](http://localhost:8000/?date=2026-12-05) unlocks doors 1–5. The override works only on loopback hosts and stays on the selected date. Remove the query parameter to use the current Pacific date. Previewing a door can update opened-door history on that local origin.

| Preview date | Expected |
| --- | --- |
| 2026-11-30 | All doors locked with a countdown |
| 2026-12-01 | Door 1 available and highlighted |
| 2026-12-12 | Doors 1–12 available, with door 12 highlighted |
| 2026-12-24 | All doors available, with door 24 highlighted |
| 2026-12-25 | All doors available with a Christmas greeting |

## Publish on GitHub Pages

1. Push the project files and QR images to the root of the repository's `main` branch.
2. In the repository's **Settings → Pages**, choose **Deploy from a branch** under **Source**.
3. Select **main** and **/(root)** and save. Once deployment finishes, open the site URL shown in Pages settings.

[GitHub Pages publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Reuse the calendar

Change `year` in `CONFIG` at the top of `calendar.js`, update the listening program and regenerate the PNGs, and use the new year in preview URLs. Each year has its own opened-door history.

To reset the current calendar without clearing other site data, open the browser console on the calendar page, remove its local storage key, and reload:

```js
localStorage.removeItem("advent-calendar:2026:opened")
```

Use the configured year in the key. Opened-door history is specific to the browser and site origin.

## Privacy and date locking

GitHub Pages serves the PNGs and track metadata as public static files. Visitors can inspect the source, request files directly, or change their device clock to bypass the calendar's date checks. Keep sensitive personal information out of the repository and QR codes.
