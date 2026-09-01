import type { Domain, Question } from "../questions";

export const skillCatalog = {
  "plan.services": "Choose appropriate Foundry services and models",
  "plan.security": "Secure Azure AI resources and connections",
  "plan.deployment": "Plan deployments, capacity, and lifecycle",
  "plan.observability": "Implement evaluation, monitoring, and governance",
  "genai.application": "Build and configure generative AI applications",
  "genai.rag": "Implement retrieval-augmented generation",
  "genai.agents": "Build agents, conversations, and memory",
  "genai.tools": "Integrate tools, APIs, and guarded workflows",
  "genai.evaluation": "Evaluate and optimize generative systems",
  "vision.understanding": "Analyze images with multimodal models",
  "vision.generation": "Generate and edit images and video",
  "vision.safety": "Apply responsible AI to multimodal content",
  "text.language": "Analyze and classify natural language",
  "text.speech": "Implement speech recognition and synthesis",
  "text.translation": "Implement text and speech translation",
  "extraction.documents": "Extract fields and structure from documents",
  "extraction.content": "Build Content Understanding analyzers",
  "extraction.search": "Build enrichment, indexing, and grounding pipelines",
} as const;

export type SkillId = keyof typeof skillCatalog;

const defaultSkillByDomain: Record<Domain, SkillId> = {
  "Plan and manage an Azure AI solution": "plan.services",
  "Implement generative AI and agentic solutions": "genai.application",
  "Implement computer vision solutions": "vision.understanding",
  "Implement text analysis solutions": "text.language",
  "Implement information extraction solutions": "extraction.documents",
};

function inferSkillId(question: Question): SkillId {
  if (question.skillId && question.skillId in skillCatalog) {
    return question.skillId as SkillId;
  }

  const text = `${question.objective} ${question.stem} ${question.source.label}`.toLowerCase();
  if (question.domain === "Plan and manage an Azure AI solution") {
    if (/role|identity|credential|private|network|security|connection/.test(text)) return "plan.security";
    if (/deploy|quota|capacity|throughput|lifecycle|region/.test(text)) return "plan.deployment";
    if (/evaluat|monitor|trace|audit|provenance|govern/.test(text)) return "plan.observability";
  }
  if (question.domain === "Implement generative AI and agentic solutions") {
    if (/retriev|rag|search|ground|vector|chunk/.test(text)) return "genai.rag";
    if (/tool|function|openapi|mcp|workflow|approval/.test(text)) return "genai.tools";
    if (/agent|conversation|memory|multi-agent/.test(text)) return "genai.agents";
    if (/evaluat|reflect|critique|optimi|trace/.test(text)) return "genai.evaluation";
  }
  if (question.domain === "Implement computer vision solutions") {
    if (/generat|edit|mask|inpaint|video/.test(text)) return "vision.generation";
    if (/safety|harm|prompt shield|attack|moder/.test(text)) return "vision.safety";
  }
  if (question.domain === "Implement text analysis solutions") {
    if (/speech|transcri|synthesi|ssml|audio/.test(text)) return "text.speech";
    if (/translat|language pair|locale/.test(text)) return "text.translation";
  }
  if (question.domain === "Implement information extraction solutions") {
    if (/search|index|skillset|vector|chunk|ocr|normalized/.test(text)) return "extraction.search";
    if (/content understanding|analyzer|multimodal/.test(text)) return "extraction.content";
  }
  return defaultSkillByDomain[question.domain];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

export function withQuestionMetadata(question: Question): Question {
  const skillId = inferSkillId(question);
  const lifecycle = question.lifecycle ??
    (question.source.url.includes("/agents/concepts/workflow") ||
    question.source.label.toLowerCase().includes("preview")
      ? "preview"
      : "ga");

  return {
    ...question,
    skillId,
    topicTags: question.topicTags?.length ? question.topicTags : [skillId],
    lastVerified: question.lastVerified ?? "2026-09-01",
    variantGroup: question.variantGroup ?? `${skillId}:${slugify(question.objective)}`,
    lifecycle,
    ...(question.type === "decision"
      ? { decisionSetId: question.decisionSetId ?? "secure-agent-rollout" }
      : {}),
  };
}
