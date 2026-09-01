import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  caseStudies,
  caseStudyIds,
  domains,
  questions,
} from "../app/questions";
import { distractorTextOverrides } from "../app/questionEnhancements";
import { skillCatalog } from "../app/questionBank/metadata";

test("all question definitions are internally consistent", () => {
  assert.equal(questions.length, 226);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.equal(new Set(questions.map((question) => question.stem)).size, questions.length);

  const typeCounts = new Map<string, number>();

  for (const question of questions) {
    typeCounts.set(question.type, (typeCounts.get(question.type) ?? 0) + 1);
    assert.ok(domains.includes(question.domain));
    assert.ok(question.objective.length >= 12);
    assert.ok(question.explanation.length >= 60);
    assert.ok(question.skillId && question.skillId in skillCatalog);
    assert.ok((question.topicTags?.length ?? 0) > 0);
    assert.match(question.lastVerified ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.ok((question.variantGroup?.length ?? 0) >= 8);
    assert.ok(question.lifecycle === "ga" || question.lifecycle === "preview");
    assert.match(question.source.url, /^https:\/\/learn\.microsoft\.com\//);
    assert.notEqual(
      question.source.label,
      "AI-103 study guide",
      `Question ${question.id} should cite capability-specific documentation`,
    );

    if (question.type === "single") {
      const ids = question.options.map((option) => option.id);
      assert.ok(ids.includes(question.correct), `Question ${question.id} has a valid answer`);
      assert.ok(question.options.every((option) => (option.rationale?.length ?? 0) >= 40));
      continue;
    }

    if (question.type === "multi") {
      const ids = question.options.map((option) => option.id);
      assert.equal(question.correct.length, question.selectCount);
      assert.equal(new Set(question.correct).size, question.correct.length);
      assert.ok(question.correct.every((id) => ids.includes(id)));
      assert.ok(question.options.every((option) => (option.rationale?.length ?? 0) >= 40));
      continue;
    }

    if (question.type === "order") {
      const ids = question.options.map((option) => option.id).sort();
      assert.deepEqual([...question.correct].sort(), ids);
      continue;
    }

    if (question.type === "match") {
      const promptIds = question.prompts.map((prompt) => prompt.id).sort();
      const choiceIds = question.choices.map((choice) => choice.id);
      assert.deepEqual(Object.keys(question.correct).sort(), promptIds);
      assert.ok(Object.values(question.correct).every((id) => choiceIds.includes(id)));
      continue;
    }

    if (question.type === "code") {
      const blankIds = question.blanks.map((blank) => blank.id);
      const placeholders = [...question.code.matchAll(/\{\{([^}]+)\}\}/g)].map(
        (match) => match[1],
      );
      assert.ok(["python", "json", "azurecli", "http"].includes(question.language));
      assert.equal(new Set(blankIds).size, blankIds.length);
      assert.deepEqual([...placeholders].sort(), [...blankIds].sort());
      assert.deepEqual(Object.keys(question.correct).sort(), [...blankIds].sort());
      for (const blank of question.blanks) {
        const optionIds = blank.options.map((option) => option.id);
        assert.equal(new Set(optionIds).size, optionIds.length);
        assert.ok(optionIds.includes(question.correct[blank.id]));
        assert.ok(blank.options.every((option) => (option.rationale?.length ?? 0) >= 40));
        assert.equal(
          question.code.split(`{{${blank.id}}}`).length - 1,
          1,
          `Question ${question.id} should render blank ${blank.id} exactly once`,
        );
      }
      continue;
    }

    if (question.type === "decision") {
      assert.ok(question.correct === "yes" || question.correct === "no");
      continue;
    }

    const rowIds = question.rows.map((row) => row.id).sort();
    const columnIds = question.columns.map((column) => column.id);
    assert.deepEqual(Object.keys(question.correct).sort(), rowIds);
    assert.ok(Object.values(question.correct).every((id) => columnIds.includes(id)));
  }

  for (const type of ["single", "multi", "order", "match", "matrix", "decision", "code"]) {
    assert.ok((typeCounts.get(type) ?? 0) > 0, `Question bank includes ${type} items`);
  }

  assert.deepEqual(caseStudies.map((caseStudy) => caseStudy.id), [...caseStudyIds]);
  for (const caseStudyId of caseStudyIds) {
    assert.equal(
      questions.filter((question) => question.section === caseStudyId).length,
      7,
      `${caseStudyId} contains seven questions`,
    );
  }
  assert.equal(
    questions.filter((question) => question.section === "general").length,
    165,
  );
  assert.equal(
    questions.filter((question) => question.section === "decision").length,
    12,
  );
  const decisionSets = new Map<string, typeof questions>();
  for (const question of questions.filter((item) => item.type === "decision")) {
    const decisionSetId = question.decisionSetId ?? "";
    decisionSets.set(decisionSetId, [
      ...(decisionSets.get(decisionSetId) ?? []),
      question,
    ]);
  }
  assert.equal(decisionSets.size, 4);
  for (const [decisionSetId, items] of decisionSets) {
    assert.ok(decisionSetId);
    assert.equal(items.length, 3, `${decisionSetId} contains three linked decisions`);
  }
});

test("the expanded code bank covers every domain and varied blank counts", () => {
  const codeQuestions = questions.filter(
    (question): question is Extract<(typeof questions)[number], { type: "code" }> =>
      question.type === "code",
  );

  assert.equal(codeQuestions.length, 42);
  assert.deepEqual(
    Object.fromEntries(
      ["python", "json", "http", "azurecli"].map((language) => [
        language,
        codeQuestions.filter((question) => question.language === language).length,
      ]),
    ),
    { python: 18, json: 12, http: 8, azurecli: 4 },
  );
  assert.ok(codeQuestions.some((question) => question.blanks.length === 2));
  assert.ok(codeQuestions.some((question) => question.blanks.length === 3));
  for (const domain of domains) {
    assert.ok(codeQuestions.some((question) => question.domain === domain));
  }
  for (const language of ["python", "json", "azurecli", "http"] as const) {
    assert.ok(codeQuestions.some((question) => question.language === language));
  }
  for (const caseStudyId of caseStudyIds) {
    assert.ok(
      codeQuestions.some((question) => question.section === caseStudyId),
      `${caseStudyId} should include a code-dropdown item`,
    );
  }
});

test("selected-response distractors are deliberately rewritten and avoid answer-length clues", () => {
  for (const question of questions) {
    if (question.type !== "single" && question.type !== "multi") continue;
    const correctIds = new Set(
      question.type === "single" ? [question.correct] : question.correct,
    );

    if (question.id <= 130) {
      for (const option of question.options.filter((item) => !correctIds.has(item.id))) {
        assert.ok(
          distractorTextOverrides[question.id]?.[option.id],
          `question ${question.id}, option ${option.id} needs a targeted distractor rewrite`,
        );
      }
    }

    if (question.type === "single") {
      const correctLength = question.options.find(
        (option) => option.id === question.correct,
      )!.text.length;
      const meanLength = question.options.reduce(
        (sum, option) => sum + option.text.length,
        0,
      ) / question.options.length;
      assert.ok(
        correctLength / meanLength >= 0.45 && correctLength / meanLength <= 1.65,
        `question ${question.id} should not reveal the answer through option length`,
      );
      continue;
    }

    const correctOptions = question.options.filter((option) => correctIds.has(option.id));
    const distractors = question.options.filter((option) => !correctIds.has(option.id));
    const correctMean = correctOptions.reduce(
      (sum, option) => sum + option.text.length,
      0,
    ) / correctOptions.length;
    const distractorMean = distractors.reduce(
      (sum, option) => sum + option.text.length,
      0,
    ) / distractors.length;
    assert.ok(
      correctMean / distractorMean >= 0.58 && correctMean / distractorMean <= 1.7,
      `question ${question.id} should not reveal the correct set through option length`,
    );
  }
});

test("question stems do not contain near-duplicate scenarios", () => {
  const tokens = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/ +/)
        .filter((token) => token.length > 2),
    );

  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      const left = tokens(questions[leftIndex].stem);
      const right = tokens(questions[rightIndex].stem);
      const intersection = [...left].filter((token) => right.has(token)).length;
      const union = new Set([...left, ...right]).size;
      assert.ok(
        intersection / union < 0.85,
        `questions ${questions[leftIndex].id} and ${questions[rightIndex].id} are too similar`,
      );
    }
  }
});

