import assert from "node:assert/strict";
import test from "node:test";

import {
  createOptionOrderMap,
  orderByIds,
} from "../app/optionShuffle";
import { questions, type Question } from "../app/questions";

function sourceIds(question: Question) {
  if (question.type === "single" || question.type === "multi") {
    return question.options.map((option) => option.id);
  }
  if (question.type === "match") {
    return question.choices.map((choice) => choice.id);
  }
  return undefined;
}

test("option order is seeded, repeatable, and does not mutate the question bank", () => {
  const originalOrders = new Map(
    questions.flatMap((question) => {
      const ids = sourceIds(question);
      return ids ? [[question.id, ids] as const] : [];
    }),
  );

  const first = createOptionOrderMap(questions, 123_456);
  const repeated = createOptionOrderMap(questions, 123_456);
  const anotherAttempt = createOptionOrderMap(questions, 654_321);

  assert.deepEqual(first, repeated);
  assert.ok(
    Object.keys(first).some(
      (id) =>
        JSON.stringify(first[Number(id)]) !==
        JSON.stringify(anotherAttempt[Number(id)]),
    ),
    "a new attempt seed should change at least one question's option order",
  );

  for (const question of questions) {
    const ids = sourceIds(question);
    if (!ids) continue;
    const displayedOrder = first[question.id];
    assert.ok(Array.isArray(displayedOrder));

    assert.deepEqual(
      [...displayedOrder].sort(),
      [...ids].sort(),
      `question ${question.id} should retain exactly the same option IDs`,
    );
    assert.deepEqual(
      sourceIds(question),
      originalOrders.get(question.id),
      `question ${question.id} should not be mutated`,
    );
  }
});

test("single-answer correct positions are balanced across the displayed letters", () => {
  for (const seed of [1, 2, 99, 123_456, 0xffff_ffff]) {
    const orderMap = createOptionOrderMap(questions, seed);
    const groups = new Map<number, Extract<Question, { type: "single" }>[]>();

    for (const question of questions) {
      if (question.type !== "single") continue;
      const group = groups.get(question.options.length) ?? [];
      group.push(question);
      groups.set(question.options.length, group);
    }

    for (const [optionCount, group] of groups) {
      const counts = Array.from({ length: optionCount }, () => 0);
      for (const question of group) {
        const displayedOrder = orderMap[question.id];
        assert.ok(Array.isArray(displayedOrder));
        const correctPosition = displayedOrder.indexOf(question.correct);
        assert.ok(correctPosition >= 0);
        counts[correctPosition] += 1;
      }

      assert.ok(
        Math.max(...counts) - Math.min(...counts) <= 1,
        `seed ${seed}, ${optionCount}-choice questions should be balanced: ${counts.join(", ")}`,
      );
    }
  }
});

test("multi-select correct answers never occupy the first N displayed choices", () => {
  for (const seed of [1, 2, 99, 123_456, 0xffff_ffff]) {
    const orderMap = createOptionOrderMap(questions, seed);

    for (const question of questions) {
      if (question.type !== "multi") continue;
      const correct = new Set(question.correct);
      const displayedOrder = orderMap[question.id];
      assert.ok(Array.isArray(displayedOrder));
      const displayedPrefix = displayedOrder.slice(0, question.selectCount);

      assert.equal(
        displayedPrefix.every((id) => correct.has(id)),
        false,
        `question ${question.id} should not reveal the answer as its first ${question.selectCount} choices`,
      );
    }
  }
});

test("code-completion choices are shuffled independently for every blank", () => {
  const codeQuestions = questions.filter(
    (question): question is Extract<Question, { type: "code" }> =>
      question.type === "code",
  );

  for (const question of codeQuestions) {
    for (const blank of question.blanks) {
      const correctPositions = new Set<number>();

      for (let seed = 1; seed <= 32; seed += 1) {
        const optionOrder = createOptionOrderMap(questions, seed)[question.id];
        assert.ok(!Array.isArray(optionOrder));
        assert.deepEqual(
          [...optionOrder[blank.id]].sort(),
          blank.options.map((option) => option.id).sort(),
        );
        correctPositions.add(
          optionOrder[blank.id].indexOf(question.correct[blank.id]),
        );
      }

      assert.ok(
        correctPositions.size >= 2,
        `question ${question.id}, blank ${blank.id} should not keep one correct position`,
      );
    }
  }
});

test("ordered IDs control display order without changing answer IDs", () => {
  const items = [
    { id: "a", text: "Alpha" },
    { id: "b", text: "Beta" },
    { id: "c", text: "Gamma" },
  ];

  assert.deepEqual(
    orderByIds(items, ["c", "a", "b"]),
    [items[2], items[0], items[1]],
  );
});
