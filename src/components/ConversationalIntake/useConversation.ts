/**
 * Conversation state machine for the /check intake flow.
 *
 * Responsibilities:
 *  1. Track which step we are on (core steps + dynamic product questions)
 *  2. Collect and validate answers into ConversationState
 *  3. Derive active dynamic questions via getQuestionsForProduct (read-only)
 *  4. Signal completion so the caller can invoke submitWatchlistEntry
 *
 * This hook NEVER determines compliance facts — it only stores answers.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { CONVERSATION_STEPS, type StepId } from "./conversationSteps";
import { EMPTY_STATE, type ConversationState } from "./intakeToPayload";
import { getQuestionsForProduct, type ProductQuestion } from "@/lib/productQuestions";
import { useLang } from "@/lib/i18n";

export type MessageRole = "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  stepId?: StepId | string;
}

type CoreStepId = StepId;
type DynamicStepId = string; // ProductQuestion.key

export interface UseConversationReturn {
  messages: ChatMessage[];
  state: ConversationState;
  currentStep: ConversationStep | ProductQuestionStep | null;
  isComplete: boolean;
  answer: (value: string, displayText?: string) => void;
  skip: () => void;
  reset: () => void;
}

export interface ConversationStep {
  kind: "core";
  id: CoreStepId;
  prompt: string;
  inputType: string;
  optional: boolean;
  placeholder?: string;
  helpText?: string;
  options?: undefined;
  showIf?: undefined;
}

export interface ProductQuestionStep {
  kind: "dynamic";
  id: DynamicStepId;
  prompt: string;
  inputType: "options";
  optional: boolean;
  placeholder?: undefined;
  helpText?: string;
  options: Array<{ value: string; label: string }>;
  showIf?: { key: string; values: string[] };
}

let msgCounter = 0;
function uid() { return `m${++msgCounter}`; }

/**
 * Returns the first unanswered, non-skipped core step, or null when all done.
 * Exported for unit testing only.
 */
export function makeCoreStep(
  state: ConversationState,
  lang: "en" | "zh",
): ConversationStep | null {
  const remaining = CONVERSATION_STEPS.filter((s) => {
    if (state.skippedSteps.has(s.id)) return false;
    const val = state[s.id as keyof ConversationState];
    return typeof val === "string" && val === "";
  });
  if (remaining.length === 0) return null;
  const s = remaining[0];
  return {
    kind: "core",
    id: s.id,
    prompt: lang === "zh" && s.promptZh ? s.promptZh : s.prompt,
    inputType: s.inputType,
    optional: !!s.optional,
    placeholder: lang === "zh" && s.placeholderZh ? s.placeholderZh : s.placeholder,
    helpText: lang === "zh" && s.helpTextZh ? s.helpTextZh : s.helpText,
  };
}

function makeDynamicStep(
  state: ConversationState,
  lang: "en" | "zh",
): ProductQuestionStep | null {
  if (!state.productName) return null;

  const htsDigits = state.htsCode.replace(/[^0-9]/g, "");
  const productText = `${state.productName} ${state.description}`;
  const questions = getQuestionsForProduct(htsDigits, productText, {}, state.knownFacts);

  const unanswered = questions.filter((q: ProductQuestion) => {
    if (q.key in state.knownFacts) return false;
    if (q.showIf) {
      const val = state.knownFacts[q.showIf.key];
      if (!val || !q.showIf.values.includes(val)) return false;
    }
    return true;
  });

  if (unanswered.length === 0) return null;
  const q = unanswered[0];

  return {
    kind: "dynamic",
    id: q.key,
    prompt: lang === "zh" && q.questionZh ? q.questionZh : q.question,
    inputType: "options",
    optional: false,
    helpText: lang === "zh" && q.helpTextZh ? q.helpTextZh : q.helpText,
    options: q.options.map((o) => ({
      value: o.value,
      label: lang === "zh" && o.labelZh ? o.labelZh : o.label,
    })),
    showIf: q.showIf,
  };
}