test("correct JSON code completions parse successfully", () => {
  const jsonQuestions = questions.filter(
    (question): question is Extract<(typeof questions)[number], { type: "code" }> =>
      question.type === "code" && question.language === "json",
  );

  for (const question of jsonQuestions) {
    const completed = question.code.replace(/\{\{([^}]+)\}\}/g, (_, blankId: string) => {
      const blank = question.blanks.find((item) => item.id === blankId)!;
      return blank.options.find((option) => option.id === question.correct[blankId])!.text;
    });
    assert.doesNotThrow(
      () => JSON.parse(completed),
      `question ${question.id} should produce valid JSON when completed correctly`,
    );
  }
});

test("correct Python code completions parse successfully when Python is available", (context) => {
  const candidates = [
    { command: "python", prefix: [] as string[] },
    { command: "python3", prefix: [] as string[] },
    { command: "py", prefix: ["-3"] },
  ];
  const runtime = candidates.find(({ command, prefix }) =>
    spawnSync(command, [...prefix, "--version"], { encoding: "utf8" }).status === 0,
  );
  if (!runtime) {
    context.skip("Python is not installed; JSON and placeholder validation still run.");
    return;
  }

  const pythonQuestions = questions.filter(
    (question): question is Extract<(typeof questions)[number], { type: "code" }> =>
      question.type === "code" && question.language === "python",
  );
  for (const question of pythonQuestions) {
    const completed = question.code.replace(/\{\{([^}]+)\}\}/g, (_, blankId: string) => {
      const blank = question.blanks.find((item) => item.id === blankId)!;
      return blank.options.find((option) => option.id === question.correct[blankId])!.text;
    });
    const parsed: ReturnType<typeof spawnSync> = spawnSync(
      runtime.command,
      [...runtime.prefix, "-c", "import ast,sys; ast.parse(sys.stdin.read())"],
      { input: completed, encoding: "utf8" },
    );
    assert.equal(
      parsed.status,
      0,
      `question ${question.id} should produce valid Python: ${parsed.stderr}`,
    );
  }
});

test("case studies reproduce a substantial reading workload", () => {
  for (const caseStudy of caseStudies) {
    const paragraphs = caseStudy.tabs.flatMap((tab) => tab.content);
    const wordCount = paragraphs.join(" ").trim().split(/\s+/).length;

    assert.ok(
      paragraphs.length >= 12 && paragraphs.length <= 16,
      `${caseStudy.id} should contain 12 to 16 paragraphs`,
    );
    assert.ok(
      wordCount >= 600 && wordCount <= 900,
      `${caseStudy.id} should contain 600 to 900 words, received ${wordCount}`,
    );
  }
});
