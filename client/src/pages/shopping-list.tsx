import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Trash2, ShoppingCart, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/lib/auth";

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  taskId: string | null;
  addedBy: string;
  createdAt: string;
}

export default function ShoppingList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authUser = getAuthUser();
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const { data: items = [], isLoading } = useQuery<ShoppingItem[]>({
    queryKey: ["shopping-items"],
    queryFn: async () => {
      const res = await fetch("/api/shopping-items");
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { name: string; quantity: number }) => {
      const res = await fetch("/api/shopping-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, addedBy: authUser?.id }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
      setNewItemName("");
      setNewItemQuantity(1);
      toast({ title: "Produit ajouté à la liste" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shopping-items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-items"] });
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    addItemMutation.mutate({ name: newItemName.trim(), quantity: newItemQuantity });
  };

  const handleCheckItem = (itemId: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
      setTimeout(() => {
        deleteItemMutation.mutate(itemId);
        newChecked.delete(itemId);
        setCheckedItems(new Set(newChecked));
        toast({ title: "Produit acheté et retiré de la liste" });
      }, 500);
    }
    setCheckedItems(newChecked);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-slate-900">Liste d'achats</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Ajouter un produit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddItem} className="flex gap-3">
              <Input
                placeholder="Nom du produit..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-1"
                data-testid="input-product-name"
              />
              <Input
                type="number"
                min={1}
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                className="w-20"
                data-testid="input-product-quantity"
              />
              <Button type="submit" disabled={!newItemName.trim() || addItemMutation.isPending} data-testid="button-add-product">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Produits à acheter
              <span className="text-sm font-normal text-muted-foreground">
                ({items.length} {items.length === 1 ? "produit" : "produits"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Chargement...</p>
            ) : items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun produit dans la liste. Ajoutez des produits à acheter pour résoudre les tâches de maintenance.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      checkedItems.has(item.id) 
                        ? "bg-green-50 border-green-200 line-through text-muted-foreground" 
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                    data-testid={`shopping-item-${item.id}`}
                  >
                    <Checkbox
                      checked={checkedItems.has(item.id)}
                      onCheckedChange={() => handleCheckItem(item.id)}
                      className="h-5 w-5"
                      data-testid={`checkbox-${item.id}`}
                    />
                    <div className="flex-1">
                      <span className="font-medium">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    {checkedItems.has(item.id) && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        deleteItemMutation.mutate(item.id);
                        toast({ title: "Produit supprimé" });
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
