import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { savedProducts } from "@/lib/mock";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/products")({ component: Products });

function Products() {
  return (
    <AppShell title="Monitored products" subtitle="Add products and HTS codes to receive matched alerts">
      <div className="mb-4 flex items-center justify-end">
        <Button><Plus className="mr-2 h-4 w-4" /> Add product</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {savedProducts.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">{p.category} · HTS {p.hts}</div>
              </div>
              <Badge variant="outline">{p.channel}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Origin:</span> {p.origin}</div>
              <div><span className="text-muted-foreground">Destination:</span> {p.destination}</div>
              <div><span className="text-muted-foreground">Supplier:</span> {p.supplier}</div>
              <div><span className="text-muted-foreground">Related alerts:</span> {p.relatedAlerts}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm">View related alerts</Button>
              <Button variant="ghost" size="sm">Edit</Button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}