const puppeteer = require('puppeteer');
const express = require('express');
const { expressjwt } = require("express-jwt");
const fs = require('fs');
require('dotenv').config();

let publicKey = "";
try {
    publicKey = fs.readFileSync('keys/auth-public.key', 'utf8');
    console.log(publicKey)
} catch (err) {
    console.error(err);
}

// (async () => {

//     const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
//     const page = await browser.newPage();

//     await page.goto("https://apis.gestsis.ch");
//     const pdf = await page.pdf({ format: 'A4' });

//     await browser.close();

//     console.log(pdf);
// })()