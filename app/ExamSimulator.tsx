"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  caseStudies as caseStudyPool,
  domainWeights,
  domains,
  questions as questionPool,
  type Question,
  type SectionId,
} from "./questions";
import {
  createAttemptSeed,
  createOptionOrderMap,
  orderByIds,
  type OptionOrder,
} from "./optionShuffle";
import {
  createExamSelection,
  createExamSelectionFromIds,
  EXAM_QUESTION_COUNT,
} from "./questionSelection";

type ExamScreen =
  | "welcome"
  | "agreement"
  | "overview"
  | "exam"
  | "review"
  | "results";
type ExamMode = "timed" | "study";
type QuestionAnswer = string | string[] | Record<string, string>;

type SavedAttempt = {
  version: 3;
  optionSeed: number;
  questionIds: number[];
  screen: ExamScreen;
  mode: ExamMode;
  accepted: boolean;
  currentId: number;
  currentSection: SectionId;
  reviewSection: SectionId;
  answers: Record<number, QuestionAnswer>;
  marked: number[];
  comments: Record<number, string>;
  viewed: number[];
  lockedQuestions: number[];
  lockedSections: SectionId[];
  deadline: number;
  startedAt: number;
  finishedAt: number;
};

const STORAGE_KEY = "ai103-practice-attempt-v1";
const EXAM_SECONDS = 100 * 60;
const initialQuestionIds = createExamSelection(
  questionPool,
  caseStudyPool,
  1,
).questions.map((question) => question.id);

const learnLinks = [
  {
    label: "AI-103 study guide",
    description: "Official skills measured and domain weights",
    url: "https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103",
    keywords: "blueprint skills exam domains",
  },
  {
    label: "Microsoft Foundry documentation",
    description: "Models, projects, deployments, and operations",
    url: "https://learn.microsoft.com/en-us/azure/foundry/",
    keywords: "foundry model deployment quota project",
  },
  {
    label: "Foundry Agent Service",
    description: "Agents, conversations, responses, tools, and workflows",
    url: "https://learn.microsoft.com/en-us/azure/foundry/agents/",
    keywords: "agents conversation response tools workflow memory",
  },
  {
    label: "Azure AI Search",
    description: "Vector, hybrid, semantic, indexing, and enrichment",
    url: "https://learn.microsoft.com/en-us/azure/search/",
    keywords: "search vector hybrid semantic indexer skillset rag",
  },
  {
    label: "Content Understanding",
    description: "Multimodal analyzers and structured extraction",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/",
    keywords: "content understanding analyzer document image audio video markdown json",
  },
  {
    label: "Azure AI Content Safety",
    description: "Filters, Prompt Shields, groundedness, and task adherence",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/content-safety/",
    keywords: "safety prompt shields jailbreak harm groundedness task adherence",
  },
  {
    label: "Azure Speech",
    description: "Speech to text, text to speech, translation, and SSML",
    url: "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/",
    keywords: "speech transcription synthesis translation ssml voice",
  },
];

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}

function answerIsComplete(question: Question, answer?: QuestionAnswer) {
  if (answer == null) return false;
  if (question.type === "single" || question.type === "decision") {
    return typeof answer === "string" && !!answer;
  }
  if (question.type === "multi") {
    return Array.isArray(answer) && answer.length === question.selectCount;
  }
  if (question.type === "order") {
    return Array.isArray(answer) && answer.length === question.options.length;
  }
  if (typeof answer !== "object" || Array.isArray(answer)) return false;
  if (question.type === "code") {
    return question.blanks.every((blank) => !!answer[blank.id]);
  }
  const expected =
    question.type === "match" ? question.prompts.length : question.rows.length;
  return Object.keys(answer).length === expected;
}

function answerIsCorrect(question: Question, answer?: QuestionAnswer) {
  if (!answerIsComplete(question, answer)) return false;
  if (question.type === "single" || question.type === "decision") {
    return answer === question.correct;
  }
  if (question.type === "multi") {
    const selected = [...(answer as string[])].sort();
    return selected.join("|") === [...question.correct].sort().join("|");
  }
  if (question.type === "order") {
    return (answer as string[]).every((value, index) => value === question.correct[index]);
  }
  const map = answer as Record<string, string>;
  return Object.entries(question.correct).every(([key, value]) => map[key] === value);
}

function optionText(question: Question, id: string) {
  if (question.type === "decision") return id === "yes" ? "Yes" : "No";
  if (question.type === "code") {
    return question.blanks
      .flatMap((blank) => blank.options)
      .find((option) => option.id === id)?.text ?? id;
  }
  if (question.type === "single" || question.type === "multi" || question.type === "order") {
    return question.options.find((option) => option.id === id)?.text ?? id;
  }
  if (question.type === "match") {
    return question.choices.find((option) => option.id === id)?.text ?? id;
  }
  return question.columns.find((option) => option.id === id)?.text ?? id;
}

function correctAnswerText(question: Question) {
  if (question.type === "single" || question.type === "decision") {
    return optionText(question, question.correct);
  }
  if (question.type === "multi") {
    return question.correct.map((id) => optionText(question, id)).join(" · ");
  }
  if (question.type === "order") {
    return question.correct
      .map((id, index) => `${index + 1}. ${optionText(question, id)}`)
      .join("\n");
  }
  if (question.type === "code") {
    return question.blanks
      .map((blank) => {
        const correctOption = blank.options.find(
          (option) => option.id === question.correct[blank.id],
        );
        return `${blank.label}: ${correctOption?.text ?? question.correct[blank.id]}`;
      })
      .join("\n");
  }
  const rows = question.type === "match" ? question.prompts : question.rows;
  return rows
    .map((row) => `${row.text} → ${optionText(question, question.correct[row.id])}`)
    .join("\n");
}

function questionTypeLabel(question: Question) {
  switch (question.type) {
    case "single":
      return "Choose one";
    case "multi":
      return `Choose ${question.selectCount}`;
    case "order":
      return "Build list";
    case "match":
      return "Match items";
    case "matrix":
      return "Yes / No";
    case "decision":
      return "Yes / No · no review";
    case "code":
      return "Complete the code";
  }
}

