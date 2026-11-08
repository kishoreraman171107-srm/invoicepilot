require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PP = process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';
const DB = path.join(__dirname, 'data.json');
const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const save = rows => fs.writeFileSync(DB, JSON.stringify(rows, null, 2));
const iso = d => new Date(d).toISOString().slice(0, 10);

// ---------- PayPal ----------
let tok = { v: null, exp: 0 };
async function ppToken() {
  if (tok.v && Date.now() < tok.exp) return tok.v;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r = await fetch(`${PP}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const j = await r.json();
  if (!r.ok) throw new Error('PayPal login failed. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.');
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return tok.v;
}
async function pp(method, url, body) {
  const r = await fetch(PP + url, {
    method,
    headers: { Authorization: `Bearer ${await ppToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  const j = t ? JSON.parse(t) : {};
  if (!r.ok) throw new Error(`PayPal ${r.status}: ${j.message || j.name || t}`);
  return j;
}

// ---------- AI (Groq) ----------
async function ai(system, user) {
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('AI error: ' + (j.error?.message || r.status));
  return j.choices[0].message.content;
}
const toJson = s => JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.log('ERROR:', e.message); res.status(500).json({ error: e.message }); });

// 1) Sentence -> structured invoice
app.post('/api/parse', wrap(async (req, res) => {
  const out = await ai(
    'Extract invoice details from the freelancer\'s sentence. Reply ONLY with JSON: {"client_name":"","client_email":"","description":"","amount":0,"currency":"USD","due_days":7}. Use USD unless another currency is clearly stated. Use "" if no email is given.',
    req.body.text);
  res.json(toJson(out));
}));

// 2) Create a PayPal payment request (Orders API) with a checkout link
app.post('/api/invoices', wrap(async (req, res) => {
  const d = req.body, cur = d.currency || 'USD', value = Number(d.amount).toFixed(2);
  const base = `${req.protocol}://${req.get('host')}`;
  const order = await pp('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{ description: String(d.description).slice(0, 120), amount: { currency_code: cur, value } }],
    payment_source: { paypal: { experience_context: { user_action: 'PAY_NOW', return_url: base + '/?paid=1', cancel_url: base + '/' } } }
  });
  const link = (order.links.find(l => l.rel === 'payer-action') || order.links.find(l => l.rel === 'approve'))?.href;
  const rows = load();
  rows.unshift({
    id: order.id, number: 'INV-' + String(rows.length + 1).padStart(3, '0'),
    client: d.client_name || 'Client', email: d.client_email || '', description: d.description,
    amount: Number(value), currency: cur, due: iso(Date.now() + (d.due_days ?? 7) * 864e5), link, paid: false
  });
  save(rows);
  res.json({ id: order.id, link });
}));

// 3) Dashboard data. Also checks PayPal: if the client approved, capture the payment.
app.get('/api/invoices', wrap(async (req, res) => {
  const rows = load(), today = iso(Date.now());
  for (const r of rows.filter(x => !x.paid)) {
    try {
      const o = await pp('GET', `/v2/checkout/orders/${r.id}`);
      if (o.status === 'APPROVED') { await pp('POST', `/v2/checkout/orders/${r.id}/capture`, {}); r.paid = true; }
      else if (o.status === 'COMPLETED') r.paid = true;
    } catch (e) { console.log('Status check failed:', r.id, e.message); }
  }
  save(rows);
  res.json(rows.map(r => ({ ...r, status: r.paid ? 'PAID' : r.due < today ? 'OVERDUE' : 'PENDING' })));
}));

// 4) The agent: picks a tone from how late the payment is and writes the message
app.post('/api/chase/:id', wrap(async (req, res) => {
  const r = load().find(x => x.id === req.params.id);
  if (!r) throw new Error('Invoice not found');
  const days = Math.floor((Date.now() - new Date(r.due)) / 864e5);
  const out = await ai(
    'You are a payment-collection agent for a freelancer. Choose tone: "friendly" if not yet due or up to 3 days late, "firm" for 4-14 days late, "final" beyond that. Reply ONLY with JSON: {"tone":"","reason":"<one short sentence>","subject":"","note":"<max 60 words, polite, mention amount and due date, do not include any link>"}.',
    JSON.stringify({ client: r.client, amount: `${r.currency} ${r.amount}`, description: r.description, due: r.due, days_overdue: days }));
  res.json({ ...toJson(out), link: r.link, email: r.email });
}));

// 5) AI summary
app.post('/api/insight', wrap(async (req, res) => {
  const text = await ai('You are a friendly finance assistant. In 2 short sentences, summarise these invoices for a freelancer and say what to do next.', JSON.stringify(req.body.rows.map(r => ({ client: r.client, amount: r.amount, due: r.due, status: r.status }))));
  res.json({ text });
}));

app.listen(process.env.PORT || 3000, () => console.log('InvoicePilot running'));
