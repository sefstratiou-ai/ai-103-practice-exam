import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { caseStudies, questions } from "../app/questions.ts";

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
  assert.match(html, /226 original questions · 51 per attempt · 9 code dropdowns/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("question bank has the intended blueprint distribution", () => {
  const ids = questions.map((question) => question.id);

  assert.deepEqual(ids, Array.from({ length: 226 }, (_, index) => index + 1));

  const expected = new Map([
    ["Plan and manage an Azure AI solution", 61],
    ["Implement generative AI and agentic solutions", 68],
    ["Implement computer vision solutions", 31],
    ["Implement text analysis solutions", 30],
    ["Implement information extraction solutions", 36],
  ]);

  for (const [domain, count] of expected) {
    assert.equal(
      questions.filter((question) => question.domain === domain).length,
      count,
      `${domain} should have ${count} questions`,
    );
  }

  for (const caseStudy of caseStudies) {
    assert.equal(
      questions.filter((question) => question.section === caseStudy.id).length,
      7,
    );
  }
  assert.equal(questions.filter((question) => question.section === "general").length, 165);
  assert.equal(questions.filter((question) => question.section === "decision").length, 12);
  assert.doesNotMatch(JSON.stringify(questions), /examtopics|actual exam dump|braindump/i);
});

test("starter preview is fully removed and the social card exists", async () => {
  assert.deepEqual(
    await readDirectoryIfPresent(new URL("../app/_sites-preview", import.meta.url)),
    [],
  );
  await access(new URL("../public/og-v2.png", import.meta.url));

  const [page, layout, packageJson, simulator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/ExamSimulator.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<ExamSimulator \/>/);
  assert.match(layout, /AI-103 Practice Exam/);
  assert.match(layout, /og-v2\.png/);
  assert.match(simulator, /Practice the pressure/);
  assert.match(simulator, /Full exam simulation/);
  assert.match(simulator, /Unofficial practice simulator/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);
});
