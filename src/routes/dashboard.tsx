import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCard } from "@/components/AlertCard";
import { alerts as mockAlerts, savedProducts as mockProducts } from "@/lib/mock";
import { fetchAlerts, fetchProducts } from "@/lib/api";
import { useAlertState } from "@/lib/alert-store";
import { riskColor } from "@/components/RiskScanCard";
import type { RiskLevel } from "@/lib/api";
import {
  AlertTriangle, Package, Bell, ArrowRight, ShieldCheck,
  FileWarning, ScanSearch, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Import Risk Cockpit — ClearPort" },
      {
        name: "description",
        content:
          "Your import risk overview: product risk levels, missing documents, new alerts, and next actions.",
      },
    ],
  }),
});

// ── Mock risk data for demo mode ──────────────────────────────────────────────
// When the backend isn't connected, products show simulated risk levels so the
// cockpit looks meaningful in Lovable preview.

const MOCK_PRODUCT_RISK: Record<
  string,
  { level: RiskLevel; score: number; missing: string[]; nextAction: string }
> = {
  "prod-1": {
    level: "High",
    score: 52,
    missing: ["UN 38.3 Test Report", "CPSIA Certificate"],
    nextAction: "Request battery test report from supplier before booking air freight.",
  },
  "prod-2": {
    level: "Medium",
    score: 65,
    missing: ["Country of Origin Declaration"],
    nextAction: "Ask supplier for signed country-of-origin declaration.",
  },
  "prod-3": {
    level: "Critical",
    score: 30,
    missing: ["Children's Product Certificate", "CPSC test reports", "UN 38.3"],
    nextAction:
      "Priority: request CPSIA test reports — cannot import without these.",
  },
};

function getProductRisk(id: string) {
  return (
    MOCK_PRODUCT_RISK[id] ?? {
      level: "Medium" as RiskLevel,
      score: 60,
      missing: [] as string[],
      nextAction: "Review HTS classification with your customs broker.",
    }
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { dismissed } = useAlertState();

  const { data: allAlerts = mockAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    staleTime: 60_000,
    placeholderData: mockAlerts,
  });

  const { data: products = mockProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    staleTime: 120_000,
    placeholderData: mockProducts,
  });

  const isLoading = alertsLoading || productsLoading;
  const visible = allAlerts.filter((a) => !dismissed.includes(a.id));
  const savedHts = products.map((p) => p.hts);
  const savedCats = products.map((p) => p.category);
  const relevant = visible.filter(
    (a) =>
      a.htsCodes.some((h) => savedHts.includes(h)) ||
      a.categories.some((c) => savedCats.includes(c)),
  );

  const criticalCount = products.filter(
    (p) => getProductRisk(p.id).level === "Critical",
  ).length;
  const highCount = products.filter(
    (p) => getProductRisk(p.id).level === "High",
  ).length;
  const totalMissing = products.reduce(
    (n, p) => n + getProductRisk(p.id).missing.length,
    0,
  );
  const avgScore = products.length
    ? Math.round(
        products.reduce((s, p) => s + getProductRisk(p.id).score, 0) /
          products.length,
      )
    : 0;

  const stats = [
    {
      label: "Products monitored",
      value: products.length,
      icon: Package,
      colorClass: "text-primary",
    },
    {
      label: "New alerts",
      value: relevant.length,
      icon: Bell,
      colorClass: relevant.length > 0 ? "text-amber-600" : "text-green-600",
    },
    {
      label: "Critical / High risk",
      value: criticalCount + highCount,
      icon: AlertTriangle,
      colorClass:
        criticalCount > 0
          ? "text-red-600"
          : highCount > 0
          ? "text-orange-600"
          : "text-green-600",
    },
    {
      label: "Missing documents",
      value: totalMissing,
      icon: FileWarning,
      colorClass: totalMissing > 0 ? "text-amber-600" : "text-green-600",
    },
    {
      label: "Avg. readiness",
      value: `${avgScore}%`,
      icon: CheckCircle2,
      colorClass:
        avgScore >= 70
          ? "text-green-600"
          : avgScore >= 45
          ? "text-amber-600"
          : "text-red-600",
    },
  ];

  return (
    <AppShell
      title="Import Risk Cockpit"
      subtitle="Risk levels, missing documents, and next actions for your products."
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${s.colorClass}`} />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              {isLoading ? (
                <Skeleton className="mt-2 h-7 w-10" />
              ) : (
                <p className={`mt-1.5 text-2xl font-semibold ${s.colorClass}`}>
                  {s.value}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Product cockpit */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Products</h2>
          <Link to="/products">
            <Button variant="ghost" size="sm">
              Manage <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="flex flex-col items-center gap-4 p-8 text-center">
            <ScanSearch className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No products monitored yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a product to get a risk scan, document checklist, and email
                alerts.
              </p>
            </div>
            <Link to="/">
              <Button>Add your first product</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {products.map((p) => {
              const risk = getProductRisk(p.id);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Package className="h-4 w-4 text-primary" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${riskColor(risk.level)}`}
                        >
                          {risk.level} risk
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        HTS {p.hts || "—"} · {p.origin} → {p.destination}
                      </p>

                      {risk.missing.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {risk.missing.map((doc) => (
                            <span
                              key={doc}
                              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                            >
                              <FileWarning className="h-2.5 w-2.5" />
                              {doc}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="mt-2 text-xs font-medium text-foreground">
                        → {risk.nextAction}
                      </p>
                    </div>

                    {/* Readiness bar */}
                    <div className="shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          Readiness
                        </span>
                        <div className="h-1.5 w-20 rounded-full bg-slate-100">
                          <div
                            className={`h-1.5 rounded-full ${
                              risk.score >= 70
                                ? "bg-green-500"
                                : risk.score >= 45
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${risk.score}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            risk.score >= 70
                              ? "text-green-700"
                              : risk.score >= 45
                              ? "text-amber-700"
                              : "text-red-700"
                          }`}
                        >
                          {risk.score}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent alerts */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Recent alerts</h2>
          <Link to="/alerts">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : relevant.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-green-500" />
            No new alerts matching your products. ClearPort will notify you when
            something relevant changes.
          </Card>
        ) : (
          <div className="space-y-4">
            {relevant.slice(0, 3).map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        ClearPort provides informational monitoring. Verify with your customs
        broker before importing.
      </p>
    </AppShell>
  );
}
