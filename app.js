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

// Setup JWT middleware
app.use(
  expressjwt({ secret: publicKey, algorithms: ["RS256"] })
    .unless({ path: ["/"] })
);

// Setup cors middleware
const cors = require('cors');
app.use(cors({
  origin: '*'
}));

// Single and only valid route
app.get('/', async (_, res) => {
  res.send("Welcome on GestSIS Print");
});

const htmlToPdf = async (url, pageModifier) => {
  const browser = await puppeteer.launch(({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=BlockInsecurePrivateNetworkRequests'] }));
  const page = await browser.newPage();

  if (pageModifier) {
    await pageModifier(page);
  }

  const templateFooter = fs.readFileSync('templates/footer.html', 'utf-8')
  const templateHeader = fs.readFileSync('templates/header.html', 'utf-8')

  await page.goto(url, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    margin: { left: '1.5cm', top: '1cm', right: '0.5cm', bottom: '2cm' },
    displayHeaderFooter: true,
    headerTemplate: templateHeader,
    footerTemplate: templateFooter,
  });

  await browser.close();

  return pdf
}

const handlePrintRequest = async (req, res) => {
  const sisId = req.get("Sis-Id");
  if (!sisId) {
    res.status(401).json({ error: { message: "Missing SisId" } });
    return;
  }

  const authorization = req.get("Authorization");
  let url = decodeURIComponent(req.query.url);

  if (!url.startsWith(process.env.ALLOWED_HOST)) {
    res.status(401).json({ error: { message: "Invalid URL" } });
    return;
  }
  url = url.replace(process.env.ALLOWED_HOST, process.env.EFFECTIVE_BASE_URL)

  console.log("Loading : " + url);

  const pdf = await htmlToPdf(url, async (page) => {
    await page.setExtraHTTPHeaders({
      'sis-id': sisId,
      'authorization': authorization,
    });

    // TODO: Handle invalid response
    page.on('requestfailed', request => {
      console.log(`url: ${request.url()}, errText: ${request.failure().errorText}, method: ${request.method()}`)
    });
    page.on("pageerror", err => {
      console.log(`Page error: ${err.toString()}`);
    });
    page.on('console', msg => {
      console.log('Logger:', msg.type());
      console.log('Logger:', msg.text());
      console.log('Logger:', msg.location());
    });
  });

  console.log("PDF generated");
  res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdf.length })
  res.send(pdf)
}

app.get('/api/v1/print', handlePrintRequest);

app.listen(port, () => {
  console.log(`GestSIS Print listening on port ${port}`)
});
