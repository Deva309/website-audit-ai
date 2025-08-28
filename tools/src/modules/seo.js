import axios from "axios";
import * as cheerio from "cheerio";

export async function runSEOChecks(url) {
  const { data: html, status } = await axios.get(url, { timeout: 10000 });
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim();
  const canonical = $('link[rel="canonical"]').attr("href") || null;
  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get();
  const robots = $('meta[name="robots"]').attr("content") || null;
  const lang = $("html").attr("lang") || null;

  return {
    url,
    status,
    title: title || null,
    description: description || null,
    canonical,
    h1,
    robots,
    lang,
    issues: [
      !title && "Missing <title>",
      !description && "Missing meta description",
      h1.length === 0 && "Missing <h1>",
      h1.length > 1 && "Multiple <h1> elements",
      !canonical && "Missing canonical link",
      !lang && "Missing <html lang> attribute",
    ].filter(Boolean),
  };
}
