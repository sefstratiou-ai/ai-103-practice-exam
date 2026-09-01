import type { ExamSelection } from "./questionSelection";

export const HISTORY_STORAGE_KEY = "ai103-practice-history-v1";

export type ExposureRecord = {
  seenCount: number;
  lastSeenAttempt: number;
};

export type SelectionHistory = {
  version: 1;
  attemptsStarted: number;
  questions: Record<string, ExposureRecord>;
  caseStudies: Record<string, ExposureRecord>;
  decisionSets: Record<string, ExposureRecord>;
};

export function createEmptySelectionHistory(): SelectionHistory {
  return {
    version: 1,
    attemptsStarted: 0,
    questions: {},
    caseStudies: {},
    decisionSets: {},
  };
}

export function parseSelectionHistory(raw: string | null): SelectionHistory {
  if (!raw) return createEmptySelectionHistory();
  try {
    const value = JSON.parse(raw) as Partial<SelectionHistory>;
    if (
      value.version !== 1 ||
      typeof value.attemptsStarted !== "number" ||
      !value.questions ||
      !value.caseStudies ||
      !value.decisionSets
    ) {
      return createEmptySelectionHistory();
    }
    return value as SelectionHistory;
  } catch {
    return createEmptySelectionHistory();
  }
}

function incrementRecord(
  records: Record<string, ExposureRecord>,
  key: string | number,
  attemptNumber: number,
) {
  const recordKey = String(key);
  const previous = records[recordKey] ?? { seenCount: 0, lastSeenAttempt: 0 };
  records[recordKey] = {
    seenCount: previous.seenCount + 1,
    lastSeenAttempt: attemptNumber,
  };
}

export function recordExamSelection(
  history: SelectionHistory,
  selection: ExamSelection,
): SelectionHistory {
  const attemptNumber = history.attemptsStarted + 1;
  const next: SelectionHistory = {
    version: 1,
    attemptsStarted: attemptNumber,
    questions: { ...history.questions },
    caseStudies: { ...history.caseStudies },
    decisionSets: { ...history.decisionSets },
  };

  selection.questions.forEach((question) =>
    incrementRecord(next.questions, question.id, attemptNumber),
  );
  selection.caseStudies.forEach((caseStudy) =>
    incrementRecord(next.caseStudies, caseStudy.id, attemptNumber),
  );
  incrementRecord(next.decisionSets, selection.decisionSetId, attemptNumber);
  return next;
}

export function countSeenQuestionIds(
  history: SelectionHistory,
  availableQuestionIds: readonly number[],
) {
  return availableQuestionIds.filter((id) => Boolean(history.questions[id])).length;
}
