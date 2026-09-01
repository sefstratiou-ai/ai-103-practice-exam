import { extractionQuestions } from "./extraction";
import { generativeQuestions } from "./generative";
import { planQuestions } from "./plan";
import { textQuestions } from "./text";
import { visionQuestions } from "./vision";

export const expandedGeneralQuestions = [
  ...planQuestions,
  ...generativeQuestions,
  ...visionQuestions,
  ...textQuestions,
  ...extractionQuestions,
];
