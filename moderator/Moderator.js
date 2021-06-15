const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    args: [
      '--ignore-certificate-errors',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = await browser.newPage();
  await page.goto('https://localhost:3016/room/d0df1db9-cf63-47da-a68d-57d1fcbc4362/moderator');
  setTimeout(async () => {
    await page.screenshot({ path: 'example.png' });
    await browser.close();
  }, 5 * 1000);

})();