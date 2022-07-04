const puppeteer = require('puppeteer');
const express = require('express');
const { expressjwt } = require("express-jwt");
require('dotenv').config();

const app = express();
const port = 3000;

// Set up JWT middleware
app.use(
  expressjwt({ secret: process.env.PUBLIC_KEY.replace("\\n", "\n"), algorithms: [process.env.PUBLIC_KEY_ALGORITHM] })
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
