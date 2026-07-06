import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "about_clearport",
  title: "About ClearPort",
  description:
    "Return a short overview of ClearPort — a U.S. trade compliance monitoring service that alerts importers to HTS, tariff, and regulatory changes affecting their products.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: [
          "ClearPort helps U.S. importers monitor trade rule changes.",
          "",
          "Capabilities:",
          "- Scans official sources (CBP, USTR, Federal Register, CPSC, FDA, EPA, DOT, USDA) for updates.",
          "- Matches updates to a user's monitored products via HTS codes, categories, and origin countries.",
          "- Runs deterministic regulatory modules (children's products, electronics, batteries, textiles, cosmetics, food, medical devices, chemicals, furniture, sports, automotive) to build a per-product risk report and document checklist.",
          "- Provides a grounded assistant that answers questions only from verified findings and official sources; it does not give legal advice.",
          "",
          "Learn more: https://clearport-update-watch.lovable.app",
        ].join("\n"),
      },
    ],
  }),
});

// keep zod referenced so tree-shaking preserves type import for future tools
void z;