function MicrosoftMark() {
  return (
    <span className="ms-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export default function ExamSimulator() {
  const [hydrated, setHydrated] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState<SavedAttempt | null>(null);
  const [screen, setScreen] = useState<ExamScreen>("welcome");
  const [mode, setMode] = useState<ExamMode>("timed");
  const [accepted, setAccepted] = useState(false);
  const [currentId, setCurrentId] = useState(initialQuestionIds[0]);
  const [currentSection, setCurrentSection] = useState<SectionId>("general");
  const [reviewSection, setReviewSection] = useState<SectionId>("general");
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
  const [marked, setMarked] = useState<number[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [viewed, setViewed] = useState<number[]>([]);
  const [lockedQuestions, setLockedQuestions] = useState<number[]>([]);
  const [lockedSections, setLockedSections] = useState<SectionId[]>([]);
  const [deadline, setDeadline] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(EXAM_SECONDS);
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [optionSeed, setOptionSeed] = useState(1);
  const [questionIds, setQuestionIds] = useState(initialQuestionIds);
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnQuery, setLearnQuery] = useState("");
  const [casePaneOpen, setCasePaneOpen] = useState(true);
  const [caseTab, setCaseTab] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [finishDialog, setFinishDialog] = useState<"section" | "exam" | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [resultFilter, setResultFilter] = useState<"all" | "incorrect" | "marked">("incorrect");
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const examSelection = useMemo(
    () => createExamSelectionFromIds(questionPool, caseStudyPool, questionIds),
    [questionIds],
  );
  const examQuestions = examSelection.questions;
  const attemptCaseStudies = examSelection.caseStudies;
  const sectionOrder = examSelection.sectionOrder;
  const currentQuestion =
    examQuestions.find((question) => question.id === currentId) ?? examQuestions[0];
  const optionOrderMap = useMemo(
    () => createOptionOrderMap(examQuestions, optionSeed),
    [examQuestions, optionSeed],
  );
  const activeCase = attemptCaseStudies.find((item) => item.id === currentSection);
  const sectionQuestions = useMemo(
    () => examQuestions.filter((question) => question.section === currentSection),
    [currentSection, examQuestions],
  );
  const reviewQuestions = useMemo(
    () => examQuestions.filter((question) => question.section === reviewSection),
    [examQuestions, reviewSection],
  );
  const currentSectionIndex = sectionQuestions.findIndex((question) => question.id === currentId);
  const currentGlobalIndex = examQuestions.findIndex((question) => question.id === currentId);
  const answeredCount = examQuestions.filter((question) =>
    answerIsComplete(question, answers[question.id]),
  ).length;
  const inDecisionSequence = currentSection === "decision";

  function getSectionLabel(section: SectionId) {
    if (section === "general") return "General";
    if (section === "decision") return "Decision sequence";
    const position = attemptCaseStudies.findIndex((caseStudy) => caseStudy.id === section);
    return `Case study ${position + 1}`;
  }

  const attemptState = useMemo<SavedAttempt>(
    () => ({
      version: 3,
      optionSeed,
      questionIds,
      screen,
      mode,
      accepted,
      currentId,
      currentSection,
      reviewSection,
      answers,
      marked,
      comments,
      viewed,
      lockedQuestions,
      lockedSections,
      deadline,
      startedAt,
      finishedAt,
    }),
    [
      screen,
      optionSeed,
      questionIds,
      mode,
      accepted,
      currentId,
      currentSection,
      reviewSection,
      answers,
      marked,
      comments,
      viewed,
      lockedQuestions,
      lockedSections,
      deadline,
      startedAt,
      finishedAt,
    ],
  );

  useEffect(() => {
    let restoredAttempt: SavedAttempt | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Omit<
          SavedAttempt,
          "version" | "questionIds"
        > & {
          version: number;
          questionIds?: number[];
        };
        if (
          parsed.version === 3 &&
          parsed.screen !== "welcome" &&
          parsed.questionIds?.length === EXAM_QUESTION_COUNT
        ) {
          restoredAttempt = {
            ...parsed,
            version: 3,
            questionIds: parsed.questionIds,
          };
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    const hydrationFrame = window.requestAnimationFrame(() => {
      setSavedAttempt(restoredAttempt);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(hydrationFrame);
  }, []);

  useEffect(() => {
    if (!hydrated || screen === "welcome" || screen === "agreement") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attemptState));
  }, [attemptState, hydrated, screen]);

  const finishExam = useCallback(() => {
    const finished = Date.now();
    setFinishedAt(finished);
    setScreen("results");
    setLearnOpen(false);
    setOnBreak(false);
    setFinishDialog(null);
  }, []);

  useEffect(() => {
    if (!deadline || mode !== "timed" || (screen !== "exam" && screen !== "review")) {
      return;
    }
    const update = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) finishExam();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, finishExam, mode, screen]);

  const goToQuestion = useCallback(
    (id: number) => {
      const target = examQuestions.find((question) => question.id === id);
      if (!target || lockedQuestions.includes(id) || lockedSections.includes(target.section)) return;
      setCurrentId(id);
      setCurrentSection(target.section);
      setReviewSection(target.section);
      setScreen("exam");
      setViewed((previous) =>
        previous.includes(id) ? previous : [...previous, id],
      );
      setCaseTab(0);
      setNotice("");
    },
    [examQuestions, lockedQuestions, lockedSections],
  );

  const goPrevious = useCallback(() => {
    if (currentSection === "decision" || currentSectionIndex <= 0) return;
    const target = sectionQuestions[currentSectionIndex - 1];
    if (!lockedQuestions.includes(target.id)) goToQuestion(target.id);
  }, [currentSection, currentSectionIndex, goToQuestion, lockedQuestions, sectionQuestions]);

  const goNext = useCallback(() => {
    const nextInSection = sectionQuestions[currentSectionIndex + 1];
    if (currentSection === "decision") {
      if (!answerIsComplete(currentQuestion, answers[currentId])) {
        setNotice("Choose Yes or No before continuing. Your answer will lock when you advance.");
        return;
      }
      setLockedQuestions((previous) =>
        previous.includes(currentId) ? previous : [...previous, currentId],
      );
      if (nextInSection) {
        goToQuestion(nextInSection.id);
      } else {
        finishExam();
      }
      return;
    }
    if (nextInSection) {
      goToQuestion(nextInSection.id);
      return;
    }
    setReviewSection(currentSection);
    setScreen("review");
  }, [answers, currentId, currentQuestion, currentSection, currentSectionIndex, finishExam, goToQuestion, sectionQuestions]);

  useEffect(() => {
    if (screen !== "exam" || helpOpen || breakDialogOpen || onBreak || finishDialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        goNext();
      }
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        goPrevious();
      }
      if (event.key.toLowerCase() === "r" && currentSection !== "decision") {
        event.preventDefault();
        setMarked((previous) =>
          previous.includes(currentId)
            ? previous.filter((id) => id !== currentId)
            : [...previous, currentId],
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [breakDialogOpen, currentId, currentSection, finishDialog, goNext, goPrevious, helpOpen, onBreak, screen]);

  function resetAttempt(nextMode: ExamMode = mode) {
    const nextSeed = createAttemptSeed();
    const nextSelection = createExamSelection(questionPool, caseStudyPool, nextSeed);
    setOptionSeed(nextSeed);
    setQuestionIds(nextSelection.questions.map((question) => question.id));
    setMode(nextMode);
    setAccepted(false);
    setCurrentId(nextSelection.questions[0].id);
    setCurrentSection(nextSelection.sectionOrder[0]);
    setReviewSection(nextSelection.sectionOrder[0]);
    setAnswers({});
    setMarked([]);
    setComments({});
    setViewed([]);
    setLockedQuestions([]);
    setLockedSections([]);
    setDeadline(0);
    setRemainingSeconds(EXAM_SECONDS);
    setStartedAt(0);
    setFinishedAt(0);
    setLearnOpen(false);
    setCasePaneOpen(true);
    setCaseTab(0);
    setOnBreak(false);
    setResultFilter("incorrect");
    setExpandedResult(null);
    setSavedAttempt(null);
    setNotice("");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function startNew(nextMode: ExamMode) {
    resetAttempt(nextMode);
    setScreen("agreement");
  }

  function resumeAttempt(saved: SavedAttempt) {
    setOptionSeed(saved.optionSeed ?? createAttemptSeed());
    setQuestionIds(saved.questionIds);
    setMode(saved.mode);
    setAccepted(saved.accepted);
    setCurrentId(saved.currentId);
    setCurrentSection(saved.currentSection);
    setReviewSection(saved.reviewSection);
    setAnswers(saved.answers ?? {});
    setMarked(saved.marked ?? []);
    setComments(saved.comments ?? {});
    setViewed(
      (saved.viewed ?? []).includes(saved.currentId)
        ? saved.viewed ?? []
        : [...(saved.viewed ?? []), saved.currentId],
    );
    setLockedQuestions(saved.lockedQuestions ?? []);
    setLockedSections(saved.lockedSections ?? []);
    setDeadline(saved.deadline ?? 0);
    setStartedAt(saved.startedAt ?? Date.now());
    setFinishedAt(saved.finishedAt ?? 0);
    setRemainingSeconds(
      saved.deadline ? Math.max(0, Math.ceil((saved.deadline - Date.now()) / 1000)) : EXAM_SECONDS,
    );
    setScreen(saved.screen === "agreement" ? "overview" : saved.screen);
  }

  function beginExam() {
    const now = Date.now();
    setStartedAt(now);
    setDeadline(mode === "timed" ? now + EXAM_SECONDS * 1000 : 0);
    setRemainingSeconds(EXAM_SECONDS);
    setScreen("exam");
    setCurrentId(examQuestions[0].id);
    setViewed([examQuestions[0].id]);
    setCurrentSection(sectionOrder[0]);
    setReviewSection(sectionOrder[0]);
  }

  function setAnswer(answer: QuestionAnswer) {
    setAnswers((previous) => ({ ...previous, [currentId]: answer }));
    setNotice("");
  }

  function toggleMulti(id: string, limit: number) {
    const selected = Array.isArray(answers[currentId])
      ? (answers[currentId] as string[])
      : [];
    if (selected.includes(id)) {
      setAnswer(selected.filter((item) => item !== id));
      return;
    }
    if (selected.length >= limit) {
      setNotice(`You can select only ${limit} answers.`);
      return;
    }
    setAnswer([...selected, id]);
  }

  function moveOrder(question: Extract<Question, { type: "order" }>, index: number, delta: number) {
    const current = Array.isArray(answers[currentId])
      ? [...(answers[currentId] as string[])]
      : question.options.map((option) => option.id);
    const target = index + delta;
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    setAnswer(current);
  }

  function setMapAnswer(key: string, value: string) {
    const current =
      answers[currentId] && !Array.isArray(answers[currentId]) && typeof answers[currentId] === "object"
        ? (answers[currentId] as Record<string, string>)
        : {};
    setAnswer({ ...current, [key]: value });
  }

  function toggleMarked() {
    if (currentSection === "decision") return;
    setMarked((previous) =>
      previous.includes(currentId)
        ? previous.filter((id) => id !== currentId)
        : [...previous, currentId],
    );
  }

  function completeSection() {
    const sectionIndex = sectionOrder.indexOf(reviewSection);
    const nextSection = sectionOrder[sectionIndex + 1];
    setLockedSections((previous) =>
      previous.includes(reviewSection) ? previous : [...previous, reviewSection],
    );
    if (!nextSection) {
      finishExam();
      return;
    }
    setCurrentSection(nextSection);
    setReviewSection(nextSection);
    const first = examQuestions.find((question) => question.section === nextSection);
    if (first) {
      setCurrentId(first.id);
      setViewed((previous) =>
        previous.includes(first.id) ? previous : [...previous, first.id],
      );
    }
    setCaseTab(0);
    setCasePaneOpen(true);
    setScreen("exam");
    setFinishDialog(null);
  }

  function startBreak() {
    if (mode === "timed") {
      setLockedQuestions((previous) => Array.from(new Set([...previous, ...viewed])));
    }
    setBreakDialogOpen(false);
    setOnBreak(true);
  }

  function resumeFromBreak() {
    setOnBreak(false);
    if (mode === "study") return;
    const currentPosition = examQuestions.findIndex((question) => question.id === currentId);
    const target = examQuestions
      .slice(currentPosition + 1)
      .find(
        (question) =>
          !lockedQuestions.includes(question.id) && !lockedSections.includes(question.section),
      );
    if (target) {
      setCurrentId(target.id);
      setViewed((previous) =>
        previous.includes(target.id) ? previous : [...previous, target.id],
      );
      setCurrentSection(target.section);
      setReviewSection(target.section);
      setScreen("exam");
    } else {
      setReviewSection(currentSection);
      setScreen("review");
    }
  }

  const correctCount = examQuestions.filter((question) =>
    answerIsCorrect(question, answers[question.id]),
  ).length;
  const scaledScore = Math.round((correctCount / examQuestions.length) * 1000);
  const passed = scaledScore >= 700;
  const elapsedSeconds = startedAt && finishedAt
    ? Math.max(0, Math.round((finishedAt - startedAt) / 1000))
    : 0;

  const domainScores = domains.map((domain) => {
    const domainQuestions = examQuestions.filter((question) => question.domain === domain);
    const correct = domainQuestions.filter((question) =>
      answerIsCorrect(question, answers[question.id]),
    ).length;
    return {
      domain,
      correct,
      total: domainQuestions.length,
      percent: Math.round((correct / domainQuestions.length) * 100),
    };
  });

  const filteredResultQuestions = examQuestions.filter((question) => {
    if (resultFilter === "incorrect") return !answerIsCorrect(question, answers[question.id]);
    if (resultFilter === "marked") return marked.includes(question.id);
    return true;
  });

  const filteredLearnLinks = learnLinks.filter((link) => {
    const query = learnQuery.trim().toLowerCase();
    if (!query) return true;
    return `${link.label} ${link.description} ${link.keywords}`.toLowerCase().includes(query);
  });

  if (!hydrated) {
    return (
      <main className="loading-screen" aria-live="polite">
        <MicrosoftMark />
        <p>Preparing your practice environment…</p>
      </main>
    );
  }

  if (screen === "welcome") {
    return (
      <main className="entry-shell">
        <header className="entry-header">
          <a className="brand-lockup" href="#main-content" aria-label="Go to main content">
            <MicrosoftMark />
            <span>Microsoft-style practice environment</span>
          </a>
          <span className="header-code">AI-103</span>
        </header>
        <section id="main-content" className="welcome-layout">
          <div className="welcome-copy">
            <span className="eyebrow">Azure AI Apps and Agents Developer Associate</span>
            <h1>Practice the pressure.<br />Learn from every choice.</h1>
            <p>
              A best-effort, full-length AI-103 simulation built from the official April 2026
              skills outline and public delivery guidance. Every attempt draws a new
              blueprint-balanced exam.
            </p>
            <div className="blueprint-strip" aria-label="Exam blueprint summary">
              <div><strong>{questionPool.length}</strong><span>original-item pool</span></div>
              <div><strong>100</strong><span>exam minutes</span></div>
              <div><strong>5</strong><span>skill domains</span></div>
              <div><strong>{caseStudyPool.length}</strong><span>case-study pool</span></div>
            </div>
          </div>
          <div className="start-card">
            <div className="practice-badge">Unofficial practice simulator</div>
            <h2>Choose your experience</h2>
            <p className="muted">
              Questions are original and blueprint-aligned. They are not copied from the live exam.
            </p>
            <button className="mode-card selected" onClick={() => startNew("timed")}>
              <span className="mode-icon">100</span>
              <span><strong>Full exam simulation</strong><small>Timed · strict section and break rules</small></span>
              <span className="mode-arrow">→</span>
            </button>
            <button className="mode-card" onClick={() => startNew("study")}>
              <span className="mode-icon light">∞</span>
              <span><strong>Study run</strong><small>Untimed · explanations after submission</small></span>
              <span className="mode-arrow">→</span>
            </button>
            {savedAttempt && (
              <button className="resume-button" onClick={() => resumeAttempt(savedAttempt)}>
                <span>Resume saved attempt</span>
                <small>
                  {savedAttempt.mode === "timed" ? "Timed simulation" : "Study run"} · question {savedAttempt.currentId}
                </small>
              </button>
            )}
            <p className="privacy-note">No sign-in. No data leaves your browser.</p>
          </div>
        </section>
        <footer className="entry-footer">
          <span>AI-103 Practice Lab</span>
          <span>Blueprint: skills measured April 16, 2026</span>
        </footer>
      </main>
    );
  }

  if (screen === "agreement") {
    return (
      <main className="setup-shell">
        <header className="setup-header">
          <div className="brand-lockup"><MicrosoftMark /><span>AI-103 Practice Exam</span></div>
          <span>Step 1 of 2</span>
        </header>
        <section className="setup-card legal-card">
          <span className="eyebrow">Before you begin</span>
          <h1>Practice integrity agreement</h1>
          <p>
            This independent simulator uses original questions based on Microsoft&apos;s public exam
            objectives. It does not contain, request, or reproduce confidential live exam content.
          </p>
          <div className="agreement-grid">
            <div><span>01</span><p>Use the simulator for personal learning and skills assessment.</p></div>
            <div><span>02</span><p>Expect services and objectives to evolve as Microsoft updates the exam.</p></div>
            <div><span>03</span><p>Treat the scaled score as a practice estimate, not an official exam score.</p></div>
          </div>
          <label className="agreement-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>I understand and want to continue.</span>
          </label>
          <div className="setup-actions">
            <button className="secondary-button" onClick={() => setScreen("welcome")}>Back</button>
            <button className="primary-button" disabled={!accepted} onClick={() => setScreen("overview")}>
              Continue
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "overview") {
    return (
      <main className="setup-shell">
        <header className="setup-header">
          <div className="brand-lockup"><MicrosoftMark /><span>AI-103 Practice Exam</span></div>
          <span>Step 2 of 2</span>
        </header>
        <section className="setup-card overview-card">
          <div className="overview-heading">
            <div>
              <span className="eyebrow">Exam overview</span>
              <h1>Developing AI Apps and Agents on Azure</h1>
            </div>
            <div className="exam-code-box"><strong>AI-103</strong><span>{mode === "timed" ? "Timed" : "Study"}</span></div>
          </div>
          <div className="overview-stats">
            <div><span>Exam clock</span><strong>{mode === "timed" ? "100 minutes" : "Untimed"}</strong></div>
            <div><span>Questions</span><strong>{EXAM_QUESTION_COUNT}</strong></div>
            <div><span>Sections</span><strong>3</strong></div>
            <div><span>Practice pass</span><strong>700 / 1000</strong></div>
          </div>
          <p className="overview-note">
            Microsoft lists a 120-minute appointment window for associate exams without labs;
            the scored exam portion is 100 minutes. This simulator starts at the exam clock.
          </p>
          <div className="overview-columns">
            <div>
              <h2>What to expect</h2>
              <ul className="check-list">
                <li>43 independent scenarios, one five-question long-form case study, then three final decision items</li>
                <li>30 single-choice, 7 multiple-response, 4 code-completion, 7 other interactive, and 3 decision items</li>
                <li>The selected case study contains 15 paragraphs across several tabs, so budget time for careful reading</li>
                <li>No lab section in this calibration; Microsoft can vary live exam forms</li>
                <li>Case-study answers lock after that section; each final Yes/No answer locks as you advance</li>
                <li>Microsoft Learn references are available during the run, and the exam clock continues while you use them</li>
                {mode === "timed" && <li>The clock continues during breaks; viewed items lock when a break starts</li>}
              </ul>
            </div>
            <div className="domain-list-card">
              <h2>Skills measured</h2>
              {domains.map((domain) => (
                <div key={domain}><span>{domain}</span><strong>{domainWeights[domain]}</strong></div>
              ))}
            </div>
          </div>
          <div className="setup-actions">
            <button className="secondary-button" onClick={() => setScreen("agreement")}>Back</button>
            <button className="primary-button launch-button" onClick={beginExam}>Start exam</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "results") {
    return (
      <main className="results-shell">
        <header className="results-header">
          <div className="brand-lockup"><MicrosoftMark /><span>AI-103 Practice Exam</span></div>
          <button className="text-button light-text" onClick={() => { resetAttempt(mode); setScreen("welcome"); }}>Exit report</button>
        </header>
        <section className="score-hero">
          <div className="score-copy">
            <span className={`result-status ${passed ? "pass" : "review"}`}>
              {passed ? "Practice target reached" : "More preparation recommended"}
            </span>
            <h1>Your practice score</h1>
            <p>
              This estimate uses equal item scoring. Microsoft&apos;s live exam uses its own scaled
              scoring model, so use the domain diagnostics as your study guide.
            </p>
          </div>
          <div className="score-ring" style={{ "--score": `${Math.min(100, scaledScore / 10) * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{scaledScore}</strong><span>out of 1000</span></div>
          </div>
          <div className="score-facts">
            <div><span>Correct</span><strong>{correctCount} / {examQuestions.length}</strong></div>
            <div><span>Answered</span><strong>{answeredCount} / {examQuestions.length}</strong></div>
            <div><span>Time</span><strong>{formatClock(elapsedSeconds)}</strong></div>
          </div>
        </section>
        <section className="results-content">
          <div className="domain-report">
            <div className="section-title-row"><div><span className="eyebrow">Performance profile</span><h2>Skills measured</h2></div><span className="muted">Official range shown beside each domain</span></div>
            <div className="domain-bars">
              {domainScores.map((item) => (
                <div className="domain-bar-row" key={item.domain}>
                  <div className="domain-bar-label"><span>{item.domain}</span><small>{domainWeights[item.domain]}</small></div>
                  <div className="bar-track" aria-label={`${item.domain}: ${item.percent}%`}>
                    <span style={{ width: `${item.percent}%` }} />
                  </div>
                  <strong>{item.correct}/{item.total}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="review-report">
            <div className="section-title-row">
              <div><span className="eyebrow">Learn from the attempt</span><h2>Answer review</h2></div>
              <div className="filter-tabs" role="group" aria-label="Filter answer review">
                {(["incorrect", "all", "marked"] as const).map((filter) => (
                  <button key={filter} className={resultFilter === filter ? "active" : ""} onClick={() => setResultFilter(filter)}>
                    {filter === "incorrect" ? "Incorrect" : filter === "all" ? "All items" : "Marked"}
                  </button>
                ))}
              </div>
            </div>
            <div className="result-question-list">
              {filteredResultQuestions.length === 0 && (
                <div className="empty-state">No questions match this filter.</div>
              )}
              {filteredResultQuestions.map((question) => {
                const correct = answerIsCorrect(question, answers[question.id]);
                const expanded = expandedResult === question.id;
                return (
                  <article className={`result-question ${correct ? "correct" : "incorrect"}`} key={question.id}>
                    <button className="result-question-header" onClick={() => setExpandedResult(expanded ? null : question.id)} aria-expanded={expanded}>
                      <span className="result-number">{correct ? "✓" : "×"}</span>
                      <span><small>Question {question.id} · {question.domain}</small><strong>{question.stem}</strong></span>
                      <span className="expand-symbol">{expanded ? "−" : "+"}</span>
                    </button>
                    {expanded && (
                      <div className="result-detail">
                        <div><span>Correct answer</span><pre>{correctAnswerText(question)}</pre></div>
                        <div><span>Why</span><p>{question.explanation}</p></div>
                        <div className="result-meta">
                          <span>{question.objective}</span>
                          <a href={question.source.url} target="_blank" rel="noreferrer">Open {question.source.label} ↗</a>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
          <div className="results-actions">
            <button className="secondary-button" onClick={() => window.print()}>Print report</button>
            <button className="primary-button" onClick={() => { resetAttempt(mode); setScreen("agreement"); }}>Start a new attempt</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "review") {
    const unanswered = reviewQuestions.filter((question) => !answerIsComplete(question, answers[question.id]));
    const markedInSection = reviewQuestions.filter((question) => marked.includes(question.id));
    const nextSection = sectionOrder[sectionOrder.indexOf(reviewSection) + 1];
    const submitsExam = !nextSection;
    return (
      <main className="exam-shell review-shell">
        <ExamHeader
          current={currentGlobalIndex + 1}
          total={examQuestions.length}
          remaining={remainingSeconds}
          mode={mode}
          answered={answeredCount}
        />
        <div className="review-page">
          <div className="review-heading">
            <span className="eyebrow">Review your answers</span>
            <h1>{getSectionLabel(reviewSection)}</h1>
            <p>
              {reviewSection === "general"
                ? "Review any item before continuing. You cannot return to these independent questions after leaving the section."
                : "When you finish this section, you cannot return to these case-study questions."}
            </p>
          </div>
          <div className="review-summary">
            <div><strong>{reviewQuestions.length - unanswered.length}</strong><span>Answered</span></div>
            <div className={unanswered.length ? "attention" : ""}><strong>{unanswered.length}</strong><span>Unanswered</span></div>
            <div><strong>{markedInSection.length}</strong><span>Marked for review</span></div>
          </div>
          <div className="review-table" role="table" aria-label="Question review list">
            <div className="review-table-head" role="row"><span>Question</span><span>Status</span><span>Review</span></div>
            {reviewQuestions.map((question, index) => {
              const isLocked = lockedQuestions.includes(question.id) || lockedSections.includes(question.section);
              return (
                <div className={`review-row ${isLocked ? "locked" : ""}`} role="row" key={question.id}>
                  <span><strong>{index + 1}</strong><small>{questionTypeLabel(question)}</small></span>
                  <span className={answerIsComplete(question, answers[question.id]) ? "status-answered" : "status-unanswered"}>
                    {answerIsComplete(question, answers[question.id]) ? "Answered" : "Unanswered"}
                  </span>
                  <span>
                    {marked.includes(question.id) && <span className="flag-label">⚑ Marked</span>}
                    <button disabled={isLocked} onClick={() => goToQuestion(question.id)}>{isLocked ? "Locked" : "Review"}</button>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="review-actions">
            <button className="secondary-button" onClick={() => goToQuestion(currentId)} disabled={lockedQuestions.includes(currentId)}>
              Return to questions
            </button>
            <button className="primary-button" onClick={() => setFinishDialog(submitsExam ? "exam" : "section")}>
              {submitsExam ? "Finish exam" : "Finish section"}
            </button>
          </div>
        </div>
        {finishDialog && (
          <ConfirmDialog
            title={
              finishDialog === "exam"
                ? "Submit your exam?"
                : reviewSection === "general"
                  ? "Finish the general section?"
                  : "Finish this case study?"
            }
            body={
              finishDialog === "exam"
                ? `You have ${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"} in this section. Submission ends the attempt.`
                : `You have ${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"}. You cannot return after continuing.`
            }
            confirmLabel={finishDialog === "exam" ? "Submit exam" : "Finish section"}
            onCancel={() => setFinishDialog(null)}
            onConfirm={completeSection}
          />
        )}
      </main>
    );
  }

  return (
    <main className={`exam-shell ${learnOpen ? "learn-open" : ""}`}>
      <ExamHeader
        current={currentGlobalIndex + 1}
        total={examQuestions.length}
        remaining={remainingSeconds}
        mode={mode}
        answered={answeredCount}
      />
      <aside className="exam-tools" aria-label="Exam tools">
        <button disabled={inDecisionSequence} title={inDecisionSequence ? "Unavailable during the final decision sequence" : undefined} onClick={() => setBreakDialogOpen(true)}><span>Ⅱ</span><small>Take a break</small></button>
        <button className={learnOpen ? "active" : ""} onClick={() => setLearnOpen((value) => !value)}><span>L</span><small>Microsoft Learn</small></button>
        <button disabled={inDecisionSequence} title={inDecisionSequence ? "These answers cannot be reviewed" : undefined} onClick={() => { setReviewSection(currentSection); setScreen("review"); }}><span>≡</span><small>Review</small></button>
        <button onClick={() => setHelpOpen(true)}><span>?</span><small>Help</small></button>
      </aside>
      <div className="exam-main">
        {activeCase && casePaneOpen && (
          <aside className="case-pane">
            <div className="case-pane-header">
              <div><span>{getSectionLabel(currentSection)}</span><strong>{activeCase.title.replace("Case study: ", "")}</strong></div>
              <button aria-label="Collapse case study" onClick={() => setCasePaneOpen(false)}>‹</button>
            </div>
            <div className="case-tabs" role="tablist">
              {activeCase.tabs.map((tab, index) => (
                <button key={tab.label} role="tab" aria-selected={caseTab === index} className={caseTab === index ? "active" : ""} onClick={() => setCaseTab(index)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="case-content">
              <h2>{activeCase.tabs[caseTab].label}</h2>
              {activeCase.tabs[caseTab].content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </aside>
        )}
        <section className="question-pane">
          {activeCase && !casePaneOpen && (
            <button className="reopen-case" onClick={() => setCasePaneOpen(true)}>› View case study</button>
          )}
          <div className="question-scroll">
            <div className="question-meta-row">
              <span>{getSectionLabel(currentSection)} · Question {currentSectionIndex + 1} of {sectionQuestions.length}</span>
              <span className="question-type">{questionTypeLabel(currentQuestion)}</span>
            </div>
            <article className="question-card">
              {inDecisionSequence && (
                <div className="decision-notice" role="note">
                  Final decision sequence: choose Yes or No. Your answer locks when you select
                  Next, and you cannot return to this item.
                </div>
              )}
              {currentQuestion.context && <div className="question-context">{currentQuestion.context}</div>}
              <h1>{currentQuestion.stem}</h1>
              <QuestionInput
                question={currentQuestion}
                answer={answers[currentId]}
                optionOrder={optionOrderMap[currentQuestion.id]}
                onSetAnswer={setAnswer}
                onToggleMulti={toggleMulti}
                onMoveOrder={moveOrder}
                onSetMapAnswer={setMapAnswer}
              />
              {notice && <div className="inline-notice" role="status">{notice}</div>}
              <div className="question-extras">
                {!inDecisionSequence && (
                  <button className={marked.includes(currentId) ? "marked" : ""} onClick={toggleMarked}>
                    <span>⚑</span>{marked.includes(currentId) ? "Marked for review" : "Mark for review"}
                  </button>
                )}
                <button onClick={() => setCommentOpen((value) => !value)}><span>▤</span>Comment on this item</button>
              </div>
              {commentOpen && (
                <div className="comment-box">
                  <label htmlFor="item-comment">Private practice note</label>
                  <textarea
                    id="item-comment"
                    value={comments[currentId] ?? ""}
                    onChange={(event) => setComments((previous) => ({ ...previous, [currentId]: event.target.value }))}
                    placeholder="Record what felt unclear or what you want to review later…"
                  />
                </div>
              )}
            </article>
          </div>
          <footer className="exam-navigation">
            <button className="nav-button" onClick={goPrevious} disabled={inDecisionSequence || currentSectionIndex <= 0}>← Previous <kbd>Alt+P</kbd></button>
            <div className="progress-dots" aria-label={`${answeredCount} of ${examQuestions.length} questions answered`}>
              <span style={{ width: `${(answeredCount / examQuestions.length) * 100}%` }} />
            </div>
            <button className="nav-button next" onClick={goNext}>
              {inDecisionSequence
                ? currentSectionIndex === sectionQuestions.length - 1
                  ? "Submit exam"
                  : "Lock answer and continue"
                : currentSectionIndex === sectionQuestions.length - 1
                  ? "Review section"
                  : "Next"} → <kbd>Alt+N</kbd>
            </button>
          </footer>
        </section>
        {learnOpen && (
          <aside className="learn-pane">
            <div className="learn-header">
              <div><strong>Microsoft Learn</strong><span>Official documentation shortcuts</span></div>
              <button aria-label="Close Microsoft Learn pane" onClick={() => setLearnOpen(false)}>×</button>
            </div>
            <div className="learn-search">
              <label htmlFor="learn-search">Search this reference list</label>
              <input id="learn-search" value={learnQuery} onChange={(event) => setLearnQuery(event.target.value)} placeholder="Search agents, RAG, Speech…" />
            </div>
            <div className="learn-note">The live exam opens learn.microsoft.com in a split pane, and the timer continues. These shortcuts open the same official domain in a new tab.</div>
            <div className="learn-results">
              {filteredLearnLinks.map((link) => (
                <a href={link.url} target="_blank" rel="noreferrer" key={link.label}>
                  <strong>{link.label}</strong><span>{link.description}</span><small>learn.microsoft.com ↗</small>
                </a>
              ))}
              {!filteredLearnLinks.length && <p className="empty-state">No reference shortcuts match your search.</p>}
            </div>
          </aside>
        )}
      </div>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {breakDialogOpen && (
        <ConfirmDialog
          title="Take a break?"
          body={
            mode === "timed"
              ? `The timer will continue. The ${viewed.length} question${viewed.length === 1 ? "" : "s"} you have viewed will lock when the break starts.`
              : "Your study timer is not enforced, and questions will remain available."
          }
          confirmLabel="Start break"
          onCancel={() => setBreakDialogOpen(false)}
          onConfirm={startBreak}
        />
      )}
      {onBreak && (
        <div className="break-overlay" role="dialog" aria-modal="true" aria-labelledby="break-title">
          <div className="break-card">
            <span className="break-symbol">Ⅱ</span>
            <span className="eyebrow">Break in progress</span>
            <h1 id="break-title">The exam clock is still running</h1>
            <div className="break-clock">{mode === "timed" ? formatClock(remainingSeconds) : "UNTIMED"}</div>
            <p>You cannot return to questions viewed before this break in the timed simulation.</p>
            <button className="primary-button" onClick={resumeFromBreak}>Resume exam</button>
          </div>
        </div>
      )}
    </main>
  );
}

function ExamHeader({ current, total, remaining, mode, answered }: { current: number; total: number; remaining: number; mode: ExamMode; answered: number }) {
  return (
    <header className="exam-header">
      <div className="exam-brand"><MicrosoftMark /><span><strong>AI-103</strong><small>Practice exam</small></span></div>
      <div className="exam-title">Developing AI Apps and Agents on Azure</div>
      <div className="exam-status">
        <div><span>Question</span><strong>{current} of {total}</strong></div>
        <div><span>Answered</span><strong>{answered}</strong></div>
        <div className={mode === "timed" && remaining < 600 ? "time-warning" : ""}><span>Time remaining</span><strong>{mode === "timed" ? formatClock(remaining) : "Untimed"}</strong></div>
      </div>
    </header>
  );
}

function QuestionInput({
  question,
  answer,
  optionOrder,
  onSetAnswer,
  onToggleMulti,
  onMoveOrder,
  onSetMapAnswer,
}: {
  question: Question;
  answer?: QuestionAnswer;
  optionOrder?: OptionOrder;
  onSetAnswer: (answer: QuestionAnswer) => void;
  onToggleMulti: (id: string, limit: number) => void;
  onMoveOrder: (question: Extract<Question, { type: "order" }>, index: number, delta: number) => void;
  onSetMapAnswer: (key: string, value: string) => void;
}) {
  if (question.type === "code") {
    const map = answer && typeof answer === "object" && !Array.isArray(answer)
      ? answer as Record<string, string>
      : {};
    const blankOrders = optionOrder && !Array.isArray(optionOrder) ? optionOrder : {};
    const parts = question.code.split(/(\{\{[^}]+\}\})/g);

    return (
      <div className="code-answer">
        <div className="code-language">{question.language === "azurecli" ? "Azure CLI" : question.language.toUpperCase()}</div>
        <pre><code>
          {parts.map((part, index) => {
            const match = part.match(/^\{\{([^}]+)\}\}$/);
            if (!match) return part;
            const blank = question.blanks.find((item) => item.id === match[1]);
            if (!blank) return part;
            const options = orderByIds(blank.options, blankOrders[blank.id]);
            return (
              <select
                aria-label={blank.label}
                key={`${blank.id}-${index}`}
                value={map[blank.id] ?? ""}
                onChange={(event) => onSetMapAnswer(blank.id, event.target.value)}
              >
                <option value="">Select…</option>
                {options.map((option) => (
                  <option value={option.id} key={option.id}>{option.text}</option>
                ))}
              </select>
            );
          })}
        </code></pre>
        <p className="answer-instruction">Complete every dropdown in the code sample.</p>
      </div>
    );
  }

  if (question.type === "decision") {
    return (
      <fieldset className="answer-options decision-options">
        <legend>Select one answer.</legend>
        {([
          { id: "yes", text: "Yes" },
          { id: "no", text: "No" },
        ] as const).map((option) => (
          <label className={answer === option.id ? "selected" : ""} key={option.id}>
            <input
              type="radio"
              name={`question-${question.id}`}
              checked={answer === option.id}
              onChange={() => onSetAnswer(option.id)}
            />
            <span className="choice-letter">{option.id === "yes" ? "Y" : "N"}</span>
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (question.type === "single") {
    const orderedOptions = orderByIds(
      question.options,
      Array.isArray(optionOrder) ? optionOrder : undefined,
    );
    return (
      <fieldset className="answer-options">
        <legend>Select one answer.</legend>
        {orderedOptions.map((option, index) => (
          <label className={answer === option.id ? "selected" : ""} key={option.id}>
            <input type="radio" name={`question-${question.id}`} checked={answer === option.id} onChange={() => onSetAnswer(option.id)} />
            <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (question.type === "multi") {
    const selected = Array.isArray(answer) ? answer : [];
    const orderedOptions = orderByIds(
      question.options,
      Array.isArray(optionOrder) ? optionOrder : undefined,
    );
    return (
      <fieldset className="answer-options multi-options">
        <legend>Select {question.selectCount} answers.</legend>
        {orderedOptions.map((option, index) => (
          <label className={selected.includes(option.id) ? "selected" : ""} key={option.id}>
            <input type="checkbox" checked={selected.includes(option.id)} onChange={() => onToggleMulti(option.id, question.selectCount)} />
            <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
            <span>{option.text}</span>
          </label>
        ))}
        <div className="selection-count">Selected {selected.length} of {question.selectCount}</div>
      </fieldset>
    );
  }

  if (question.type === "order") {
    const current = Array.isArray(answer) ? answer : question.options.map((option) => option.id);
    return (
      <div className="order-answer">
        <p className="answer-instruction">Move the items until they are in the correct order, then confirm the list.</p>
        <ol>
          {current.map((id, index) => (
            <li key={id}>
              <span className="order-number">{index + 1}</span>
              <span>{optionText(question, id)}</span>
              <div>
                <button aria-label={`Move item ${index + 1} up`} disabled={index === 0} onClick={() => onMoveOrder(question, index, -1)}>↑</button>
                <button aria-label={`Move item ${index + 1} down`} disabled={index === current.length - 1} onClick={() => onMoveOrder(question, index, 1)}>↓</button>
              </div>
            </li>
          ))}
        </ol>
        {!Array.isArray(answer) && <button className="confirm-order" onClick={() => onSetAnswer(current)}>Confirm this order</button>}
        {Array.isArray(answer) && <span className="order-confirmed">✓ Order recorded</span>}
      </div>
    );
  }

  if (question.type === "match") {
    const map = answer && typeof answer === "object" && !Array.isArray(answer) ? answer as Record<string, string> : {};
    const orderedChoices = orderByIds(
      question.choices,
      Array.isArray(optionOrder) ? optionOrder : undefined,
    );
    return (
      <div className="match-answer">
        <p className="answer-instruction">Choose one match for each row.</p>
        {question.prompts.map((prompt) => (
          <label key={prompt.id}>
            <span>{prompt.text}</span>
            <select value={map[prompt.id] ?? ""} onChange={(event) => onSetMapAnswer(prompt.id, event.target.value)} aria-label={`Match for ${prompt.text}`}>
              <option value="">Select an answer</option>
              {orderedChoices.map((choice) => <option value={choice.id} key={choice.id}>{choice.text}</option>)}
            </select>
          </label>
        ))}
      </div>
    );
  }

  const map = answer && typeof answer === "object" && !Array.isArray(answer) ? answer as Record<string, string> : {};
  return (
    <fieldset className="matrix-answer">
      <legend>Select one answer for each row.</legend>
      <div className="matrix-head"><span>Statement</span>{question.columns.map((column) => <span key={column.id}>{column.text}</span>)}</div>
      {question.rows.map((row) => (
        <div className="matrix-row" key={row.id}>
          <span>{row.text}</span>
          {question.columns.map((column) => (
            <label key={column.id}>
              <input type="radio" name={`${question.id}-${row.id}`} checked={map[row.id] === column.id} onChange={() => onSetMapAnswer(row.id, column.id)} />
              <span className="sr-only">{column.text}</span>
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal-card">
        <span className="modal-symbol">!</span>
        <h2 id="confirm-title">{title}</h2>
        <p>{body}</p>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="modal-card help-card">
        <button className="modal-close" aria-label="Close help" onClick={onClose}>×</button>
        <span className="eyebrow">Exam help</span>
        <h2 id="help-title">Navigate the simulation</h2>
        <div className="help-grid">
          <div><kbd>Alt+N</kbd><span>Next question</span></div>
          <div><kbd>Alt+P</kbd><span>Previous question</span></div>
          <div><kbd>Alt+R</kbd><span>Mark for review</span></div>
        </div>
        <ul>
          <li>Your selections save automatically in this browser.</li>
          <li>Use Review to locate unanswered and marked items.</li>
          <li>Finishing a case-study section permanently locks it.</li>
          <li>The final three Yes/No items lock one at a time and cannot be reviewed.</li>
          <li>In the timed mode, starting a break locks questions you have already viewed.</li>
          <li>The exam clock continues while Microsoft Learn references are open.</li>
          <li>Explanations appear only after you submit the full attempt.</li>
        </ul>
        <button className="primary-button" onClick={onClose}>Return to exam</button>
      </div>
    </div>
  );
}
