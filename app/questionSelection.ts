import {
  domains,
  type CaseStudy,
  type CaseStudyId,
  type Domain,
  type Question,
  type SectionId,
} from "./questions";
import { mixSeed, shuffleWithSeed } from "./optionShuffle";

export const EXAM_QUESTION_COUNT = 51;
export const CASE_STUDY_COUNT = 1;
export const QUESTIONS_PER_CASE_STUDY = 5;
export const DECISION_QUESTION_COUNT = 3;
export const GENERAL_QUESTION_COUNT =
  EXAM_QUESTION_COUNT -
  CASE_STUDY_COUNT * QUESTIONS_PER_CASE_STUDY -
  DECISION_QUESTION_COUNT;

const selectableFormatGroups = ["single", "multi", "code", "interactive"] as const;
export type QuestionFormatGroup =
  | (typeof selectableFormatGroups)[number]
  | "decision";
type SelectableFormatGroup = (typeof selectableFormatGroups)[number];

export const formatQuestionTargets: Record<QuestionFormatGroup, number> = {
  single: 30,
  multi: 7,
  code: 4,
  interactive: 7,
  decision: 3,
};

export const INTERACTIVE_QUESTION_COUNT =
  formatQuestionTargets.code +
  formatQuestionTargets.interactive +
  formatQuestionTargets.decision;

export const domainQuestionTargets: Record<Domain, number> = {
  "Plan and manage an Azure AI solution": 14,
  "Implement generative AI and agentic solutions": 17,
  "Implement computer vision solutions": 6,
  "Implement text analysis solutions": 7,
  "Implement information extraction solutions": 7,
};

export type ExamSelection = {
  questions: Question[];
  caseStudies: CaseStudy[];
  sectionOrder: SectionId[];
};

export function getQuestionFormatGroup(question: Question): QuestionFormatGroup {
  if (question.type === "single") return "single";
  if (question.type === "multi") return "multi";
  if (question.type === "code") return "code";
  if (question.type === "decision") return "decision";
  return "interactive";
}

export function isInteractiveQuestion(question: Question) {
  const group = getQuestionFormatGroup(question);
  return group === "code" || group === "interactive" || group === "decision";
}

export function createExamSelectionFromIds(
  allQuestions: readonly Question[],
  allCaseStudies: readonly CaseStudy[],
  questionIds: readonly number[],
): ExamSelection {
  const byId = new Map(allQuestions.map((question) => [question.id, question]));
  const selectedQuestions = questionIds.map((id) => {
    const question = byId.get(id);
    if (!question) throw new Error(`Saved question ${id} is not in the question bank.`);
    return question;
  });

  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error("A saved exam selection cannot contain duplicate questions.");
  }

  const caseStudyById = new Map(
    allCaseStudies.map((caseStudy) => [caseStudy.id, caseStudy]),
  );
  const selectedCaseIds: CaseStudyId[] = [];
  for (const question of selectedQuestions) {
    if (
      caseStudyById.has(question.section as CaseStudyId) &&
      !selectedCaseIds.includes(question.section as CaseStudyId)
    ) {
      selectedCaseIds.push(question.section as CaseStudyId);
    }
  }

  const selectedCaseStudies = selectedCaseIds.map((id) => {
    const caseStudy = caseStudyById.get(id);
    if (!caseStudy) throw new Error(`Saved case study ${id} is not available.`);
    return caseStudy;
  });
  const sectionOrder: SectionId[] = [];
  if (selectedQuestions.some((question) => question.section === "general")) {
    sectionOrder.push("general");
  }
  sectionOrder.push(...selectedCaseIds);
  if (selectedQuestions.some((question) => question.section === "decision")) {
    sectionOrder.push("decision");
  }

  return {
    questions: selectedQuestions,
    caseStudies: selectedCaseStudies,
    sectionOrder,
  };
}

function countByDomain(selectedQuestions: readonly Question[]) {
  const counts = Object.fromEntries(
    domains.map((domain) => [domain, 0]),
  ) as Record<Domain, number>;

  for (const question of selectedQuestions) counts[question.domain] += 1;
  return counts;
}

