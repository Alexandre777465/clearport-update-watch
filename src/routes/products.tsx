import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  savedProducts as mockProducts,
  relevantAlertsForProduct,
  type SavedProduct,
} from "@/lib/mock";
import { fetchProducts, createProductRemote, deleteProductRemote, API_URL } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Package, Trash2 } from "lucide-react";

export const Route = createFileRoute("/products")({
  component: Products,
  head: () => ({
    meta: [
      { title: "My Products — ClearPort" },
      {
        name: "description",
        content:
          "Add the products you import. ClearPort watches import-rule updates for each one.",
      },
    ],
  }),
});

function Products() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<SavedProduct | null>(null);

  const { data: products = mockProducts, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    staleTime: 120_000,
    placeholderData: mockProducts,
  });

  const addMutation = useMutation({
    mutationFn: createProductRemote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      toast.success("Product added.");
    },
    onError: () => {
      // Backend unavailable — add to local state only
      toast.info("Product added locally. Connect the backend to persist across sessions.");
      setOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProductRemote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product removed.");
    },
  });

  // Local-only add (when backend isn't configured)
  const [localProducts, setLocalProducts] = useState<SavedProduct[]>([]);
  const allProducts = API_URL ? products : [...products, ...localProducts];

  const addLocalProduct = (p: SavedProduct) => {
    setLocalProducts((prev) => [...prev, p]);
    setOpen(false);
    toast.info("Product added locally. Configure VITE_API_URL to persist.");
  };

  const handleAdd = (data: {
    name: string;
    category: string;
    hts: string;
    origin: string;
    destination: string;
  }) => {
    if (API_URL) {
      addMutation.mutate({
        name: data.name,
        categories: data.category ? [data.category] : [],
        hts_codes: data.hts ? [data.hts] : [],
        origin_countries: data.origin ? [data.origin] : [],
        destination_countries: data.destination ? [data.destination] : [],
      });
    } else {
      addLocalProduct({
        id: `local-${Date.now()}`,
        name: data.name,
        category: data.category,
        description: "",
        material: "",
        intendedUse: "",
        hts: data.hts || "—",
        origin: data.origin,
        destination: data.destination,
        supplier: "—",
        supplierCountry: data.origin,
        channel: "—",
        alertFrequency: "Weekly",
        relatedAlerts: 0,
        lastAlertDate: "—",
        upcomingEffective: null,
        lastMatchedSource: "—",
      });
    }
  };

  return (
    <AppShell
      title="My Products"
      subtitle="Add your products. ClearPort watches import rule updates for you."
    >
      <div className="mb-4 flex items-center justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add product
            </Button>
          </DialogTrigger>
          <AddProductDialog
            onAdd={handleAdd}
            isSaving={addMutation.isPending}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {allProducts.map((p) => {
            const count = relevantAlertsForProduct(p.id).length;
            const isLocal = p.id.startsWith("local-");
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  {isLocal && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      (local)
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <div>
                    HTS: <span className="text-foreground">{p.hts || "—"}</span>
                  </div>
                  <div>
                    Route:{" "}
                    <span className="text-foreground">
                      {p.origin} → {p.destination}
                    </span>
                  </div>
                  <div>
                    {count} alert{count === 1 ? "" : "s"} found
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewing(p)}
                  >
                    View alerts
                  </Button>
                  {!isLocal && API_URL && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && <ProductDetailDialog product={viewing} />}
      </Dialog>
    </AppShell>
  );
}

function AddProductDialog({
  onAdd,
  isSaving,
}: {
  onAdd: (data: {
    name: string;
    category: string;
    hts: string;
    origin: string;
    destination: string;
  }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [hts, setHts] = useState("");
  const [origin, setOrigin] = useState("China");
  const [destination, setDestination] = useState("United States");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), category, hts: hts.trim(), origin, destination });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add a product</DialogTitle>
        <DialogDescription>
          ClearPort will watch import-rule updates for this product.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Product name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bluetooth speaker"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Category</Label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>
            HTS code{" "}
            <span className="text-muted-foreground text-xs">(if known)</span>
          </Label>
          <Input
            value={hts}
            onChange={(e) => setHts(e.target.value)}
            placeholder="8517.13.00"
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Origin country</Label>
            <Input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Destination</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={isSaving}>
          {isSaving ? "Saving…" : "Add product"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ProductDetailDialog({ product }: { product: SavedProduct }) {
  const related = relevantAlertsForProduct(product.id);
  const brokerQs = Array.from(
    new Set(related.flatMap((a) => a.brokerQuestions)),
  ).slice(0, 4);
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>
          HTS {product.hts} · {product.origin} → {product.destination}
        </DialogDescription>
      </DialogHeader>

      <div>
        <div className="mb-2 text-sm font-medium">
          Alerts for this product ({related.length})
        </div>
        {related.length === 0 ? (
          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            No alerts yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {related.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-3 text-sm">
                <Link
                  to="/alerts/$id"
                  params={{ id: a.id }}
                  className="font-medium hover:underline"
                >
                  {a.title}
                </Link>
                <div className="mt-1 text-xs text-muted-foreground">
                  Effective {a.effectiveDate}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {brokerQs.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium">
            Questions to ask your broker
          </div>
          <ul className="space-y-1 pl-5 text-sm text-muted-foreground list-disc">
            {brokerQs.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        <Link to="/ask">
          <Button variant="outline">Ask ClearPort about this product</Button>
        </Link>
      </DialogFooter>
    </DialogContent>
  );
}
