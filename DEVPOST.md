# Devpost text (paste into the submission form)
**Name:** InvoicePilot
**Tagline:** An AI agent that bills your clients through PayPal and chases the money for you.

**Inspiration:** Freelancers and students lose income not because they can't work, but because they can't chase late payments. It is awkward and time-consuming.

**What it does:** Type one sentence like "Invoice Ravi for $150 for logo design, due in 7 days". InvoicePilot extracts the details with AI, creates and sends a real PayPal invoice, and tracks it on a live dashboard (earned, pending, overdue). For unpaid invoices the agent decides on its own how to follow up, friendly, firm or final, based on how late it is, writes the message, and sends it as a PayPal reminder. An AI summary tells the freelancer what to do next.

**How we built it:** Node.js and Express backend, PayPal Invoicing REST API (sandbox), an LLM for parsing, decision making and writing, an AG Grid dashboard, deployed on Render.

**Challenges:** Making the agent's tone decisions reliable and turning free text into valid invoice data.

**What's next:** Auto-scheduled reminders, multi-currency, WhatsApp reminders, payment-risk scoring per client.

**Built with:** PayPal Invoicing API, AI (LLM), Node.js, Express, AG Grid, Render
