import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SourceStatus } from "@/lib/mock";
import { fetchSources } from "@/lib/api";
import { ExternalLink, AlertTriangle } from "lucide-react";

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
  const { data: sources, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : null;

  return (
    <AppShell
      title="Sources"
      subtitle="Official sources ClearPort monitors for U.S. import-rule updates"
    >
      <Card className="mb-6 border-blue-100 bg-blue-50/40 p-4 text-sm">
        <div className="font-medium">
          ClearPort checks official sources and matches updates to your monitored
          products. Status below is read live from the monitoring backend.
        </div>
        {!isLoading && !isError && sources && lastRefresh && (
          <div className="mt-1 text-xs text-muted-foreground">
            Status loaded {lastRefresh}. Each source shows its real schedule and
            last successful sync.
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
            <p className="font-medium">Status unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We can't reach the monitoring backend right now, so live source
              health can't be shown. Please check back shortly.
            </p>
          </div>
        </Card>
      ) : sources.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No sources are configured.
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
                  {s.status}
                </Badge>
              </div>

              {s.status === "Unavailable" ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  This source is deactivated — no reliable official feed is
                  currently connected. It is not being checked.
                </p>
              ) : (
                <div className="mt-4 grid gap-1 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Schedule:</span>{" "}
                    {s.frequency}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Last checked:</span>{" "}
                    {s.lastChecked}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      Last successful sync:
                    </span>{" "}
                    {s.lastSuccessfulSync}
                  </div>
                  {s.error && (
                    <div className="mt-1 text-red-700">
                      <span className="font-medium">Recent error:</span> {s.error}
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
                Visit official source <ExternalLink className="h-3 w-3" />
              </a>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        ClearPort summaries describe what an update <em>may</em> mean. Final
        interpretation should be confirmed with a licensed customs broker.
      </p>
    </AppShell>
  );
}
