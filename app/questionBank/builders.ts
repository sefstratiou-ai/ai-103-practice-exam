import type {
  Domain,
  SectionId,
  SingleQuestion,
  MultiQuestion,
} from "../questions";

type Source = { label: string; url: string };
type Metadata = {
  skillId: string;
  topicTags: string[];
  variantGroup: string;
  lifecycle?: "ga" | "preview";
};

type SelectedBase = Metadata & {
  id: number;
  section?: SectionId;
  domain: Domain;
  objective: string;
  difficulty: "Intermediate" | "Advanced";
  stem: string;
  context?: string;
  explanation: string;
  source: Source;
};

const optionIds = ["a", "b", "c", "d", "e", "f"];

export function single(
  spec: SelectedBase & { options: string[]; correct: number },
): SingleQuestion {
  return {
    ...spec,
    section: spec.section ?? "general",
    type: "single",
    options: spec.options.map((text, index) => ({ id: optionIds[index], text })),
    correct: optionIds[spec.correct],
    lastVerified: "2026-09-01",
  };
}

export function multi(
  spec: SelectedBase & { options: string[]; correct: number[] },
): MultiQuestion {
  return {
    ...spec,
    section: spec.section ?? "general",
    type: "multi",
    options: spec.options.map((text, index) => ({ id: optionIds[index], text })),
    correct: spec.correct.map((index) => optionIds[index]),
    selectCount: spec.correct.length,
    lastVerified: "2026-09-01",
  };
}
