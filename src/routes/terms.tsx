import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { useLang, t } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({ meta: [{ title: "Terms & Disclaimer — ClearPort" }] }),
});

function Terms() {
  const lang = useLang();
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold">{t(lang, "terms_title")}</h1>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t(lang, "terms_p1")}</p>
          <p>{t(lang, "terms_p2")}</p>
          <p>{t(lang, "terms_p3")}</p>
          <p>{t(lang, "terms_p4")}</p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