export function createExamSelection(
  allQuestions: readonly Question[],
  allCaseStudies: readonly CaseStudy[],
  attemptSeed: number,
): ExamSelection {
  if (allCaseStudies.length < CASE_STUDY_COUNT) {
    throw new Error(`The exam requires at least ${CASE_STUDY_COUNT} case studies.`);
  }

  const selectedCaseStudies = shuffleWithSeed(
    allCaseStudies,
    mixSeed(attemptSeed, 50_000),
  ).slice(0, CASE_STUDY_COUNT);

  const caseQuestions = selectedCaseStudies.flatMap((caseStudy, caseIndex) => {
    const pool = allQuestions.filter((question) => question.section === caseStudy.id);
    if (pool.length !== QUESTIONS_PER_CASE_STUDY) {
      throw new Error(
        `${caseStudy.id} must contain exactly ${QUESTIONS_PER_CASE_STUDY} questions.`,
      );
    }
    return shuffleWithSeed(pool, mixSeed(attemptSeed, 51_000 + caseIndex));
  });

  const decisionPool = allQuestions.filter(
    (question) => question.section === "decision",
  );
  if (decisionPool.length !== DECISION_QUESTION_COUNT) {
    throw new Error(
      `The decision sequence must contain exactly ${DECISION_QUESTION_COUNT} questions.`,
    );
  }
  const decisionQuestions = shuffleWithSeed(
    decisionPool,
    mixSeed(attemptSeed, 52_000),
  );

  const fixedQuestions = [...caseQuestions, ...decisionQuestions];
  const fixedDomainCounts = countByDomain(fixedQuestions);
  const requiredByDomain = Object.fromEntries(
    domains.map((domain) => [domain, domainQuestionTargets[domain] - fixedDomainCounts[domain]]),
  ) as Record<Domain, number>;

  const generalPools = Object.fromEntries(
    domains.map((domain) => {
      const pool = allQuestions.filter(
        (question) => question.section === "general" && question.domain === domain,
      );
      return [
        domain,
        Object.fromEntries(
          selectableFormatGroups.map((format) => [
            format,
            pool.filter((question) => getQuestionFormatGroup(question) === format),
          ]),
        ),
      ];
    }),
  ) as Record<Domain, Record<SelectableFormatGroup, Question[]>>;

  for (const domain of domains) {
    const required = requiredByDomain[domain];
    if (required < 0) {
      throw new Error(`Selected fixed sections exceed the ${domain} target.`);
    }
    const available = selectableFormatGroups.reduce(
      (sum, format) => sum + generalPools[domain][format].length,
      0,
    );
    if (available < required) {
      throw new Error(
        `The general pool needs ${required} ${domain} questions but contains ${available}.`,
      );
    }
  }

  const fixedFormatCounts = Object.fromEntries(
    (Object.keys(formatQuestionTargets) as QuestionFormatGroup[]).map((format) => [
      format,
      fixedQuestions.filter(
        (question) => getQuestionFormatGroup(question) === format,
      ).length,
    ]),
  ) as Record<QuestionFormatGroup, number>;
  const remainingFormatTargets = Object.fromEntries(
    selectableFormatGroups.map((format) => [
      format,
      formatQuestionTargets[format] - fixedFormatCounts[format],
    ]),
  ) as Record<SelectableFormatGroup, number>;

  if (fixedFormatCounts.decision !== formatQuestionTargets.decision) {
    throw new Error(
      `The fixed sections contain ${fixedFormatCounts.decision} decision questions; expected ${formatQuestionTargets.decision}.`,
    );
  }
  if (selectableFormatGroups.some((format) => remainingFormatTargets[format] < 0)) {
    throw new Error("The selected case study exceeds at least one question-format target.");
  }
  const remainingFormatTotal = selectableFormatGroups.reduce(
    (sum, format) => sum + remainingFormatTargets[format],
    0,
  );
  if (remainingFormatTotal !== GENERAL_QUESTION_COUNT) {
    throw new Error(
      `The format targets require ${remainingFormatTotal} general questions; expected ${GENERAL_QUESTION_COUNT}.`,
    );
  }

  type FormatAllocation = Record<SelectableFormatGroup, number>;
  const failedStates = new Set<string>();

  function futureCapacitySupports(
    startDomainIndex: number,
    remaining: FormatAllocation,
  ) {
    const futureDomains = domains.slice(startDomainIndex);
    const futureRequired = futureDomains.reduce(
      (sum, domain) => sum + requiredByDomain[domain],
      0,
    );
    const remainingTotal = selectableFormatGroups.reduce(
      (sum, format) => sum + remaining[format],
      0,
    );
    if (futureRequired !== remainingTotal) return false;

    return selectableFormatGroups.every((format) => {
      const capacity = futureDomains.reduce(
        (sum, domain) =>
          sum +
          Math.min(requiredByDomain[domain], generalPools[domain][format].length),
        0,
      );
      return capacity >= remaining[format];
    });
  }

  function findFormatAllocation(
    domainIndex: number,
    remaining: FormatAllocation,
  ): FormatAllocation[] | undefined {
    if (domainIndex === domains.length) {
      return selectableFormatGroups.every((format) => remaining[format] === 0)
        ? []
        : undefined;
    }

    const stateKey = `${domainIndex}:${selectableFormatGroups
      .map((format) => remaining[format])
      .join(",")}`;
    if (failedStates.has(stateKey)) return undefined;

    const domain = domains[domainIndex];
    const required = requiredByDomain[domain];
    const pools = generalPools[domain];
    const candidates: FormatAllocation[] = [];

    for (
      let single = 0;
      single <= Math.min(required, pools.single.length, remaining.single);
      single += 1
    ) {
      for (
        let multi = 0;
        multi <= Math.min(required - single, pools.multi.length, remaining.multi);
        multi += 1
      ) {
        for (
          let code = 0;
          code <= Math.min(required - single - multi, pools.code.length, remaining.code);
          code += 1
        ) {
          const interactive = required - single - multi - code;
          if (
            interactive < 0 ||
            interactive > pools.interactive.length ||
            interactive > remaining.interactive
          ) {
            continue;
          }
          candidates.push({ single, multi, code, interactive });
        }
      }
    }

    const stateValue =
      domainIndex * 10_000 +
      remaining.single * 1_000 +
      remaining.multi * 100 +
      remaining.code * 10 +
      remaining.interactive;
    const randomizedCandidates = shuffleWithSeed(
      candidates,
      mixSeed(attemptSeed, 53_000 + stateValue),
    );

    for (const candidate of randomizedCandidates) {
      const nextRemaining = Object.fromEntries(
        selectableFormatGroups.map((format) => [
          format,
          remaining[format] - candidate[format],
        ]),
      ) as FormatAllocation;
      if (
        selectableFormatGroups.some((format) => nextRemaining[format] < 0) ||
        !futureCapacitySupports(domainIndex + 1, nextRemaining)
      ) {
        continue;
      }

      const tail = findFormatAllocation(domainIndex + 1, nextRemaining);
      if (tail) return [candidate, ...tail];
    }

    failedStates.add(stateKey);
    return undefined;
  }

  const formatAllocation = findFormatAllocation(0, remainingFormatTargets);
  if (!formatAllocation) {
    throw new Error(
      "Unable to satisfy the configured domain and question-format targets with the available general pool.",
    );
  }

  const selectedGeneralQuestions = domains.flatMap((domain, domainIndex) =>
    selectableFormatGroups.flatMap((format, formatIndex) =>
      shuffleWithSeed(
        generalPools[domain][format],
        mixSeed(attemptSeed, 54_000 + domainIndex * 100 + formatIndex),
      ).slice(0, formatAllocation[domainIndex][format]),
    ),
  );

  if (selectedGeneralQuestions.length !== GENERAL_QUESTION_COUNT) {
    throw new Error(
      `Expected ${GENERAL_QUESTION_COUNT} general questions but selected ${selectedGeneralQuestions.length}.`,
    );
  }

  const generalQuestions = shuffleWithSeed(
    selectedGeneralQuestions,
    mixSeed(attemptSeed, 56_000),
  );
  const selectedCaseIds = selectedCaseStudies.map(
    (caseStudy) => caseStudy.id,
  ) as CaseStudyId[];

  const selectedQuestions = [
    ...generalQuestions,
    ...caseQuestions,
    ...decisionQuestions,
  ];
  for (const [format, target] of Object.entries(formatQuestionTargets) as [
    QuestionFormatGroup,
    number,
  ][]) {
    const actual = selectedQuestions.filter(
      (question) => getQuestionFormatGroup(question) === format,
    ).length;
    if (actual !== target) {
      throw new Error(
        `Expected ${target} ${format} questions but selected ${actual}.`,
      );
    }
  }

  return {
    questions: selectedQuestions,
    caseStudies: selectedCaseStudies,
    sectionOrder: ["general", ...selectedCaseIds, "decision"],
  };
}
