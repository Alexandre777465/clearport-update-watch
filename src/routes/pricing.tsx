import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNav, MarketingFooter } from "@/components/MarketingNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({ component: Pricing });

const tiers = [
  { name: "Free", price: "$0", period: "/mo", features: ["Weekly public digest", "Limited alerts", "1 saved product"] },
  { name: "Importer", price: "$29", period: "/mo", features: ["Category alerts", "Weekly digest", "5 saved products", "China → USA monitoring"] },
  { name: "Pro Importer", price: "$79", period: "/mo", highlight: true, features: ["HTS-specific monitoring", "Instant alerts", "Broker summaries", "Ask ClearPort assistant", "25 saved products"] },
  { name: "Team", price: "$149", period: "/mo", features: ["Multiple users", "Multiple product lists", "Email alerts", "Exportable summaries", "100 saved products"] },
  { name: "Agency / Forwarder", price: "$499", period: "/mo", features: ["Monitor updates for multiple clients", "Client workspaces", "White-label summaries", "Team access"] },
  { name: "Enterprise", price: "Custom", period: "", features: ["API", "Custom sources", "Custom workflows", "Priority support"] },
];

function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <section className="border-b border-border bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Pricing for every importer.</h1>
          <p className="mt-3 text-muted-foreground">Start free. Upgrade when you need HTS-level monitoring or team access.</p>
        </div>
      </section>
      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((t) => (
            <Card key={t.name} className={`p-6 ${t.highlight ? "border-primary ring-2 ring-primary/20" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t.name}</h3>
                {t.highlight && <Badge>Most popular</Badge>}
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-semibold">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/onboarding" className="mt-6 block">
                <Button className="w-full" variant={t.highlight ? "default" : "outline"}>
                  {t.name === "Enterprise" ? "Contact sales" : "Get started"}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}