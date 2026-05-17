import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { savedProducts, relevantAlertsForProduct, type SavedProduct } from "@/lib/mock";
import { Plus, Package } from "lucide-react";

export const Route = createFileRoute("/products")({
  component: Products,
  head: () => ({
    meta: [
      { title: "My Products — ClearPort" },
      { name: "description", content: "Add the products you import. ClearPort watches import-rule updates for each one." },
    ],
  }),
});

function Products() {
  const [products, setProducts] = useState<SavedProduct[]>(savedProducts);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<SavedProduct | null>(null);

  const addProduct = (p: SavedProduct) => {
    setProducts((cur) => [...cur, p]);
    setOpen(false);
  };

  return (
    <AppShell
      title="My Products"
      subtitle="Add your products. ClearPort watches import rule updates for you."
    >
      <div className="mb-4 flex items-center justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add product</Button>
          </DialogTrigger>
          <AddProductDialog onAdd={addProduct} />
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => {
          const count = relevantAlertsForProduct(p.id).length;
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="font-semibold truncate">{p.name}</h3>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div>HTS: <span className="text-foreground">{p.hts}</span></div>
                <div>Route: <span className="text-foreground">{p.origin} → {p.destination}</span></div>
                <div>{count} alert{count === 1 ? "" : "s"} found</div>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => setViewing(p)}>View alerts</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && <ProductDetailDialog product={viewing} />}
      </Dialog>
    </AppShell>
  );
}

function AddProductDialog({ onAdd }: { onAdd: (p: SavedProduct) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [hts, setHts] = useState("");
  const [origin, setOrigin] = useState("China");
  const [destination, setDestination] = useState("United States");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: `p${Date.now()}`,
      name: name.trim(),
      category,
      description: "",
      material: "",
      intendedUse: "",
      hts: hts.trim() || "—",
      origin,
      destination,
      supplier: "—",
      supplierCountry: origin,
      channel: "—",
      alertFrequency: "Weekly",
      relatedAlerts: 0,
      lastAlertDate: "—",
      upcomingEffective: null,
      lastMatchedSource: "—",
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add a product</DialogTitle>
        <DialogDescription>ClearPort will watch import-rule updates for this product.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Product name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bluetooth speaker" className="mt-1.5" />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label>HTS code <span className="text-muted-foreground text-xs">(if known)</span></Label>
          <Input value={hts} onChange={(e) => setHts(e.target.value)} placeholder="8517.13.00.00" className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Origin country</Label>
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Destination country</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1.5" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit}>Add product</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ProductDetailDialog({ product }: { product: SavedProduct }) {
  const related = relevantAlertsForProduct(product.id);
  const brokerQs = Array.from(new Set(related.flatMap((a) => a.brokerQuestions))).slice(0, 4);
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>HTS {product.hts} · {product.origin} → {product.destination}</DialogDescription>
      </DialogHeader>

      <div>
        <div className="mb-2 text-sm font-medium">Alerts for this product ({related.length})</div>
        {related.length === 0 ? (
          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">No alerts yet.</div>
        ) : (
          <ul className="space-y-2">
            {related.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-3 text-sm">
                <Link to="/alerts/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.title}</Link>
                <div className="mt-1 text-xs text-muted-foreground">Effective {a.effectiveDate}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {brokerQs.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium">Questions to ask your broker</div>
          <ul className="space-y-1 pl-5 text-sm text-muted-foreground list-disc">
            {brokerQs.map((q) => <li key={q}>{q}</li>)}
          </ul>
        </div>
      )}

      <DialogFooter>
        <Link to="/ask"><Button variant="outline">Ask ClearPort about this product</Button></Link>
      </DialogFooter>
    </DialogContent>
  );
}
