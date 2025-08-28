import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

export async function runPerformance(url) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const options = {
      logLevel: "info",
      output: "json",
      port: chrome.port,
      onlyCategories: ["performance", "seo", "best-practices"],
    };
    const runnerResult = await lighthouse(url, options);

    const { categories, audits } = runnerResult.lhr;
    return {
      url,
      scores: {
        performance: categories.performance?.score ?? null,
        seo: categories.seo?.score ?? null,
        bestPractices: categories["best-practices"]?.score ?? null,
      },
      metrics: {
        lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
        cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
        tbt: audits["total-blocking-time"]?.numericValue ?? null,
        fid: audits["max-potential-fid"]?.numericValue ?? null,
      },
      rawLhr: runnerResult.lhr,
    };
  } finally {
    await chrome.kill();
  }
}
