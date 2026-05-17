import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/preferences")({
  component: Preferences,
  head: () => ({
    meta: [
      { title: "Alert preferences — ClearPort" },
      { name: "description", content: "Choose how and when ClearPort delivers import-rule alerts." },
    ],
  }),
});

const alertTypes = [
  "China-origin updates",
  "HTS code updates",
  "Tariff / exclusion updates",
  "Labeling and marking updates",
  "Forced labor updates",
  "AD/CVD updates",
  "Effective-date reminders",
];

function Preferences() {
  const [freq, setFreq] = useState("weekly");
  const [recipients, setRecipients] = useState([
    { email: "jane@yourbrand.com", role: "Owner" },
  ]);
  const [brokerEmail, setBrokerEmail] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [enabledTypes, setEnabledTypes] = useState<Record<string, boolean>>(
    Object.fromEntries(alertTypes.map((t, i) => [t, i < 5])),
  );

  const addRecipient = () => {
    if (!newRecipient.trim()) return;
    setRecipients((r) => [...r, { email: newRecipient.trim(), role: "Team" }]);
    setNewRecipient("");
  };

  return (
    <AppShell title="Alert preferences" subtitle="Control how and when you receive import-rule updates">
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
          <div className="mt-4 space-y-3 text-sm">
            {recipients.map((r, i) => (
              <div key={r.email} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="font-medium">{r.email}</div>
                  <div className="text-xs text-muted-foreground">{r.role}</div>
                </div>
                {r.role !== "Owner" && (
                  <Button variant="ghost" size="sm" onClick={() => setRecipients((cur) => cur.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} placeholder="team@yourbrand.com" />
              <Button variant="outline" onClick={addRecipient}>Add</Button>
            </div>
            <div>
              <Label>Broker email (optional)</Label>
              <Input value={brokerEmail} onChange={(e) => setBrokerEmail(e.target.value)} className="mt-1.5" placeholder="broker@brokerage.com" />
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold">Alert types to include</h2>
          <p className="mt-1 text-xs text-muted-foreground">Choose which kinds of official updates ClearPort should send you.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {alertTypes.map((t) => (
              <div key={t} className="flex items-center justify-between rounded-md border border-border p-3">
                <span className="text-sm">{t}</span>
                <Switch
                  checked={enabledTypes[t]}
                  onCheckedChange={(v) => setEnabledTypes((cur) => ({ ...cur, [t]: v }))}
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => toast.success("Test email queued (placeholder).")}>Send test email</Button>
            <Button onClick={() => toast.success("Preferences saved.")}>Save preferences</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
