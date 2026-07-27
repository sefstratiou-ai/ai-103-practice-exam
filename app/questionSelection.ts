import {
  domains,
  type CaseStudy,
  type CaseStudyId,
  type Domain,
  type Question,
  type SectionId,
} from "./questions";
import { mixSeed, shuffleWithSeed } from "./optionShuffle";

export const EXAM_QUESTION_COUNT = 50;
export const CASE_STUDY_COUNT = 2;
export const QUESTIONS_PER_CASE_STUDY = 5;
export const GENERAL_QUESTION_COUNT =
  EXAM_QUESTION_COUNT - CASE_STUDY_COUNT * QUESTIONS_PER_CASE_STUDY;

export const domainQuestionTargets: Record<Domain, number> = {
  "Plan and manage an Azure AI solution": 14,
  "Implement generative AI and agentic solutions": 17,
  "Implement computer vision solutions": 6,
  "Implement text analysis solutions": 6,
  "Implement information extraction solutions": 7,
};

export type ExamSelection = {
  questions: Question[];
  caseStudies: CaseStudy[];
  sectionOrder: SectionId[];
};

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

  const selectedCaseIds: CaseStudyId[] = [];
  for (const question of selectedQuestions) {
    if (
      question.section !== "general" &&
      !selectedCaseIds.includes(question.section)
    ) {
      selectedCaseIds.push(question.section);
    }
  }

  const caseStudyById = new Map(
    allCaseStudies.map((caseStudy) => [caseStudy.id, caseStudy]),
  );
  const selectedCaseStudies = selectedCaseIds.map((id) => {
    const caseStudy = caseStudyById.get(id);
    if (!caseStudy) throw new Error(`Saved case study ${id} is not available.`);
    return caseStudy;
  });

  return {
    questions: selectedQuestions,
    caseStudies: selectedCaseStudies,
    sectionOrder: [...selectedCaseIds, "general"],
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

  const caseDomainCounts = countByDomain(caseQuestions);
  const selectedGeneralQuestions = domains.flatMap((domain, domainIndex) => {
    const required = domainQuestionTargets[domain] - caseDomainCounts[domain];
    if (required < 0) {
      throw new Error(`Selected case studies exceed the ${domain} target.`);
    }

    const pool = allQuestions.filter(
      (question) => question.section === "general" && question.domain === domain,
    );
    if (pool.length < required) {
      throw new Error(
        `The general pool needs ${required} ${domain} questions but contains ${pool.length}.`,
      );
    }

    return shuffleWithSeed(
      pool,
      mixSeed(attemptSeed, 52_000 + domainIndex),
    ).slice(0, required);
  });

  if (selectedGeneralQuestions.length !== GENERAL_QUESTION_COUNT) {
    throw new Error(
      `Expected ${GENERAL_QUESTION_COUNT} general questions but selected ${selectedGeneralQuestions.length}.`,
    );
  }

  const generalQuestions = shuffleWithSeed(
    selectedGeneralQuestions,
    mixSeed(attemptSeed, 53_000),
  );
  const selectedCaseIds = selectedCaseStudies.map(
    (caseStudy) => caseStudy.id,
  ) as CaseStudyId[];

  return {
    questions: [...caseQuestions, ...generalQuestions],
    caseStudies: selectedCaseStudies,
    sectionOrder: [...selectedCaseIds, "general"],
  };
}
