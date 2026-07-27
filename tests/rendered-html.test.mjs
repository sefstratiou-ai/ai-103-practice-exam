import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function readDirectoryIfPresent(url) {
  try {
    return await readdir(url);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the AI-103 practice entry screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>AI-103 Practice Exam \| Azure AI Apps and Agents<\/title>/i);
  assert.match(html, /Preparing your practice environment/);
  assert.match(html, /ExamSimulator-/);
  assert.match(html, /95 original questions · 50 per attempt · 5 skill domains/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("question bank has the intended blueprint distribution", async () => {
  const source = await readFile(new URL("../app/questions.ts", import.meta.url), "utf8");
  const ids = [...source.matchAll(/^\s+id: (\d+),$/gm)].map((match) => Number(match[1]));

  assert.deepEqual(ids, Array.from({ length: 95 }, (_, index) => index + 1));

  const expected = new Map([
    ["Plan and manage an Azure AI solution", 25],
    ["Implement generative AI and agentic solutions", 30],
    ["Implement computer vision solutions", 13],
    ["Implement text analysis solutions", 13],
    ["Implement information extraction solutions", 14],
  ]);

  for (const [domain, count] of expected) {
    const matches = source.match(new RegExp(`domain: \\"${domain}\\"`, "g")) ?? [];
    assert.equal(matches.length, count, `${domain} should have ${count} questions`);
  }

  assert.equal((source.match(/section: "northwind"/g) ?? []).length, 5);
  assert.equal((source.match(/section: "alpine"/g) ?? []).length, 5);
  assert.equal((source.match(/section: "fabrikam"/g) ?? []).length, 5);
  assert.equal((source.match(/section: "contoso"/g) ?? []).length, 5);
  assert.equal((source.match(/section: "woodgrove"/g) ?? []).length, 5);
  assert.equal((source.match(/section: "general"/g) ?? []).length, 70);
  assert.doesNotMatch(source, /examtopics|actual exam dump|braindump/i);
});

test("starter preview is fully removed and the social card exists", async () => {
  assert.deepEqual(
    await readDirectoryIfPresent(new URL("../app/_sites-preview", import.meta.url)),
    [],
  );
  await access(new URL("../public/og.png", import.meta.url));

  const [page, layout, packageJson, simulator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/ExamSimulator.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<ExamSimulator \/>/);
  assert.match(layout, /AI-103 Practice Exam/);
  assert.match(layout, /og\.png/);
  assert.match(simulator, /Practice the pressure/);
  assert.match(simulator, /Full exam simulation/);
  assert.match(simulator, /Unofficial practice simulator/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);
});
