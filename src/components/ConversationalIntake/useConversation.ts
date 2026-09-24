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

import { useState, useMemo, useCallback } from "react";
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
type AnyStepId = CoreStepId | DynamicStepId;

export interface UseConversationReturn {
  messages: ChatMessage[];
  state: ConversationState;
  currentStep: ConversationStep | ProductQuestionStep | null;
  isComplete: boolean;
  answer: (value: string) => void;
  skip: () => void;
  reset: () => void;
}

interface ConversationStep {
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

interface ProductQuestionStep {
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

function makeCoreStep(state: ConversationState, lang: "en" | "zh"): ConversationStep | null {
  const remaining = CONVERSATION_STEPS.filter((s) => {
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
  // Only show dynamic questions once we have product name
  if (!state.productName) return null;

  const htsDigits = state.htsCode.replace(/[^0-9]/g, "");
  const productText = `${state.productName} ${state.description}`;
  const questions = getQuestionsForProduct(htsDigits, productText, {}, state.knownFacts);

  // Filter to unanswered questions, respecting showIf conditions
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
    // Core steps take priority; dynamic questions appear after email is collected
    const core = makeCoreStep(state, lang);
    if (core) return core;
    return makeDynamicStep(state, lang);
  }, [state, lang]);

  const isComplete = currentStep === null;

  const pushMessage = useCallback((role: MessageRole, text: string, stepId?: string) => {
    setMessages((prev) => [...prev, { id: uid(), role, text, stepId }]);
  }, []);

  const advancePrompt = useCallback(
    (nextState: ConversationState) => {
      // Compute next step from the updated state
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
      // All done
      const done =
        lang === "zh"
          ? "感谢！正在分析您的产品……"
          : "Thanks! Running your import analysis now…";
      pushMessage("assistant", done);
    },
    [lang, pushMessage],
  );

  const answer = useCallback(
    (value: string) => {
      if (!currentStep) return;
      const trimmed = value.trim();

      // Echo user message
      pushMessage("user", trimmed || (lang === "zh" ? "（跳过）" : "(skipped)"), currentStep.id);

      setState((prev) => {
        const next = { ...prev };

        if (currentStep.kind === "core") {
          (next[currentStep.id as keyof ConversationState] as string) = trimmed;
        } else {
          next.knownFacts = { ...prev.knownFacts, [currentStep.id]: trimmed };
        }

        // Schedule prompt for next tick so state is settled
        setTimeout(() => advancePrompt(next), 0);
        return next;
      });
    },
    [currentStep, lang, pushMessage, advancePrompt],
  );

  const skip = useCallback(() => {
    answer("");
  }, [answer]);

  const reset = useCallback(() => {
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
