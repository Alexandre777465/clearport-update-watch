import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/sample-alert")({ component: Sample });

function Sample() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Badge variant="outline" className="mb-4">Sample alert</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          USTR updates Section 301 tariff exclusion status for selected China-origin products.
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Direct HTS match</Badge>
          <Badge variant="outline">USTR / Federal Register</Badge>
          <Badge variant="outline">Origin: China</Badge>
          <Badge variant="outline">Destination: United States</Badge>
          <Badge variant="outline">Effective 2026-06-01</Badge>
        </div>

        <Card className="mt-8 p-6">
          <h2 className="text-lg font-semibold">Plain-English summary</h2>
          <p className="mt-2 text-muted-foreground">
            Certain tariff exclusions for China-origin products have been extended, modified, or allowed to expire. Importers using affected HTS codes should verify whether their products remain eligible for exclusion treatment.
          </p>
        </Card>

        <Card className="mt-4 p-6">
          <h2 className="text-lg font-semibold">Why this may matter</h2>
          <p className="mt-2 text-muted-foreground">
            If your product uses one of the affected HTS codes, your landed cost or filing process may change.
          </p>
        </Card>

        <Card className="mt-4 p-6">
          <h2 className="text-lg font-semibold">What to verify with broker</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              "Does your saved HTS code appear in the notice?",
              "Is your product description covered by the exclusion?",
              "What is the effective date?",
              "Does your entry require special filing treatment?",
              "Does your supplier invoice include the required product description?",
            ].map((q, i) => (
              <li key={q} className="flex gap-3 rounded-md border border-border p-3">
                <span className="font-medium text-primary">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <Button><Download className="mr-2 h-4 w-4" /> Export Broker Questions</Button>
            <a href="https://ustr.gov/" target="_blank" rel="noreferrer">
              <Button variant="outline">View official source <ExternalLink className="ml-2 h-3 w-3" /></Button>
            </a>
          </div>
        </Card>

        <Card className="mt-8 border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          ClearPort provides source-backed summaries for preparation. It is not legal advice and does not guarantee customs clearance.
        </Card>

        <div className="mt-10 text-center">
          <Link to="/onboarding"><Button size="lg">Start Monitoring your products</Button></Link>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}