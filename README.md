# Mariah's Library

A React frontend hosted on GitHub Pages with a Google Sheet and Google Apps
Script web app as its backend.

The site is installable on an iPad Home Screen, keeps its interface available
offline, and prompts when a new version is ready. Archiving is a reversible
soft-delete: archived books keep their Book ID and checkout history and can be
restored from the Library screen.

## Required Google Sheet tabs

- `LIBRARY` — Barcode, Book ID, Title, Author, Publisher, Publication Year,
  Genre, Status, Borrower, Checkout Date, Due Date, Notes
- `CHECKOUT LOG` — Timestamp, Book ID, Title, Borrower, Action, Notes
- `BORROWERS` — Name

Names, spelling, and spaces must match exactly. Put the headers in row 1.

## Deploy the backend (required)

1. Open the Google Sheet, then **Extensions → Apps Script**.
2. Replace the editor contents with [`Code.gs`](./Code.gs) and save.
3. Select **Deploy → New deployment → Web app**.
4. Set **Execute as** to **Me** and **Who has access** to **Anyone**.
5. Deploy, authorize it, and copy the URL ending in `/exec`.
6. Put that URL in `SHEET_WEB_APP_URL` in `App.tsx`, or set the build variable
   `VITE_SHEET_WEB_APP_URL`.
7. Open `<your /exec URL>?tab=BORROWERS`. It must show JSON beginning with
   `{"success":true`, not a Google error page.

Whenever `Code.gs` changes, use **Deploy → Manage deployments → Edit**, choose
**New version**, and deploy again. Saving code alone does not update a deployment.
After deployment, open `<your /exec URL>?health=1`; the current backend returns
JSON identifying **Mariah's Library** and backend version **8**.

The production URL in `App.tsx` points to the verified Mariah's Library backend.
When deploying a replacement Apps Script version under a new URL, update that
value and verify all three tab endpoints before publishing the frontend.

## Development

```sh
npm install
npm run dev
```

Run `npm test` and `npm run build` before deploying. The Pages workflow deploys
`dist/` automatically after changes reach `main`.
