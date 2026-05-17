import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sources } from "@/lib/mock";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/sources")({
  component: Sources,
  head: () => ({
    meta: [
      { title: "Sources — ClearPort" },
      { name: "description", content: "Official U.S. import-rule sources monitored by ClearPort." },
    ],
  }),
});

function Sources() {
  return (
    <AppShell
      title="Sources"
      subtitle="Official sources ClearPort continuously monitors for U.S. import-rule updates"
    >
      <Card className="mb-6 border-blue-100 bg-blue-50/40 p-4 text-sm">
        <div className="font-medium">ClearPort continuously checks official sources and matches updates to your monitored products.</div>
        <div className="mt-1 text-xs text-muted-foreground">Last source check: 2 hours ago · Next scheduled check: in ~1 hour</div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {sources.map((s) => (
          <Card key={s.name} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold">{s.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.type}</p>
              </div>
              <Badge
                variant="outline"
                className={
                  s.status === "Active"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }
              >
                {s.status}
              </Badge>
            </div>
            <div className="mt-4 grid gap-1 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">Frequency:</span> {s.frequency}</div>
              <div><span className="font-medium text-foreground">Last checked:</span> {s.lastChecked}</div>
              <div><span className="font-medium text-foreground">Last update found:</span> {s.lastUpdate}</div>
            </div>
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

      <p className="mt-8 text-xs text-muted-foreground">
        ClearPort summaries describe what an update <em>may</em> mean. Final interpretation should be confirmed with a licensed customs broker.
      </p>
    </AppShell>
  );
}
