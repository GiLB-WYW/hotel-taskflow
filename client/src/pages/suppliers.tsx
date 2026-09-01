import { useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, Globe, Mail, Pencil, Phone, Plus, Search, Tag } from "lucide-react";
import { getAuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Trade } from "@shared/schema";

type Supplier = {
  id: string;
  name: string;
  description?: string | null;
  mobilePhone?: string | null;
  email?: string | null;
  website?: string | null;
  siret?: string | null;
  isActive: boolean;
  categories: string[];
  tradeIds: string[];
  groupNames: string[];
};

type SupplierForm = {
  name: string;
  mobilePhone: string;
  email: string;
  website: string;
  siret: string;
  description: string;
  categoryIds: string[];
};

const emptyForm: SupplierForm = {
  name: "",
  mobilePhone: "",
  email: "",
  website: "",
  siret: "",
  description: "",
  categoryIds: [],
};

export default function Suppliers() {
  const authUser = getAuthUser();
  const isAdmin = authUser?.role === "Admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const { data: categories = [] } = useQuery<Trade[]>({
    queryKey: ["/api/supplier-categories"],
  });

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter(supplier =>
      [supplier.name, supplier.email, supplier.mobilePhone, supplier.siret, ...supplier.categories]
        .some(value => value?.toLowerCase().includes(query)),
    );
  }, [searchQuery, suppliers]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        mobilePhone: form.mobilePhone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        siret: form.siret.trim() || null,
        description: form.description.trim() || null,
        isActive: true,
      };
      const response = await fetch(editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers", {
        method: editingSupplier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Unable to save supplier.");
      }
      const supplier = await response.json() as Supplier;
      await fetch(`/api/suppliers/${supplier.id}/categories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ categoryIds: form.categoryIds }),
      }).then(async response => {
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.error || "Unable to save supplier categories.");
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsDialogOpen(false);
      setEditingSupplier(null);
      setForm(emptyForm);
      toast({ title: "Supplier saved", description: "The supplier directory has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save supplier", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (supplier?: Supplier) => {
    setEditingSupplier(supplier || null);
    setForm(supplier ? {
      name: supplier.name,
      mobilePhone: supplier.mobilePhone || "",
      email: supplier.email || "",
      website: supplier.website || "",
      siret: supplier.siret || "",
      description: supplier.description || "",
      categoryIds: supplier.tradeIds || [],
    } : emptyForm);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    if (saveMutation.isPending) return;
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setForm(emptyForm);
  };

  const toggleCategory = (categoryId: string) => {
    setForm(current => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter(id => id !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  };

  const websiteHref = (website: string) => /^https?:\/\//i.test(website) ? website : `https://${website}`;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Building2 className="h-4 w-4" />
              Supplier network
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-primary">Suppliers</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              A shared directory for maintenance partners, contacts and areas of expertise.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => openDialog()} className="gap-2">
              <Plus className="h-4 w-4" /> Add supplier
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search by supplier, category, email or phone…"
                className="pl-9"
                aria-label="Search suppliers"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading suppliers…</div>
        ) : filteredSuppliers.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSuppliers.map(supplier => (
              <Card key={supplier.id} className="flex h-full flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{supplier.name}</CardTitle>
                      {supplier.siret && <CardDescription className="mt-1">SIRET {supplier.siret}</CardDescription>}
                    </div>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" onClick={() => openDialog(supplier)} title={`Edit ${supplier.name}`} aria-label={`Edit ${supplier.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {supplier.categories.length ? supplier.categories.map(category => (
                      <Badge key={category} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />{category}
                      </Badge>
                    )) : <span className="text-xs text-muted-foreground">No category assigned</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                  {supplier.description && <p className="text-muted-foreground">{supplier.description}</p>}
                  <div className="mt-auto space-y-2 border-t pt-4">
                    {supplier.mobilePhone && <a href={`tel:${supplier.mobilePhone}`} className="flex items-center gap-2 text-foreground hover:text-primary"><Phone className="h-4 w-4 text-muted-foreground" />{supplier.mobilePhone}</a>}
                    {supplier.email && <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 break-all text-foreground hover:text-primary"><Mail className="h-4 w-4 text-muted-foreground" />{supplier.email}</a>}
                    {supplier.website && <a href={websiteHref(supplier.website)} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all text-primary hover:underline"><Globe className="h-4 w-4 shrink-0" />{supplier.website}</a>}
                    {!supplier.mobilePhone && !supplier.email && !supplier.website && <p className="text-muted-foreground">No contact details yet.</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-14 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h2 className="mt-3 font-semibold">{searchQuery ? "No suppliers found" : "No suppliers yet"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{searchQuery ? "Try another search." : "Add your first supplier to start building the directory."}</p>
              {isAdmin && !searchQuery && <Button className="mt-4 gap-2" onClick={() => openDialog()}><Plus className="h-4 w-4" /> Add supplier</Button>}
            </CardContent>
          </Card>
        )}
      </div>

      {isAdmin && (
        <Dialog open={isDialogOpen} onOpenChange={open => !open && closeDialog()}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
              <DialogDescription>Keep the supplier’s contact details and maintenance categories up to date.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="directory-supplier-name">Supplier name</Label>
                <Input id="directory-supplier-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. CSE Climatisation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="directory-supplier-phone">Mobile phone</Label>
                <Input id="directory-supplier-phone" type="tel" value={form.mobilePhone} onChange={event => setForm({ ...form, mobilePhone: event.target.value })} placeholder="+33 6 00 00 00 00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="directory-supplier-email">Email</Label>
                <Input id="directory-supplier-email" type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="contact@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="directory-supplier-website">Website</Label>
                <Input id="directory-supplier-website" type="url" value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} placeholder="https://example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="directory-supplier-siret">SIRET</Label>
                <Input id="directory-supplier-siret" value={form.siret} onChange={event => setForm({ ...form, siret: event.target.value })} placeholder="14-digit SIRET" maxLength={14} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Category</Label>
                <Select onValueChange={toggleCategory}>
                  <SelectTrigger><SelectValue placeholder={form.categoryIds.length ? `${form.categoryIds.length} categor${form.categoryIds.length === 1 ? "y" : "ies"} selected` : "Select a category"} /></SelectTrigger>
                  <SelectContent>
                    {categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                  {form.categoryIds.map(categoryId => {
                    const category = categories.find(item => item.id === categoryId);
                    return category ? <Badge key={category.id} variant="outline" className="cursor-pointer" onClick={() => toggleCategory(category.id)}>{category.name} ×</Badge> : null;
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Select one or more existing preparation categories, such as Plumbing, Electrical or General Works.</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="directory-supplier-description">Notes</Label>
                <Textarea id="directory-supplier-description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Services, opening hours or other useful notes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => {
                if (!form.name.trim()) {
                  toast({ title: "Supplier name required", description: "Enter a supplier name before saving.", variant: "destructive" });
                  return;
                }
                saveMutation.mutate();
              }} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving…" : "Save supplier"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}