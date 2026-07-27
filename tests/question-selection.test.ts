import assert from "node:assert/strict";
import test from "node:test";

import { caseStudies, domains, questions } from "../app/questions";
import {
  CASE_STUDY_COUNT,
  createExamSelection,
  createExamSelectionFromIds,
  domainQuestionTargets,
  EXAM_QUESTION_COUNT,
  GENERAL_QUESTION_COUNT,
  QUESTIONS_PER_CASE_STUDY,
} from "../app/questionSelection";

test("an attempt selection is deterministic and blueprint balanced", () => {
  const first = createExamSelection(questions, caseStudies, 123_456);
  const repeated = createExamSelection(questions, caseStudies, 123_456);

  assert.deepEqual(first, repeated);
  assert.deepEqual(
    createExamSelectionFromIds(
      questions,
      caseStudies,
      first.questions.map((question) => question.id),
    ),
    first,
  );
  assert.equal(first.questions.length, EXAM_QUESTION_COUNT);
  assert.equal(
    new Set(first.questions.map((question) => question.id)).size,
    EXAM_QUESTION_COUNT,
  );
  assert.equal(first.caseStudies.length, CASE_STUDY_COUNT);
  assert.deepEqual(
    first.sectionOrder,
    [...first.caseStudies.map((caseStudy) => caseStudy.id), "general"],
  );

  for (const caseStudy of first.caseStudies) {
    assert.equal(
      first.questions.filter((question) => question.section === caseStudy.id).length,
      QUESTIONS_PER_CASE_STUDY,
    );
  }
  assert.equal(
    first.questions.filter((question) => question.section === "general").length,
    GENERAL_QUESTION_COUNT,
  );

  for (const domain of domains) {
    assert.equal(
      first.questions.filter((question) => question.domain === domain).length,
      domainQuestionTargets[domain],
      `${domain} should match its per-attempt target`,
    );
  }
});

test("different seeds expose broad variety from the complete pool", () => {
  const seenQuestionIds = new Set<number>();
  const seenCaseStudyIds = new Set<string>();
  const signatures = new Set<string>();

  for (let seed = 1; seed <= 200; seed += 1) {
    const selection = createExamSelection(questions, caseStudies, seed);
    selection.questions.forEach((question) => seenQuestionIds.add(question.id));
    selection.caseStudies.forEach((caseStudy) => seenCaseStudyIds.add(caseStudy.id));
    signatures.add(selection.questions.map((question) => question.id).join(","));
  }

  assert.equal(seenQuestionIds.size, questions.length);
  assert.equal(seenCaseStudyIds.size, caseStudies.length);
  assert.ok(signatures.size >= 190, "nearly every sampled seed should produce a distinct exam");
});