export function useConversation(): UseConversationReturn {
  const lang = useLang();
  const [state, setState] = useState<ConversationState>(EMPTY_STATE);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const greeting =
      lang === "zh"
        ? "您好！我来帮您评估进口这批货物的合规性和成本。请问您计划进口什么产品？"
        : "Hi! I'll help you assess the compliance requirements and costs for your import. What product are you planning to import?";
    return [{ id: uid(), role: "assistant", text: greeting, stepId: "productName" }];
  });

  const currentStep = useMemo((): ConversationStep | ProductQuestionStep | null => {
    const core = makeCoreStep(state, lang);
    if (core) return core;
    return makeDynamicStep(state, lang);
  }, [state, lang]);

  const isComplete = currentStep === null;

  // Guard against rapid-click duplicates. A ref (not state) so it doesn't cause re-renders.
  const answerInflightRef = useRef(false);

  const pushMessage = useCallback((role: MessageRole, text: string, stepId?: string) => {
    setMessages((prev) => [...prev, { id: uid(), role, text, stepId }]);
  }, []);

  /**
   * Compute and push the next assistant prompt given the fully-updated next state.
   * Must be called at most once per user action (never inside a setState updater).
   */
  const advancePrompt = useCallback(
    (nextState: ConversationState) => {
      const core = makeCoreStep(nextState, lang);
      if (core) {
        pushMessage("assistant", core.prompt, core.id);
        return;
      }
      const dyn = makeDynamicStep(nextState, lang);
      if (dyn) {
        pushMessage("assistant", dyn.prompt, dyn.id);
        return;
      }
      const done =
        lang === "zh"
          ? "感谢！正在分析您的产品……"
          : "Thanks! Running your import analysis now…";
      pushMessage("assistant", done);
    },
    [lang, pushMessage],
  );

  /**
   * Record the user's answer and advance to the next step.
   *
   * @param value       The canonical stored value (e.g. "age_3_to_12", "ocean").
   * @param displayText The human-readable label shown in the chat bubble.
   *                    Falls back to `value` when not provided (text inputs).
   *
   * Fix I-1: advancePrompt is called directly in the function body, NOT inside a
   * setState updater. This prevents React StrictMode from double-invoking the
   * side effect and producing duplicate assistant messages.
   *
   * Fix I-3: the user bubble shows displayText (e.g. "Ages 3 – 12") while the
   * canonical value (e.g. "age_3_to_12") is what gets stored and sent to the engine.
   */
  const answer = useCallback(
    (value: string, displayText?: string) => {
      if (!currentStep) return;
      // Prevent duplicate messages from rapid double-clicks (I-1 defence in depth).
      if (answerInflightRef.current) return;
      answerInflightRef.current = true;

      const trimmed = value.trim();
      const display = displayText !== undefined ? displayText : trimmed;

      // Echo the human-readable label into the chat thread.
      pushMessage(
        "user",
        display || (lang === "zh" ? "（跳过）" : "(skipped)"),
        currentStep.id,
      );

      // Compute next state from the current closure value — no setState updater.
      const next: ConversationState = { ...state };
      if (currentStep.kind === "core") {
        (next[currentStep.id as keyof ConversationState] as string) = trimmed;
      } else {
        next.knownFacts = { ...state.knownFacts, [currentStep.id]: trimmed };
      }

      // Commit state, then advance the prompt — both happen exactly once.
      setState(next);
      advancePrompt(next);

      // Release the guard after this event loop tick so the next render has settled.
      setTimeout(() => { answerInflightRef.current = false; }, 0);
    },
    [currentStep, lang, pushMessage, advancePrompt, state],
  );

  /**
   * Skip the current optional step.
   *
   * Fix I-2: marks the step in skippedSteps (a Set carried inside ConversationState)
   * rather than setting the field to "". makeCoreStep filters out skippedSteps, so the
   * question never re-appears. The field remains "" and is therefore absent from the
   * API payload — no sentinel value reaches the engine.
   */
  const skip = useCallback(() => {
    if (!currentStep || !currentStep.optional) return;
    if (answerInflightRef.current) return;
    answerInflightRef.current = true;

    pushMessage("user", lang === "zh" ? "（跳过）" : "(skipped)", currentStep.id);

    const next: ConversationState = {
      ...state,
      skippedSteps: new Set([...state.skippedSteps, currentStep.id]),
    };

    setState(next);
    advancePrompt(next);

    setTimeout(() => { answerInflightRef.current = false; }, 0);
  }, [currentStep, lang, pushMessage, state, advancePrompt]);

  const reset = useCallback(() => {
    answerInflightRef.current = false;
    setState(EMPTY_STATE);
    msgCounter = 0;
    const greeting =
      lang === "zh"
        ? "您好！我来帮您评估进口这批货物的合规性和成本。请问您计划进口什么产品？"
        : "Hi! I'll help you assess the compliance requirements and costs for your import. What product are you planning to import?";
    setMessages([{ id: uid(), role: "assistant", text: greeting, stepId: "productName" }]);
  }, [lang]);

  return { messages, state, currentStep, isComplete, answer, skip, reset };
}
