import "./instrument.mjs";

import puppeteer from "puppeteer";
import { Mutex } from "async-mutex";
import express from "express";
import { expressjwt } from "express-jwt";
import bodyParser from "body-parser";
import fs from "fs";
import "dotenv/config";
import * as Sentry from "@sentry/node";

const port = 3000;
const app = express();

app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// Single and only valid route
app.get("/", async (_, res) => {
  res.send("Welcome on GestSIS Print MJS");
});

const mutex = new Mutex();
let browser = null;
let count = 0;

const launchBroswer = async () => {
  await mutex.runExclusive(async () => {
    // Initialize our resource
    if (count === 0) {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-security",
          "--disable-features=BlockInsecurePrivateNetworkRequests",
        ],
      });
    }
    count += 1;
  });
  return browser;
};

const closeBrowser = async () => {
  await mutex.runExclusive(async () => {
    count -= 1;
    if (count === 0) {
      await browser.close();
      browser = null;
    }
  });
};

const htmlToPdf = async (
  pageLoader,
  pageModifier,
  options = {},
  baseUrl = "",
  sisId = ""
) => {
  const browser = await launchBroswer();
  const page = await browser.newPage();

  if (pageModifier) {
    await pageModifier(page);
  }

  const timestamp = new Date().getTime();
  const imageUrl = baseUrl + "/api/v2/sis-logo/" + sisId + "?t=" + timestamp;
  const imageUrlData = await fetch(imageUrl);
  const buffer = await imageUrlData.arrayBuffer();
  const stringifiedBuffer = Buffer.from(buffer).toString("base64");
  const contentType = imageUrlData.headers.get("content-type");
  const imageBase64 = `<img class="header-logo" src="data:image/${contentType};base64,${stringifiedBuffer}" />`;
  const templateLogoHeader =
    '<html><head><style type="text/css">#header { padding: 0; margin: 0; } .content-header { width: 100%; color: black; padding: 2px; padding-top: 5px; margin-top: 0.2cm; margin-left: 1.2cm; margin-right: 0.5cm; margin-bottom: 0.5cm; font-size: 8px; } .header-logo { max-width: 5cm; max-height: 1.5cm; } </style></head><body><div class="content-header">' +
    imageBase64 +
    "</div></body></html>";

  const templateHeader = options.noHeader
    ? fs.readFileSync("templates/empty.html", "utf-8")
    : templateLogoHeader;
  const templateFooter = fs.readFileSync(
    options.noFooter ? "templates/empty.html" : "templates/footer.html",
    "utf-8"
  );

  await pageLoader(page);
  const pdf = await page.pdf({
    format: "A4",
    margin: { left: "1.5cm", top: "2cm", right: "0.5cm", bottom: "2cm" },
    displayHeaderFooter: true,
    headerTemplate: templateHeader,
    footerTemplate: templateFooter,
  });

  await page.close();
  await closeBrowser();

  return Buffer.from(pdf);
};

const handleGetPrintRequest = async (req, res) => {
  const sisId = req.get("Sis-Id");
  if (!sisId) {
    res.status(401).json({ error: { message: "Missing SisId" } });
    return;
  }

  const authorization = req.get("Authorization");
  let url = decodeURIComponent(req.query.url);
  const options = {
    noFooter: req.query["no-footer"] === "true",
    noHeader: req.query["no-header"] === "true",
  };
  if (!url.startsWith(process.env.ALLOWED_HOST)) {
    res.status(401).json({ error: { message: "Invalid URL" } });
    return;
  }
  url = url.replace(process.env.ALLOWED_HOST, process.env.EFFECTIVE_BASE_URL);
  console.log("Requesting : " + url);

  const pageModifier = async (page) => {
    await page.setExtraHTTPHeaders({
      "sis-id": sisId,
      authorization: authorization,
    });

    // TODO: Handle invalid response
    page.on("requestfailed", (request) => {
      console.log(
        `url: ${request.url()}, errText: ${
          request.failure().errorText
        }, method: ${request.method()}`
      );
    });
    page.on("pageerror", (err) => {
      console.log(`Page error: ${err.toString()}`);
    });
    page.on("console", (msg) => {
      console.log("Logger:", msg.type());
      console.log("Logger:", msg.text());
      console.log("Logger:", msg.location());
    });
  };

  const pageLoader = async (page) => {
    console.log("Page loader, GOTO : " + url);
    return page.goto(url, { waitUntil: "networkidle0" });
  };

  const pdf = await htmlToPdf(
    pageLoader,
    pageModifier,
    options,
    process.env.EFFECTIVE_BASE_URL,
    sisId
  );

  console.log("PDF generated");
  res.set({ "Content-Type": "application/pdf", "Content-Length": pdf.length });
  res.send(pdf);
};

const handlePostPrintRequest = async (req, res) => {
  const options = {
    // noFooter: req.body["no-footer"] === "true",
    // noHeader: req.body["no-header"] === "true",
  };
  console.log(req.body);
  const content = req.body.content;

  const pageModifier = async (page) => {
    page.on("requestfailed", (request) => {
      console.log(
        `url: ${request.url()}, errText: ${
          request.failure().errorText
        }, method: ${request.method()}`
      );
    });
    page.on("pageerror", (err) => {
      console.log(`Page error: ${err.toString()}`);
    });
    page.on("console", (msg) => {
      console.log("Logger:", msg.type());
      console.log("Logger:", msg.text());
      console.log("Logger:", msg.location());
    });
  };

  const pageLoader = async (page) => {
    console.log("Page loader, SET_CONTENT");
    return page.setContent(content, { waitUntil: "networkidle0" });
  };

  const pdf = await htmlToPdf(pageLoader, pageModifier, options);

  console.log("PDF generated");
  res.set({ "Content-Type": "application/pdf", "Content-Length": pdf.length });
  res.send(pdf);
};

app.get("/api/v1/print", handleGetPrintRequest);

// create application/json parser
var jsonParser = bodyParser.json();
app.post("/api/v1/print", jsonParser, handlePostPrintRequest);

Sentry.setupExpressErrorHandler(app);

let publicKey = "";
try {
  publicKey = fs.readFileSync("keys/auth-public.key", "utf8");
} catch (err) {
  console.error(err);
}

// Setup JWT middleware
app.use(
  expressjwt({ secret: publicKey, algorithms: ["RS256"] }).unless({
    path: ["/"],
  })
);

// Setup cors middleware
import cors from "cors";

app.use(
  cors({
    origin: "*",
  })
);

app.listen(port, () => {
  console.log(`GestSIS Print listening on port ${port}`);
});
