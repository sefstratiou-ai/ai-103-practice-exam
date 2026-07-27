import assert from "node:assert/strict";
import test from "node:test";
import {
  caseStudies,
  caseStudyIds,
  domains,
  questions,
} from "../app/questions";

test("all question definitions are internally consistent", () => {
  assert.equal(questions.length, 95);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.equal(new Set(questions.map((question) => question.stem)).size, questions.length);

  const typeCounts = new Map<string, number>();

  for (const question of questions) {
    typeCounts.set(question.type, (typeCounts.get(question.type) ?? 0) + 1);
    assert.ok(domains.includes(question.domain));
    assert.ok(question.objective.length >= 12);
    assert.ok(question.explanation.length >= 60);
    assert.match(question.source.url, /^https:\/\/learn\.microsoft\.com\//);

    if (question.type === "single") {
      const ids = question.options.map((option) => option.id);
      assert.ok(ids.includes(question.correct), `Question ${question.id} has a valid answer`);
      continue;
    }

    if (question.type === "multi") {
      const ids = question.options.map((option) => option.id);
      assert.equal(question.correct.length, question.selectCount);
      assert.equal(new Set(question.correct).size, question.correct.length);
      assert.ok(question.correct.every((id) => ids.includes(id)));
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

    const rowIds = question.rows.map((row) => row.id).sort();
    const columnIds = question.columns.map((column) => column.id);
    assert.deepEqual(Object.keys(question.correct).sort(), rowIds);
    assert.ok(Object.values(question.correct).every((id) => columnIds.includes(id)));
  }

  for (const type of ["single", "multi", "order", "match", "matrix"]) {
    assert.ok((typeCounts.get(type) ?? 0) > 0, `Question bank includes ${type} items`);
  }

  assert.deepEqual(caseStudies.map((caseStudy) => caseStudy.id), [...caseStudyIds]);
  for (const caseStudyId of caseStudyIds) {
    assert.equal(
      questions.filter((question) => question.section === caseStudyId).length,
      5,
      `${caseStudyId} contains five questions`,
    );
  }
  assert.equal(
    questions.filter((question) => question.section === "general").length,
    70,
  );
});
