import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCard } from "@/components/AlertCard";
import { alerts, savedProducts } from "@/lib/mock";
import { useAlertState } from "@/lib/alert-store";
import { Radar, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Monitoring Center — ClearPort" },
      { name: "description", content: "Import-rule updates matched to your saved products, categories, route, and HTS codes." },
    ],
  }),
});

function Dashboard() {
  const { dismissed } = useAlertState();
  const visible = alerts.filter((a) => !dismissed.includes(a.id));

  const savedHts = savedProducts.map((p) => p.hts);
  const savedCats = savedProducts.map((p) => p.category);
  const relevantToProducts = visible.filter(
    (a) => a.htsCodes.some((h) => savedHts.includes(h)) || a.categories.some((c) => savedCats.includes(c)),
  );
  const chinaUpdates = visible.filter((a) => a.originCountries.includes("China"));
  const today = new Date("2026-05-17");
  const upcoming = visible
    .filter((a) => {
      const d = new Date(a.effectiveDate);
      const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 45;
    })
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const brokerVerificationCount = visible.filter((a) => a.relevance !== "Possible match").length;

  const stats = [
    { label: "Relevant updates this week", value: relevantToProducts.length, hint: "Matched to your products" },
    { label: "China → USA updates", value: chinaUpdates.length, hint: "Affecting China-origin goods" },
    { label: "Upcoming effective dates", value: upcoming.length, hint: "In next 45 days" },
    { label: "HTS codes monitored", value: new Set(savedHts).size, hint: `Across ${savedProducts.length} products` },
    { label: "Broker verification needed", value: brokerVerificationCount, hint: "Likely / direct matches" },
  ];

  return (
    <AppShell
      title="Import updates that may affect your products"
      subtitle="ClearPort monitors official U.S. import-rule sources and matches updates to your products, categories, route, and HTS codes."
    >
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-blue-100 bg-blue-50/40 p-4">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Radar className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium">ClearPort continuously checks official sources and matches updates to your monitored products.</div>
            <div className="text-xs text-muted-foreground">Last source check: 2 hours ago · Next scheduled check: in ~1 hour · Source status: <span className="text-green-700">Active</span></div>
          </div>
        </div>
        <Link to="/sources"><Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4" /> View sources</Button></Link>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="relevant" className="mt-8">
        <TabsList>
          <TabsTrigger value="relevant">Relevant to my products ({relevantToProducts.length})</TabsTrigger>
          <TabsTrigger value="china">All China → USA updates ({chinaUpdates.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming effective dates ({upcoming.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="relevant" className="mt-4 space-y-4">
          {relevantToProducts.length === 0 ? <EmptyState label="No updates currently match your saved products." /> : relevantToProducts.map((a) => <AlertCard key={a.id} alert={a} />)}
        </TabsContent>
        <TabsContent value="china" className="mt-4 space-y-4">
          {chinaUpdates.length === 0 ? <EmptyState label="No China-origin updates right now." /> : chinaUpdates.map((a) => <AlertCard key={a.id} alert={a} />)}
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4 space-y-4">
          {upcoming.length === 0 ? <EmptyState label="No upcoming effective dates in the next 45 days." /> : upcoming.map((a) => <AlertCard key={a.id} alert={a} />)}
        </TabsContent>
      </Tabs>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        ClearPort provides educational, source-backed monitoring. Final interpretation should be confirmed with your customs broker.
      </p>
    </AppShell>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">{label}</Card>
  );
}
