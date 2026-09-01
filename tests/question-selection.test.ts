import assert from "node:assert/strict";
import test from "node:test";

import { caseStudies, domains, questions } from "../app/questions";
import {
  createEmptySelectionHistory,
  recordExamSelection,
} from "../app/questionHistory";
import {
  CASE_STUDY_COUNT,
  createExamSelection,
  createExamSelectionFromIds,
  DECISION_QUESTION_COUNT,
  domainQuestionTargets,
  EXAM_QUESTION_COUNT,
  formatQuestionTargets,
  GENERAL_QUESTION_COUNT,
  getQuestionFormatGroup,
  INTERACTIVE_QUESTION_COUNT,
  isInteractiveQuestion,
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
    ["general", ...first.caseStudies.map((caseStudy) => caseStudy.id), "decision"],
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
  assert.equal(
    first.questions.filter((question) => question.section === "decision").length,
    DECISION_QUESTION_COUNT,
  );
  assert.equal(
    first.questions.filter(isInteractiveQuestion).length,
    INTERACTIVE_QUESTION_COUNT,
  );
  for (const [format, target] of Object.entries(formatQuestionTargets)) {
    assert.equal(
      first.questions.filter(
        (question) => getQuestionFormatGroup(question) === format,
      ).length,
      target,
      `${format} should match its per-attempt target`,
    );
  }
  assert.ok(
    first.questions.slice(-DECISION_QUESTION_COUNT).every(
      (question) =>
        question.type === "decision" &&
        question.decisionSetId === first.decisionSetId,
    ),
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
  const seenDecisionSetIds = new Set<string>();
  const signatures = new Set<string>();

  for (let seed = 1; seed <= 500; seed += 1) {
    const selection = createExamSelection(questions, caseStudies, seed);
    for (const [format, target] of Object.entries(formatQuestionTargets)) {
      assert.equal(
        selection.questions.filter(
          (question) => getQuestionFormatGroup(question) === format,
        ).length,
        target,
        `seed ${seed} should contain ${target} ${format} questions`,
      );
    }
    const codeQuestions = selection.questions.filter(
      (question): question is Extract<(typeof selection.questions)[number], { type: "code" }> =>
        question.type === "code",
    );
    assert.deepEqual(
      new Set(codeQuestions.map((question) => question.domain)),
      new Set(domains),
      `seed ${seed} should include code from all five domains`,
    );
    assert.deepEqual(
      new Set(codeQuestions.map((question) => question.language)),
      new Set(["python", "json", "http", "azurecli"]),
      `seed ${seed} should include all four code languages`,
    );
    selection.questions.forEach((question) => seenQuestionIds.add(question.id));
    selection.caseStudies.forEach((caseStudy) => seenCaseStudyIds.add(caseStudy.id));
    seenDecisionSetIds.add(selection.decisionSetId);
    signatures.add(selection.questions.map((question) => question.id).join(","));
  }

  assert.equal(seenQuestionIds.size, questions.length);
  assert.equal(seenCaseStudyIds.size, caseStudies.length);
  assert.equal(seenDecisionSetIds.size, 4);
  assert.ok(signatures.size >= 490, "nearly every sampled seed should produce a distinct exam");
});

test("history rotates unseen questions, cases, and decision sequences", () => {
  let history = createEmptySelectionHistory();
  let previousGeneralIds = new Set<number>();
  const firstCycleCases = new Set<string>();
  const firstCycleDecisionSets = new Set<string>();

  for (let attempt = 1; attempt <= 7; attempt += 1) {
    const selection = createExamSelection(
      questions,
      caseStudies,
      1_000 + attempt,
      history,
    );
    const generalIds = new Set(
      selection.questions
        .filter((question) => question.section === "general")
        .map((question) => question.id),
    );

    if (attempt > 1) {
      assert.equal(
        [...generalIds].filter((id) => previousGeneralIds.has(id)).length,
        0,
        `attempt ${attempt} should avoid an immediately repeated general item`,
      );
    }
    if (attempt <= caseStudies.length) {
      firstCycleCases.add(selection.caseStudies[0].id);
    }
    if (attempt <= 4) {
      firstCycleDecisionSets.add(selection.decisionSetId);
    }

    history = recordExamSelection(history, selection);
    previousGeneralIds = generalIds;
  }

  assert.equal(firstCycleCases.size, caseStudies.length);
  assert.equal(firstCycleDecisionSets.size, 4);
  assert.equal(history.attemptsStarted, 7);
  assert.ok(Object.keys(history.questions).length > EXAM_QUESTION_COUNT);
});
