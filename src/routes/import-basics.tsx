import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Hash, Flag, Percent, Tags, MessageSquare, AlertOctagon } from "lucide-react";

export const Route = createFileRoute("/import-basics")({
  component: ImportBasics,
  head: () => ({
    meta: [
      { title: "Import Basics — ClearPort" },
      { name: "description", content: "Educational guidance for importers buying from China and shipping to the United States." },
    ],
  }),
});

const sections = [
  {
    icon: FileText,
    title: "Common documents to prepare",
    points: [
      "Commercial invoice with accurate product description and value.",
      "Packing list matching the invoice line items.",
      "Bill of lading or air waybill from the carrier.",
      "Importer of Record information and customs bond.",
      "Any product-specific permits (FDA, FCC, CPSC, etc.) where applicable.",
    ],
  },
  {
    icon: Hash,
    title: "HTS code basics",
    points: [
      "The Harmonized Tariff Schedule (HTS) determines the duty rate and treatment of your product at entry.",
      "Use the 10-digit U.S. HTS number on entries; the first 6 digits are international.",
      "Small description changes (material, function, use) can change classification.",
      "Misclassification can lead to underpayment, penalties, or entry rejection.",
    ],
  },
  {
    icon: Flag,
    title: "Country of origin",
    points: [
      "Country of origin is generally where the product was made, not where it shipped from.",
      "Most goods must be marked with country of origin in English in a conspicuous place.",
      "Substantial transformation rules can change country of origin when work is done in a second country.",
    ],
  },
  {
    icon: Percent,
    title: "Section 301 tariff monitoring",
    points: [
      "Section 301 actions apply additional tariffs to many China-origin goods.",
      "Some HTS codes have exclusions; exclusion lists are updated periodically.",
      "Effective dates and product scope can change — monitor USTR notices.",
    ],
  },
  {
    icon: Tags,
    title: "Labeling and marking basics",
    points: [
      "Country of origin marking is required for most imported goods.",
      "Textiles must include fiber content, care instructions, and origin.",
      "Electronics may need FCC or energy labeling depending on the product.",
    ],
  },
  {
    icon: MessageSquare,
    title: "Broker questions to ask before shipment",
    points: [
      "Is my HTS classification still correct for this shipment?",
      "Are there any current 301 exclusions that apply?",
      "Are my labels and markings compliant?",
      "Do I need any agency permits (FDA, FCC, CPSC, etc.)?",
      "Are there any UFLPA or forced-labor documentation requirements?",
    ],
  },
  {
    icon: AlertOctagon,
    title: "Common reasons shipments face delays",
    points: [
      "Incomplete or inconsistent invoice / packing list.",
      "Incorrect HTS classification or missing exclusion claim.",
      "Missing country-of-origin marking on goods or packaging.",
      "Missing forced-labor or supply-chain documentation.",
      "Random or targeted CBP examinations.",
    ],
  },
];

function ImportBasics() {
  return (
    <AppShell title="Import Basics" subtitle="General guidance for importers shipping China → USA">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Route: China → United States</Badge>
        <Link to="/ask"><Button variant="outline" size="sm">Ask ClearPort a question</Button></Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {sections.map(({ icon: Icon, title, points }) => (
          <Card key={title} className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">{title}</h2>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <strong>Disclaimer.</strong> ClearPort provides educational and source-backed monitoring. It is not legal advice and does not provide final customs answers. Final interpretation should be confirmed with your customs broker.
      </Card>
    </AppShell>
  );
}
