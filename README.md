# NSWMA Data Parser (WCIS)

Desktop tool that turns WhatsApp collection reports into a weekly collection sheet.
Everything runs locally; report text never leaves the computer.

## Workflow

The sidebar follows the order you work in:

1. **Import reports** – drop exported WhatsApp `.txt` chats or paste report text, then parse.
2. **Check results** – every extracted district, filterable by match status.
3. **Fix matches** – a queue of districts the parser couldn't place. Approving a suggestion saves the spelling as an alias for next time.
4. **Weekly sheet** – per-district collections by week; edit cells, flag rows, export to Excel or PDF.

The **working period** bar at the top sets the month and weeks for every screen and export.
**Analytics** and **Map** summarise the period, and **Zones & districts** holds the master list the parser matches against.

## Running

- Browser: serve the folder (for example `python3 -m http.server`) and open `index.html`.
- Desktop: `npm install` then `npm start` (Electron). `npm run dist:win` builds the Windows installer.

Third-party libraries (Leaflet, SheetJS) are vendored in `vendor/` so the app works offline; only map tiles need a connection.
