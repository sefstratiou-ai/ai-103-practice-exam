import type { Question } from "./questions";

export type OptionOrder = string[] | Record<string, string[]>;

export function mixSeed(seed: number, value: number) {
  let mixed = (seed ^ Math.imul(value, 0x9e3779b1)) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function shuffleWithSeed<T>(items: readonly T[], seed: number) {
  const result = [...items];
  const random = randomSource(seed);

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }

  return result;
}

export function createAttemptSeed() {
  if (typeof globalThis.crypto !== "undefined") {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] || 1;
  }

  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
}

export function createOptionOrderMap(
  allQuestions: readonly Question[],
  attemptSeed: number,
) {
  const orderMap: Record<number, OptionOrder> = {};
  const singleGroups = new Map<number, Extract<Question, { type: "single" }>[]>();

  for (const question of allQuestions) {
    if (question.type === "single") {
      const group = singleGroups.get(question.options.length) ?? [];
      group.push(question);
      singleGroups.set(question.options.length, group);
      continue;
    }

    if (question.type === "multi") {
      const shuffled = shuffleWithSeed(
        question.options.map((option) => option.id),
        mixSeed(attemptSeed, question.id + 10_000),
      );
      const correct = new Set(question.correct);
      const prefixIsEntirelyCorrect = shuffled
        .slice(0, question.selectCount)
        .every((id) => correct.has(id));

      if (prefixIsEntirelyCorrect) {
        const firstIncorrect = shuffled.findIndex(
          (id, index) => index >= question.selectCount && !correct.has(id),
        );
        if (firstIncorrect >= 0) {
          const prefixIndex = mixSeed(attemptSeed, question.id) % question.selectCount;
          [shuffled[prefixIndex], shuffled[firstIncorrect]] = [
            shuffled[firstIncorrect],
            shuffled[prefixIndex],
          ];
        }
      }

      orderMap[question.id] = shuffled;
      continue;
    }

    if (question.type === "match") {
      orderMap[question.id] = shuffleWithSeed(
        question.choices.map((choice) => choice.id),
        mixSeed(attemptSeed, question.id + 20_000),
      );
      continue;
    }

    if (question.type === "code") {
      orderMap[question.id] = Object.fromEntries(
        question.blanks.map((blank, blankIndex) => [
          blank.id,
          shuffleWithSeed(
            blank.options.map((option) => option.id),
            mixSeed(attemptSeed, question.id * 100 + blankIndex + 50_000),
          ),
        ]),
      );
    }
  }

  for (const [optionCount, group] of singleGroups) {
    const randomizedQuestions = shuffleWithSeed(
      group,
      mixSeed(attemptSeed, optionCount + 30_000),
    );

    randomizedQuestions.forEach((question, groupIndex) => {
      const ids = shuffleWithSeed(
        question.options.map((option) => option.id),
        mixSeed(attemptSeed, question.id + 40_000),
      );
      const targetCorrectPosition = groupIndex % optionCount;
      const currentCorrectPosition = ids.indexOf(question.correct);

      [ids[targetCorrectPosition], ids[currentCorrectPosition]] = [
        ids[currentCorrectPosition],
        ids[targetCorrectPosition],
      ];
      orderMap[question.id] = ids;
    });
  }

  return orderMap;
}

export function orderByIds<T extends { id: string }>(
  items: readonly T[],
  orderedIds?: readonly string[],
) {
  if (!orderedIds) return [...items];

  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort(
    (left, right) =>
      (positions.get(left.id) ?? items.length) -
      (positions.get(right.id) ?? items.length),
  );
}
