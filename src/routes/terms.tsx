import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({ meta: [{ title: "Terms & Disclaimer — ClearPort" }] }),
});

function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold">Terms &amp; Disclaimer</h1>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            ClearPort does not replace a licensed customs broker, a lawyer, or an accredited
            testing laboratory.
          </p>
          <p>
            ClearPort provides source-backed, informational summaries to help importers prepare.
            Every factual rate or requirement shown is linked to an official U.S. government
            source. Findings labeled “Applicability needs confirmation” or “No verified source
            found” are not assertions that a rule applies to your product.
          </p>
          <p>
            ClearPort does not guarantee import clearance, classification accuracy, or regulatory
            compliance. Duty rates depend on correct HTS classification, which only a licensed
            broker can confirm. Always verify findings with your customs broker and the relevant
            agency before making import decisions.
          </p>
          <p>
            ClearPort is provided “as is” for a private pilot, without warranties. Use is at your
            own risk.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
