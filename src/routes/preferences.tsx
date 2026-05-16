import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/preferences")({ component: Preferences });

function Preferences() {
  const [freq, setFreq] = useState("weekly");
  return (
    <AppShell title="Alert preferences" subtitle="Control how and when you receive import rule updates">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">Delivery frequency</h2>
          <div className="mt-4 space-y-3">
            {[
              { id: "instant", label: "Instant alerts", desc: "As soon as a relevant update is published." },
              { id: "daily", label: "Daily digest", desc: "One email per business day." },
              { id: "weekly", label: "Weekly digest", desc: "One curated summary every Monday." },
            ].map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${freq === o.id ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="radio" name="freq" checked={freq === o.id} onChange={() => setFreq(o.id)} className="mt-1" />
                <div>
                  <div className="font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Recipients</h2>
          <div className="mt-4 space-y-3">
            <div><Label>Primary email</Label><Input className="mt-1.5" defaultValue="jane@yourbrand.com" /></div>
            <div><Label>Broker email (optional)</Label><Input className="mt-1.5" placeholder="broker@brokerage.com" /></div>
            <Button variant="outline" size="sm">+ Add recipient</Button>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold">What to include in digest</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "New relevant updates",
              "Upcoming effective dates",
              "Saved products affected",
              "Broker questions",
              "Official source links",
              "China-origin updates only",
            ].map((opt, i) => (
              <div key={opt} className="flex items-center justify-between rounded-md border border-border p-3">
                <span className="text-sm">{opt}</span>
                <Switch defaultChecked={i < 5} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline">Send test email</Button>
            <Button>Save preferences</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}