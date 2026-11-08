# InvoicePilot
AI agent that turns one sentence into a real PayPal invoice, tracks it on a dashboard, and decides how to chase late payments.

## Run locally
1. Install Node.js 18+ (nodejs.org).
2. In this folder run: `npm install`
3. Copy `.env.example` to `.env` and fill the 4 values (see SETUP below).
4. Run `npm start`, open http://localhost:3000

## SETUP
**PayPal keys**
1. Go to https://developer.paypal.com and log in (create a free account if needed).
2. Open **Apps & Credentials**, make sure the **Sandbox** toggle is on.
3. Click **Create App**, name it InvoicePilot, type **Merchant**, click Create.
4. Copy **Client ID** and **Secret key** (click Show) into `.env`.
5. Open **Testing Tools > Sandbox Accounts**. Find the **Personal** account, copy its email into `DEFAULT_CLIENT_EMAIL`.

**AI key**: create one at https://console.anthropic.com/settings/keys and paste into `ANTHROPIC_API_KEY`.

## Deploy on Render (free)
1. Push this folder to a GitHub repo.
2. At https://render.com click **New > Web Service**, pick your repo.
3. Build command: `npm install`  Start command: `npm start`
4. Under **Environment**, add the 4 variables from `.env`.
5. Click **Create Web Service** and use the URL it gives you in Devpost.

## Demo script (2 min video)
1. Type: Invoice Ravi for $150 for logo design, due in 7 days, then click Create and send invoice.
2. Show the invoice in the grid as PENDING.
3. Click **AI chase** and read the tone the agent chose.
4. Click **Mark paid** and show Earned update with the AI summary.
Use USD amounts: PayPal sandbox is most reliable with USD.
