import puppeteer from "puppeteer";
import axe from "axe-core";

export async function runAccessibility(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setBypassCSP(true);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Inject axe-core into the page
    await page.addScriptTag({ content: axe.source });
    const results = await page.evaluate(async () => {
      // @ts-ignore
      return await axe.run({
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });
    });

    return {
      url,
      violations:
        results.violations?.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes?.slice(0, 10).map((n) => ({
            target: n.target,
            html: n.html,
            failureSummary: n.failureSummary,
          })),
        })) || [],
    };
  } finally {
    await browser.close();
  }
}
