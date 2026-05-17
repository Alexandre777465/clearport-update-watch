import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { savedProducts, relevantAlertsForProduct, type SavedProduct } from "@/lib/mock";
import { Plus, Package } from "lucide-react";

export const Route = createFileRoute("/products")({
  component: Products,
  head: () => ({
    meta: [
      { title: "Monitored products — ClearPort" },
      { name: "description", content: "Manage the products and HTS codes ClearPort monitors for U.S. import-rule updates." },
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
      title="Monitored products"
      subtitle="Add products, HTS codes, and routes — ClearPort matches official updates to each one"
    >
      <div className="mb-4 flex items-center justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add product</Button>
          </DialogTrigger>
          <AddProductDialog onAdd={addProduct} />
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {products.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold truncate">{p.name}</h3>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  HTS {p.hts} · {p.origin} → {p.destination}
                </div>
              </div>
              <Badge variant="outline">{p.channel}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Category:</span> {p.category}</div>
              <div><span className="text-muted-foreground">Supplier:</span> {p.supplier}</div>
              <div><span className="text-muted-foreground">Alert frequency:</span> {p.alertFrequency}</div>
              <div><span className="text-muted-foreground">Last alert date:</span> {p.lastAlertDate}</div>
              <div><span className="text-muted-foreground">Upcoming effective:</span> {p.upcomingEffective ?? "—"}</div>
              <div><span className="text-muted-foreground">Last matched source:</span> {p.lastMatchedSource}</div>
            </div>
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs">
              <span className="font-medium">{p.relatedAlerts} relevant alert{p.relatedAlerts === 1 ? "" : "s"}</span>
              <span className="text-muted-foreground"> · last matched {p.lastAlertDate}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setViewing(p)}>View details</Button>
              <Link to="/dashboard"><Button variant="ghost" size="sm">View related alerts</Button></Link>
            </div>
          </Card>
        ))}
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
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [supplier, setSupplier] = useState("");
  const [channel, setChannel] = useState("Amazon");
  const [freq, setFreq] = useState<"Instant" | "Daily" | "Weekly">("Weekly");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: `p${Date.now()}`,
      name: name.trim(),
      category,
      description,
      material,
      intendedUse,
      hts: hts.trim() || "—",
      origin: "China",
      destination: "United States",
      supplier: supplier || "—",
      supplierCountry: "China",
      channel,
      alertFrequency: freq,
      relatedAlerts: 0,
      lastAlertDate: "—",
      upcomingEffective: null,
      lastMatchedSource: "—",
    });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add a product to monitor</DialogTitle>
        <DialogDescription>ClearPort will match official import-rule updates to this product.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Product name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wireless earbuds — Model EB-50" className="mt-1.5" /></div>
        <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5" /></div>
        <div><Label>HTS code</Label><Input value={hts} onChange={(e) => setHts(e.target.value)} placeholder="8517.62.00" className="mt-1.5" /></div>
        <div className="sm:col-span-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Material</Label><Input value={material} onChange={(e) => setMaterial(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Intended use</Label><Input value={intendedUse} onChange={(e) => setIntendedUse(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Supplier</Label><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Sales channel</Label><Input value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1.5" /></div>
        <div className="sm:col-span-2">
          <Label>Alert frequency</Label>
          <div className="mt-1.5 flex gap-2">
            {(["Instant", "Daily", "Weekly"] as const).map((f) => (
              <Button key={f} type="button" variant={freq === f ? "default" : "outline"} size="sm" onClick={() => setFreq(f)}>{f}</Button>
            ))}
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
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>HTS {product.hts} · {product.origin} → {product.destination}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div><span className="text-muted-foreground">Category:</span> {product.category}</div>
        <div><span className="text-muted-foreground">Channel:</span> {product.channel}</div>
        <div className="sm:col-span-2"><span className="text-muted-foreground">Description:</span> {product.description}</div>
        <div><span className="text-muted-foreground">Material:</span> {product.material}</div>
        <div><span className="text-muted-foreground">Intended use:</span> {product.intendedUse}</div>
        <div><span className="text-muted-foreground">Supplier:</span> {product.supplier} ({product.supplierCountry})</div>
        <div><span className="text-muted-foreground">Alert frequency:</span> {product.alertFrequency}</div>
        <div><span className="text-muted-foreground">Upcoming effective:</span> {product.upcomingEffective ?? "—"}</div>
        <div><span className="text-muted-foreground">Last matched source:</span> {product.lastMatchedSource}</div>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">Related alerts ({related.length})</div>
        {related.length === 0 ? (
          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">No related alerts yet.</div>
        ) : (
          <ul className="space-y-2">
            {related.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-3 text-sm">
                <Link to="/alerts/$id" params={{ id: a.id }} className="font-medium hover:underline">{a.title}</Link>
                <div className="mt-1 text-xs text-muted-foreground">{a.source} · effective {a.effectiveDate}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DialogContent>
  );
}
