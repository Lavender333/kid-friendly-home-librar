# Kid-Friendly Home Library

A React frontend hosted on GitHub Pages with a Google Sheet and Google Apps
Script web app as its backend.

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

The URL currently in `App.tsx` is stale and returns `Script function not found:
doGet`; redeploy the script before the site can load data.

## Development

```sh
npm install
npm run dev
```

Run `npm test` and `npm run build` before deploying. The Pages workflow deploys
`dist/` automatically after changes reach `main`.
