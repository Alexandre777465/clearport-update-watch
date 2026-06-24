import { createFileRoute } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { useLang, t } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({ meta: [{ title: "Privacy — ClearPort" }] }),
});

function Privacy() {
  const lang = useLang();
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-semibold">{t(lang, "priv_title")}</h1>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>{t(lang, "priv_p1")}</p>
          <p>{t(lang, "priv_p2")}</p>
          <p>{t(lang, "priv_p3")}</p>
          <p>{t(lang, "priv_p4")}</p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
