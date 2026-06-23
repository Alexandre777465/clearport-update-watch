import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({ meta: [{ title: "Privacy — ClearPort" }] }),
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold">Privacy</h1>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>
            ClearPort collects the product details and email address you submit so it can
            generate an import-readiness report and monitor official U.S. trade sources for
            updates relevant to your product.
          </p>
          <p>
            We store your submission (product name, description, HTS code, origin/destination,
            product attributes and email) to run scans and send you monitoring alerts. We do not
            sell your data. Your email is used only for ClearPort monitoring communications.
          </p>
          <p>
            Official source documents are retrieved from public U.S. government sources. AI is
            used only to explain and summarize stored official data — not as a source of legal,
            tariff, or compliance facts.
          </p>
          <p>To request deletion of your data, contact the pilot administrator.</p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
