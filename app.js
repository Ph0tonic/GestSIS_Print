const puppeteer = require('puppeteer');
const express = require('express');
import jwt_decode from "jwt-decode";

const browser = await puppeteer.launch({
  headless: true,
});

const app = express();
const port = 3000;

app.get('/', async (req, res) => {

  const sisId = req.get("Sis-Id");
  const authorization = req.get("Authorization");

  // Check authorization
  if (!authorization || !authorization.startsWith("bearer ")) {
    res.status(401).json({ error: { message: "Invalid authorization header" } });
    return;
  }
  const split = authorization.split(" ");
  if (split.length != 2) {
    res.status(401).json({ error: { message: "Invalid authorization header" } });
    return;
  }

  try {
    jwt_decode(split[1]);
  } catch (err) {
    res.status(401).json({ error: { message: "Invalid JWT token" } });
    return;
  }

  const url = decodeURI(req.query.url);
  if (!url.startsWith("https://apis.gestsis.ch/")) {
    res.status(401).json({ error: { message: "Invalid URL" } });
    return;
  }
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'Sis-Id': sisId,
    'Authorization': authorization,
  });

  await page.goto(url);
  const pdf = await page.pdf({ format: 'A4' });

  await browser.close();

  res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdf.length })
  res.send(pdf)
});

app.listen(port, () => {
  console.log(`GestSIS Print listening on port ${port}`)
});
