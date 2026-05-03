import express from "express";
import { crawlSite } from "./modules/crawler.js";
import { runSEOChecks } from "./modules/seo.js";
import { runAccessibility } from "./modules/accessibility.js";
import { runPerformance } from "./modules/performance.js";
import { checkMediaAssets } from "./modules/assets.js";
import { getPullRequestDiff } from "./modules/github/pr.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// Crawl (BFS + concurrency)
app.post("/crawl", async (req, res) => {
  const {
    url,
    maxPages = 50,
    sameDomain = true,
    concurrency = 5,
  } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const data = await crawlSite({ url, maxPages, sameDomain, concurrency });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SEO audit for a single URL (HTML parsed from live page)
app.post("/audit/seo", async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const report = await runSEOChecks(url);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Accessibility audit via puppeteer + axe-core
app.post("/audit/accessibility", async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const report = await runAccessibility(url);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Performance audit via Lighthouse
app.post("/audit/performance", async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const report = await runPerformance(url);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Check broken assets/links
app.post("/audit/assets", async (req, res) => {
  const {
    url,
    maxPages = 50,
    sameDomain = true,
    concurrency = 5,
  } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const report = await checkMediaAssets({
      url,
      maxPages,
      sameDomain,
      concurrency,
    });
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Full audit for first N pages
app.post("/audit/full", async (req, res) => {
  const { url, maxPages = 20, concurrency = 5 } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    const crawl = await crawlSite({
      url,
      maxPages,
      concurrency,
      sameDomain: true,
    });
    const pages = crawl.pages.map((p) => p.url);

    const [perf, a11y] = await Promise.all([
      runPerformance(url).catch(() => null),
      runAccessibility(url).catch(() => null),
    ]);

    const seoResults = [];
    for (const p of pages) {
      try {
        seoResults.push(await runSEOChecks(p));
      } catch {}
    }

    const assets = await checkMediaAssets({
      url,
      maxPages,
      concurrency,
      sameDomain: true,
    }).catch(() => null);

    res.json({
      crawl,
      performance: perf,
      accessibility: a11y,
      seo: seoResults,
      assets,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch GitHub Pull Request diff
app.post("/github/pr-diff", async (req, res) => {
  const { owner, repo, pr_no } = req.body || {};
  if (!owner || !repo || !pr_no) {
    return res
      .status(400)
      .json({ error: "owner, repo, and pr_no are required in request body" });
  }
  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: "GITHUB_TOKEN is not set" });
  }
  try {
    const diff = await getPullRequestDiff({ owner, repo, pr_no });
    res.type("text/plain").send(diff);
  } catch (e) {
    res.status(e.message.includes("GitHub API error") ? parseInt(e.message.split(": ")[1]) || 500 : 500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`MCP Tools API listening on :${PORT}`));
