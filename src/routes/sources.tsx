import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SourceStatus } from "@/lib/mock";
import { fetchSources } from "@/lib/api";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { useLang, t, tStatus } from "@/lib/i18n";

export const Route = createFileRoute("/sources")({
  component: Sources,
  head: () => ({
    meta: [
      { title: "Sources — ClearPort" },
      {
        name: "description",
        content: "Official U.S. import-rule sources monitored by ClearPort.",
      },
    ],
  }),
});

function statusClasses(status: SourceStatus["status"]): string {
  switch (status) {
    case "Active":
      return "border-green-200 bg-green-50 text-green-800";
    case "Degraded":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "Error":
      return "border-red-200 bg-red-50 text-red-800";
    case "Unavailable":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default: // Never checked
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function Sources() {
  const lang = useLang();
  const { data: sources, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : null;

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t(lang, "nav_sources")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(lang, "srcp_sub")}
        </p>
      </div>
      <Card className="mb-6 border-blue-100 bg-blue-50/40 p-4 text-sm">
        <div className="font-medium">
          {t(lang, "srcp_banner")}
        </div>
        {!isLoading && !isError && sources && lastRefresh && (
          <div className="mt-1 text-xs text-muted-foreground">
            {t(lang, "srcp_loaded_pre")} {lastRefresh}. {t(lang, "srcp_loaded_post")}
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : isError || !sources ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
          <div>
            <p className="font-medium">{t(lang, "srcp_unavailable_title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(lang, "srcp_unavailable_body")}
            </p>
          </div>
        </Card>
      ) : sources.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t(lang, "srcp_none")}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((s) => (
            <Card key={s.name} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.type}</p>
                </div>
                <Badge variant="outline" className={statusClasses(s.status)}>
                  {tStatus(lang, s.status)}
                </Badge>
              </div>

              {s.status === "Unavailable" ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t(lang, "srcp_deactivated")}
                </p>
              ) : (
                <div className="mt-4 grid gap-1 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">{t(lang, "srcp_schedule")}</span>{" "}
                    {s.frequency}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{t(lang, "srcp_last_checked")}</span>{" "}
                    {s.lastChecked}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      {t(lang, "srcp_last_sync")}
                    </span>{" "}
                    {s.lastSuccessfulSync}
                  </div>
                  {s.error && (
                    <div className="mt-1 text-red-700">
                      <span className="font-medium">{t(lang, "srcp_recent_error")}</span> {s.error}
                    </div>
                  )}
                </div>
              )}

              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {t(lang, "visit_official_source")} <ExternalLink className="h-3 w-3" />
              </a>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        {t(lang, "srcp_footer")}
      </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
