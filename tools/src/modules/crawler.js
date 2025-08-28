import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";

const DEFAULT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

const isHttpUrl = (u) => /^https?:\/\//i.test(u || "");
const stripFragment = (u) => u?.split("#")[0];
const sameDomain = (a, b) => {
  try {
    const A = new URL(a);
    const B = new URL(b);
    return A.hostname === B.hostname;
  } catch {
    return false;
  }
};
const toAbsolute = (base, href) => {
  if (!href) return null;
  href = href.trim();
  if (href.startsWith("javascript:")) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

export async function crawlSite({
  url,
  maxPages = 50,
  sameDomain: stay = true,
  concurrency = 5,
}) {
  const visited = new Set();
  const queue = [stripFragment(url)];
  const pages = [];
  const limit = pLimit(concurrency);

  async function fetchPage(target) {
    if (!target || visited.has(target)) return;
    visited.add(target);

    try {
      const resp = await axios.get(target, {
        timeout: 10000,
        headers: {
          "User-Agent": DEFAULT_UA,
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const html = resp.data || "";
      const $ = cheerio.load(html);
      const outLinks = new Set();
      const images = [];

      $("a[href]").each((_, el) => {
        const abs = toAbsolute(target, $(el).attr("href"));
        if (!isHttpUrl(abs)) return;
        const clean = stripFragment(abs);
        if (!clean) return;
        if (stay && !sameDomain(url, clean)) return;
        if (!visited.has(clean)) outLinks.add(clean);
      });

      $("img[src]").each((_, el) => {
        const src = toAbsolute(target, $(el).attr("src"));
        if (src) images.push(src);
      });

      pages.push({
        url: target,
        status: resp.status,
        title: $("title").text() || null,
        links: [...outLinks],
        images,
      });

      for (const l of outLinks) {
        if (visited.size + queue.length >= maxPages) break;
        queue.push(l);
      }
    } catch (e) {
      pages.push({
        url: target,
        status: e.response?.status || 0,
        error: e.message,
      });
    }
  }

  while (queue.length && visited.size < maxPages) {
    const batch = queue.splice(0, Math.min(concurrency, queue.length));
    await Promise.all(batch.map((t) => limit(() => fetchPage(t))));
  }

  return { seed: url, pages };
}
