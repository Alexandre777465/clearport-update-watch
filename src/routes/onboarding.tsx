import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MarketingNav } from "@/components/MarketingNav";
import { Check } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const categories = [
  "Electronics", "Textiles / apparel", "Toys", "Furniture", "Kitchenware",
  "Cosmetics", "Food-contact products", "Packaging", "Fitness accessories", "Home goods", "Other consumer goods",
];

const steps = ["Import route", "Categories", "HTS codes", "Saved products", "Alert frequency", "Recipients"];

function Onboarding() {
  const [step, setStep] = useState(0);
  const [selectedCats, setSelectedCats] = useState<string[]>(["Electronics"]);
  const [freq, setFreq] = useState("weekly");

  const toggleCat = (c: string) =>
    setSelectedCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Set up monitoring</h1>
        <p className="text-sm text-muted-foreground">Tell ClearPort what you import so we can match updates to your products.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <Badge key={s} variant={i === step ? "default" : i < step ? "secondary" : "outline"}>
              {i < step && <Check className="mr-1 h-3 w-3" />} {i + 1}. {s}
            </Badge>
          ))}
        </div>

        <Card className="mt-6 p-6">
          {step === 0 && (
            <div>
              <h2 className="font-semibold">Choose your import route</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pick where your goods ship from and to.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button className="rounded-md border-2 border-primary bg-primary/5 p-5 text-left">
                  <div className="font-semibold">China → USA</div>
                  <div className="text-xs text-muted-foreground">Monitor U.S. import updates for China-origin goods.</div>
                </button>
                <button disabled className="rounded-md border border-border bg-slate-100 p-5 text-left opacity-60">
                  <div className="font-semibold">Other routes</div>
                  <div className="text-xs text-muted-foreground">Coming soon</div>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-semibold">Choose product categories</h2>
              <p className="mt-1 text-sm text-muted-foreground">Select all that apply.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = selectedCats.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCat(c)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-semibold">Add HS / HTS codes (optional)</h2>
              <p className="mt-1 text-sm text-muted-foreground">Add codes you know. You can update these later.</p>
              <div className="mt-5 space-y-3">
                <Input placeholder="e.g. 8518.22.00" />
                <Input placeholder="e.g. 6109.10.00" />
                <Button variant="outline" size="sm">+ Add another code</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-semibold">Add a saved product</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div><Label>Product name</Label><Input className="mt-1.5" placeholder="Bluetooth speaker" /></div>
                <div><Label>Material</Label><Input className="mt-1.5" placeholder="ABS plastic, lithium battery" /></div>
                <div className="sm:col-span-2">
                  <Label>Short description</Label>
                  <Textarea className="mt-1.5" placeholder="Portable rechargeable Bluetooth speaker with 10W output." />
                </div>
                <div><Label>Intended use</Label><Input className="mt-1.5" placeholder="Consumer audio" /></div>
                <div><Label>Supplier country</Label><Input className="mt-1.5" defaultValue="China" /></div>
                <div><Label>Sales channel</Label><Input className="mt-1.5" placeholder="Amazon" /></div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-semibold">Choose alert frequency</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { id: "instant", label: "Instant", desc: "As soon as a relevant update is published." },
                  { id: "daily", label: "Daily digest", desc: "One summary email each business day." },
                  { id: "weekly", label: "Weekly digest", desc: "One curated summary every Monday." },
                ].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setFreq(o.id)}
                    className={`rounded-md border-2 p-4 text-left ${freq === o.id ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div className="font-semibold">{o.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="font-semibold">Email recipients</h2>
              <p className="mt-1 text-sm text-muted-foreground">Who should receive ClearPort alerts?</p>
              <div className="mt-5 space-y-3">
                <Input placeholder="you@yourcompany.com" />
                <Input placeholder="broker@brokerage.com (optional)" />
                <Button variant="outline" size="sm">+ Add another recipient</Button>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>Continue</Button>
            ) : (
              <Link to="/dashboard"><Button>Finish & open dashboard</Button></Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}