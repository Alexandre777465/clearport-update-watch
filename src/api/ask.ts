import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  query: z.string().min(1).max(2000),
  productHtsCodes: z.array(z.string()).default([]),
  productCategories: z.array(z.string()).default([]),
  contextAlertTitle: z.string().optional(),
  contextAlertSource: z.string().optional(),
});

const LEGAL_TRIGGERS = [
  "legal advice",
  "legally required",
  "guaranteed",
  "guarantee",
  "compliance determination",
  "will i be fined",
  "can i import",
  "is it legal",
  "customs ruling",
  "binding ruling",
  "final determination",
  "am i allowed",
  "am i compliant",
  "is this compliant",
];

const DEFLECTION =
  "ClearPort cannot provide final legal interpretation. This update may be relevant based on your monitored products and should be verified with your customs broker.";

const SYSTEM_PROMPT = `You are Ask ClearPort, an assistant that helps importers understand U.S. trade rule updates.

STRICT RULES:
1. Answer only based on the provided context about official trade updates and the user's products.
2. Do NOT provide legal advice, final customs determinations, or guarantee import clearance.
3. Keep answers concise, practical, and accessible to non-expert importers.
4. Always suggest verifying key details with a licensed customs broker.
5. When quoting rules, cite the source (e.g. "According to the CBP CSMS notice...").
6. Never promise that an importer is compliant or cleared.`;

export type AskResult = {
  response: string | null;
  isLegalDeflection: boolean;
  usedLlm: boolean;
};

export const askClearportFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<AskResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // No API key configured — signal client to use local mock answer
    if (!apiKey) {
      return { response: null, isLegalDeflection: false, usedLlm: false };
    }

    const lower = data.query.toLowerCase();
    if (LEGAL_TRIGGERS.some((t) => lower.includes(t))) {
      return { response: DEFLECTION, isLegalDeflection: true, usedLlm: true };
    }

    // Build context from user's products
    const productContext =
      data.productHtsCodes.length || data.productCategories.length
        ? `The user imports products with HTS codes: ${data.productHtsCodes.join(", ") || "not specified"} and categories: ${data.productCategories.join(", ") || "not specified"}, primarily from China to the United States.`
        : "The user monitors China → USA import updates.";

    const alertContext =
      data.contextAlertTitle
        ? `The user is asking in the context of this specific alert: "${data.contextAlertTitle}" from ${data.contextAlertSource ?? "official sources"}.`
        : "";

    // Dynamic import keeps the SDK out of client bundles
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [productContext, alertContext, `Question: ${data.query}`]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    const content = message.content[0];
    const response = content.type === "text" ? content.text : null;

    return { response, isLegalDeflection: false, usedLlm: true };
  });
