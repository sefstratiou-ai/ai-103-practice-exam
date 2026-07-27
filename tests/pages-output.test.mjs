import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);

test("GitHub Pages build produces a complete static entry point", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");
  const assets = await readdir(new URL("assets/", outputRoot));

  assert.match(html, /<title>AI-103 Practice Exam \| Azure AI Apps and Agents<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /src="\/assets\/[^\"]+\.js"/i);
  assert.match(html, /href="\/assets\/[^\"]+\.css"/i);
  assert.match(html, /content="\/og\.png"/i);
  assert.doesNotMatch(html, /__PAGES_|%BASE_URL%/);
  assert.ok(assets.some((name) => name.endsWith(".js")));
  assert.ok(assets.some((name) => name.endsWith(".css")));

  await Promise.all([
    access(new URL(".nojekyll", outputRoot)),
    access(new URL("favicon.svg", outputRoot)),
    access(new URL("og.png", outputRoot)),
  ]);
});
