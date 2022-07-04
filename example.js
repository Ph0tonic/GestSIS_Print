const puppeteer = require('puppeteer');
const express = require('express');
const { expressjwt } = require("express-jwt");
require('dotenv').config();

(async () => {

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.goto("https://apis.gestsis.ch");
    const pdf = await page.pdf({ format: 'A4' });

    await browser.close();

    console.log(pdf);
})()