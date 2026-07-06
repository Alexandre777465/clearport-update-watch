import { defineTool } from "@lovable.dev/mcp-js";

const MODULES: Array<{ id: string; name: string; covers: string }> = [
  { id: "automotive", name: "Automotive", covers: "Vehicles, parts, tires — DOT/NHTSA/EPA requirements." },
  { id: "electronics", name: "Electronics", covers: "Radios and electronic devices — FCC authorization, DoE energy conservation." },
  { id: "batteries", name: "Batteries", covers: "Lithium and other batteries — DOT/PHMSA HazMat, IATA air rules." },
  { id: "childrens", name: "Children's products", covers: "Toys, apparel, and gear for children under 12 — CPSC (CPSIA), lead, phthalates, tracking labels." },
  { id: "textiles", name: "Textiles & apparel", covers: "Fiber content, care labeling, wool/fur labeling, flammability." },
  { id: "cosmetics", name: "Cosmetics", covers: "FDA cosmetics (MoCRA) — facility registration, product listing, safety substantiation." },
  { id: "food", name: "Food", covers: "FDA food — FSVP, prior notice, facility registration, labeling." },
  { id: "medical_devices", name: "Medical devices", covers: "FDA device classification, 510(k), UDI, establishment registration." },
  { id: "chemicals", name: "Chemicals", covers: "EPA TSCA, FIFRA — inventory, PMN, pesticide registration." },
  { id: "furniture", name: "Furniture", covers: "CPSC stability standards, formaldehyde (TSCA VI), flammability." },
  { id: "sports", name: "Sports & recreation", covers: "Bicycles, helmets, protective gear — CPSC standards." },
];

export default defineTool({
  name: "list_regulatory_modules",
  title: "List regulatory modules",
  description:
    "List the regulatory modules ClearPort evaluates against monitored products, with a short description of the U.S. rules each module covers.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: MODULES.map((m) => `- ${m.name} (${m.id}): ${m.covers}`).join("\n"),
      },
    ],
    structuredContent: { modules: MODULES },
  }),
});