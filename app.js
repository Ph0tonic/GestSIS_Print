const puppeteer = require('puppeteer');
const express = require('express');
const { expressjwt } = require("express-jwt");
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 3000;

let publicKey = "";
try {
  publicKey = fs.readFileSync('keys/auth-public.key', 'utf8');
} catch (err) {
  console.error(err);
}

// Set up JWT middleware
app.use(
  expressjwt({ secret: publicKey, algorithms: ["RS256"] })
    .unless({ path: ["/"] })
);

// Single and only valid route
app.get(
  '/',
  async (_, res) => {
    res.send("Welcome on GestSIS Print");
  }
);
app.get(
  '/print',
  async (req, res) => {

    const sisId = req.get("Sis-Id");
    if (!sisId) {
      res.status(401).json({ error: { message: "Missing SisId" } });
      return;
    }

    const authorization = req.get("Authorization");
    const url = decodeURI(req.query.url);
    if (!url.startsWith(process.env.ALLOWED_HOST)) {
      res.status(401).json({ error: { message: "Invalid URL" } });
      return;
    }
    const browser = await puppeteer.launch(({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }));
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Sis-Id': sisId,
      'Authorization': authorization,
    });

    await page.goto(url, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4' });

    await browser.close();

    res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdf.length })
    res.send(pdf)
  }
);

app.listen(port, () => {
  console.log(`GestSIS Print listening on port ${port}`)
});
