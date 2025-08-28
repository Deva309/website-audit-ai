import puppeteer from "puppeteer";
import pLimit from "p-limit";

export async function checkMediaAssets({
  url,
  timeout = 30000,
  sameDomain = false,
  concurrency = 10,
}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(timeout);

  const broken = [];
  const found = [];

  try {
    // 1. Load page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });

    // 2. Click modal/play buttons safely
    const modalSelectors = [
      "button",
      "a",
      "[role='button']",
      "[data-toggle='modal']",
    ];
    for (const selector of modalSelectors) {
      const handles = await page.$$(selector);
      for (const handle of handles) {
        const text = (
          await page.evaluate((el) => el.innerText || "", handle)
        ).toLowerCase();
        if (/(play|watch|open|preview|video|show)/.test(text)) {
          try {
            await handle.click();
            await page.waitForTimeout(1500); // wait for modal/video to load
          } catch {
            // ignore failed clicks
          }
        }
      }
    }

    // 3. Extract media URLs
    const assets = await page.evaluate(() => {
      const collect = (selector, attr) =>
        Array.from(document.querySelectorAll(selector))
          .map((el) => el.getAttribute(attr))
          .filter(Boolean);

      return [
        ...collect("img", "src"),
        ...collect("video", "src"),
        ...Array.from(document.querySelectorAll("video source"))
          .map((el) => el.src)
          .filter(Boolean),
        ...collect("audio", "src"),
        ...Array.from(document.querySelectorAll("audio source"))
          .map((el) => el.src)
          .filter(Boolean),
        ...collect("iframe", "src"),
      ];
    });

    // 4. Normalize + deduplicate
    let uniqueUrls = [...new Set(assets)]
      .map((link) => {
        try {
          return new URL(link, url).toString();
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // 5. Optional: same-domain filter
    if (sameDomain) {
      const host = new URL(url).hostname;
      uniqueUrls = uniqueUrls.filter((u) => new URL(u).hostname === host);
    }

    // 6. Validate assets with concurrency & timeout
    const limit = pLimit(concurrency);
    await Promise.all(
      uniqueUrls.map((assetUrl) =>
        limit(async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          try {
            const res = await fetch(assetUrl, {
              method: "HEAD",
              redirect: "follow",
              signal: controller.signal,
            });
            if (!res.ok) broken.push({ url: assetUrl, status: res.status });
            else found.push({ url: assetUrl, status: res.status });
          } catch (e) {
            broken.push({ url: assetUrl, status: 0, error: e.message });
          } finally {
            clearTimeout(timer);
          }
        })
      )
    );
  } finally {
    await browser.close();
  }

  return { seed: url, found, broken };
}
