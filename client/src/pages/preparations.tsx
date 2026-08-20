import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import {
  Building2, Calculator, ChevronRight, CircleDollarSign, ClipboardList,
  FilePlus2, FileText, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw,
  ShieldCheck, Trash2, UploadCloud, Users, X
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type Location = { id: string; name: string; category: string; code: string };
type Project = { id: string; buildingId: string; name: string; description?: string; status?: string; createdAt: string };
type ProjectPlan = { id: string; projectId: string; fileName: string; fileUrl: string; createdAt: string };
type Trade = { id: string; name: string; description?: string };
type ProjectTask = { id: string; projectId: string; tradeId?: string; title: string; description?: string; status?: string; estimatedCost?: number; actualCost?: number; createdAt: string };
type Quote = { id: string; projectTaskId: string; supplierName: string; amount: number; fileName?: string; fileUrl?: string; createdAt: string };
type Rollups = { grandTotal: { estimated: number; actual: number }; buildings: { buildingId: string; estimated: number; actual: number }[]; trades: { tradeId: string; estimated: number; actual: number }[] };

const money = (n = 0) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (!res.ok) throw new Error((await res.text()) || "Request failed");
  return res.status === 204 ? (undefined as T) : res.json();
}

export default function Preparations() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [buildingId, setBuildingId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dialog, setDialog] = useState<"project" | "trade" | "task" | "plan" | "quote" | "quotes" | null>(null);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [quoteTask, setQuoteTask] = useState<ProjectTask | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      setUser(u);
      if (u && !["Admin", "Coordinator"].includes(u.role)) setLocation("/");
    } catch { setLocation("/"); }
  }, [setLocation]);

  const buildings = useQuery({ queryKey: ["/api/preparations/buildings"], queryFn: () => api<Location[]>("/api/preparations/buildings"), enabled: !!user && ["Admin", "Coordinator"].includes(user.role) });
  const projects = useQuery({ queryKey: ["/api/preparations/projects", buildingId], queryFn: () => api<Project[]>(`/api/preparations/projects?buildingId=${encodeURIComponent(buildingId)}`), enabled: !!buildingId });
  const trades = useQuery({ queryKey: ["/api/preparations/trades"], queryFn: () => api<Trade[]>("/api/preparations/trades"), enabled: !!user });
  const rollups = useQuery({ queryKey: ["/api/preparations/rollups"], queryFn: () => api<Rollups>("/api/preparations/rollups"), enabled: !!user });
  const plans = useQuery({ queryKey: ["/api/preparations/plans", projectId], queryFn: () => api<ProjectPlan[]>(`/api/preparations/projects/${projectId}/plans`), enabled: !!projectId });
  const tasks = useQuery({ queryKey: ["/api/preparations/tasks", projectId], queryFn: () => api<ProjectTask[]>(`/api/preparations/project-tasks?projectId=${projectId}`), enabled: !!projectId });
  const quotes = useQuery({ queryKey: ["/api/preparations/quotes", quoteTask?.id], queryFn: () => api<Quote[]>(`/api/preparations/project-tasks/${quoteTask?.id}/quotes`), enabled: !!quoteTask?.id && dialog === "quotes" });
  const selectedBuilding = buildings.data?.find(b => b.id === buildingId);
  const selectedProject = projects.data?.find(p => p.id === projectId);
  const totals = useMemo(() => (tasks.data || []).reduce((a, t) => ({ estimated: a.estimated + Number(t.estimatedCost || 0), actual: a.actual + Number(t.actualCost || 0) }), { estimated: 0, actual: 0 }), [tasks.data]);

  useEffect(() => {
    if (!buildingId && buildings.data?.[0]) setBuildingId(buildings.data[0].id);
  }, [buildings.data, buildingId]);
  useEffect(() => {
    if (projects.data?.length && (!projectId || !projects.data.some(p => p.id === projectId))) setProjectId(projects.data[0].id);
    if (!projects.data?.length) setProjectId("");
  }, [projects.data, projectId]);

  const mutate = (fn: () => Promise<unknown>, success: string, invalidate: string[]) => useMutation({ mutationFn: fn, onSuccess: () => { invalidate.forEach(k => qc.invalidateQueries({ queryKey: [k] })); toast({ title: success }); setDialog(null); setForm({}); }, onError: (e: Error) => toast({ title: "Could not complete action", description: e.message, variant: "destructive" }) });
  const createProject = mutate(() => api("/api/preparations/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buildingId, name: form.name, description: form.description, status: form.status || "Planning" }) }), "Project created", ["/api/preparations/projects"]);
  const createTrade = mutate(() => api("/api/preparations/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, description: form.description }) }), "Trade added", ["/api/preparations/trades"]);
  const createTask = mutate(() => api("/api/preparations/project-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, tradeId: form.tradeId || undefined, title: form.title, description: form.description, status: form.status || "Planned", estimatedCost: Number(form.estimatedCost || 0), actualCost: Number(form.actualCost || 0) }) }), "Task added", ["/api/preparations/tasks", "/api/preparations/rollups"]);
  const updateTask = useMutation({ mutationFn: () => api(`/api/preparations/project-tasks/${editingTask?.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: form.status, estimatedCost: Number(form.estimatedCost || 0), actualCost: Number(form.actualCost || 0) }) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/preparations/tasks", projectId] }); qc.invalidateQueries({ queryKey: ["/api/preparations/rollups"] }); setDialog(null); toast({ title: "Task updated" }); } });
  const deleteItem = (url: string, keys: string[]) => api(url, { method: "DELETE" }).then(() => { keys.forEach(k => qc.invalidateQueries({ queryKey: [k] })); toast({ title: "Deleted" }); }).catch((e: Error) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }));

  const submitPlan = async () => {
    const file = (document.getElementById("plan-file") as HTMLInputElement)?.files?.[0];
    try {
      if (file) {
        const signed = await api<{ uploadURL: string; objectPath: string }>("/api/preparations/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
        const upload = await fetch(signed.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!upload.ok) throw new Error("Upload failed");
        await api(`/api/preparations/projects/${projectId}/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileUrl: signed.objectPath }) });
      } else await api(`/api/preparations/projects/${projectId}/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: form.fileName, fileUrl: form.fileUrl }) });
      qc.invalidateQueries({ queryKey: ["/api/preparations/plans", projectId] }); setDialog(null); toast({ title: "Plan attached" });
    } catch (e) { toast({ title: "Could not attach plan", description: (e as Error).message, variant: "destructive" }); }
  };
  const createQuote = useMutation({
    mutationFn: async () => {
      const file = (document.getElementById("quote-file") as HTMLInputElement)?.files?.[0];
      let fileName = form.fileName;
      let fileUrl = form.fileUrl;
      if (file) {
        const signed = await api<{ uploadURL: string; objectPath: string }>("/api/preparations/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        const upload = await fetch(signed.uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!upload.ok) throw new Error("Quote PDF upload failed");
        fileName = file.name;
        fileUrl = signed.objectPath;
      }
      return api(`/api/preparations/project-tasks/${quoteTask?.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierName: form.supplierName, amount: Number(form.amount || 0), fileName, fileUrl }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/preparations/quotes"] });
      setDialog("quotes");
      setForm({});
      toast({ title: "Quote added" });
    },
    onError: (e: Error) => toast({ title: "Could not add quote", description: e.message, variant: "destructive" }),
  });
  const openForm = (type: typeof dialog, values: Record<string, string> = {}) => {
    if (type === "task" && Object.keys(values).length === 0) setEditingTask(null);
    setForm(values);
    setDialog(type);
  };
  const selectBuilding = (id: string) => {
    setBuildingId(id);
    setProjectId("");
    requestAnimationFrame(() => {
      document.getElementById("preparation-projects")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const errorBlock = (q: any, label: string) => q.isError ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive flex items-center justify-between"><span>{label} could not be loaded.</span><Button variant="outline" size="sm" onClick={() => q.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div> : null;

  if (!user || !["Admin", "Coordinator"].includes(user.role)) return null;
  return <Layout userRole={user.role}>
    <div className="space-y-6 pb-16">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><ShieldCheck className="h-4 w-4" />Restricted workspace</div><h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Preparations</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Plan renovation work, collect supplier quotes, and keep the execution budget accountable.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => openForm("trade")}><Users className="mr-2 h-4 w-4" />Manage trades</Button><Button onClick={() => openForm("project")} disabled={!buildingId}><Plus className="mr-2 h-4 w-4" />New project</Button></div>
      </header>
      {buildings.isLoading ? <div className="grid gap-3 md:grid-cols-3"><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-24 animate-pulse rounded-xl bg-muted" /></div> : errorBlock(buildings, "Buildings")}
      {buildings.data && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{buildings.data.map(b => <button key={b.id} onClick={() => selectBuilding(b.id)} className={`group rounded-xl border p-4 text-left transition-all ${buildingId === b.id ? "border-primary bg-primary/[0.06] shadow-sm" : "border-border bg-card hover:border-primary/40"}`}><div className="flex items-start justify-between"><Building2 className={`h-5 w-5 ${buildingId === b.id ? "text-primary" : "text-muted-foreground"}`} /><ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></div><p className="mt-3 font-semibold">{b.name}</p><p className="text-xs text-muted-foreground">{b.code} · {b.category}</p></button>)}</div>}
      <section id="preparation-projects" className="grid gap-4 scroll-mt-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit border-border/80"><CardHeader className="pb-3"><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Projects {selectedBuilding && `· ${selectedBuilding.name}`}</CardTitle></CardHeader><CardContent className="space-y-2">{projects.isLoading ? <div className="space-y-2"><div className="h-12 animate-pulse rounded-lg bg-muted" /><div className="h-12 animate-pulse rounded-lg bg-muted" /></div> : projects.data?.length ? projects.data.map(p => <button key={p.id} onClick={() => setProjectId(p.id)} className={`w-full rounded-lg border p-3 text-left ${projectId === p.id ? "border-primary/40 bg-primary/[0.06]" : "border-transparent hover:border-border hover:bg-muted/40"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{p.name}</span><Badge variant="secondary" className="shrink-0 text-[10px]">{p.status || "Planning"}</Badge></div><span className="mt-1 block text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("fr-FR")}</span></button>) : <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No preparation projects for this building.</div>}<Button variant="ghost" size="sm" className="w-full" onClick={() => openForm("project")} disabled={!buildingId}><Plus className="mr-2 h-4 w-4" />Add project</Button></CardContent></Card>
        <div className="min-w-0 space-y-4">{!projectId ? <Card className="flex min-h-[360px] items-center justify-center border-dashed"><div className="text-center"><ClipboardList className="mx-auto h-10 w-10 text-primary/40" /><h2 className="mt-3 font-serif text-xl font-semibold">Choose a project to begin</h2><p className="mt-1 text-sm text-muted-foreground">Your plans, tasks, and financials will appear here.</p></div></Card> : <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-2xl font-semibold">{selectedProject?.name}</h2><p className="text-sm text-muted-foreground">{selectedProject?.description || "Project preparation workspace"}</p></div><Badge className="bg-primary/10 text-primary hover:bg-primary/10">{selectedProject?.status || "Planning"}</Badge></div>
          <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Estimated</p><p className="mt-1 text-2xl font-semibold text-primary">{money(totals.estimated)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Actual</p><p className="mt-1 text-2xl font-semibold">{money(totals.actual)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Variance</p><p className={`mt-1 text-2xl font-semibold ${totals.actual > totals.estimated ? "text-destructive" : "text-emerald-700"}`}>{money(totals.estimated - totals.actual)}</p></CardContent></Card></div>
          <Tabs defaultValue="tasks"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="tasks"><ClipboardList className="mr-2 h-4 w-4" />Project tasks</TabsTrigger><TabsTrigger value="plans"><FileText className="mr-2 h-4 w-4" />Executive plans</TabsTrigger><TabsTrigger value="costs"><Calculator className="mr-2 h-4 w-4" />Cost monitoring</TabsTrigger></TabsList>
            <TabsContent value="tasks" className="mt-4"><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Work packages</CardTitle><Button size="sm" onClick={() => openForm("task")}><Plus className="mr-2 h-4 w-4" />Add task</Button></CardHeader><CardContent>{tasks.isLoading ? <div className="h-28 animate-pulse rounded-lg bg-muted" /> : errorBlock(tasks, "Tasks") || (tasks.data?.length ? <div className="divide-y">{tasks.data.map(t => <div key={t.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{t.title}</p><Badge variant="outline" className="text-[10px]">{t.status || "Planned"}</Badge>{t.tradeId && <span className="text-xs text-muted-foreground">{trades.data?.find(x => x.id === t.tradeId)?.name}</span>}</div>{t.description && <p className="mt-1 truncate text-sm text-muted-foreground">{t.description}</p>}</div><div className="flex items-center gap-4"><div className="text-right text-xs"><p className="text-muted-foreground">Estimate / actual</p><p className="font-semibold">{money(t.estimatedCost)} <span className="font-normal text-muted-foreground">/ {money(t.actualCost)}</span></p></div><Button size="icon" variant="ghost" onClick={() => { setEditingTask(t); openForm("task", { status: t.status || "Planned", estimatedCost: String(t.estimatedCost || 0), actualCost: String(t.actualCost || 0) }); }}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => { setQuoteTask(t); setDialog("quotes"); }}>Quotes</Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => window.confirm("Delete this task?") && deleteItem(`/api/preparations/project-tasks/${t.id}`, ["/api/preparations/tasks", "/api/preparations/rollups"])}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div> : <div className="py-12 text-center text-sm text-muted-foreground">No tasks yet. Add the first work package to start costing this project.</div>)}</CardContent></Card></TabsContent>
            <TabsContent value="plans" className="mt-4"><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Executive-plan PDFs</CardTitle><Button size="sm" onClick={() => openForm("plan")}><UploadCloud className="mr-2 h-4 w-4" />Attach plan</Button></CardHeader><CardContent>{plans.isLoading ? <div className="h-20 animate-pulse rounded-lg bg-muted" /> : plans.data?.length ? <div className="space-y-2">{plans.data.map(p => <div key={p.id} className="flex items-center justify-between rounded-lg border p-3"><a href={p.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 text-sm font-medium text-primary hover:underline"><FileText className="h-5 w-5 shrink-0" /><span className="truncate">{p.fileName}</span></a><Button size="icon" variant="ghost" className="text-destructive" onClick={() => window.confirm("Delete this plan?") && deleteItem(`/api/preparations/plans/${p.id}`, ["/api/preparations/plans"])}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <div className="py-12 text-center text-sm text-muted-foreground">No executive plan attached to this project.</div>}</CardContent></Card></TabsContent>
            <TabsContent value="costs" className="mt-4"><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" />By building</CardTitle></CardHeader><CardContent className="space-y-3">{rollups.isLoading ? <div className="h-20 animate-pulse rounded-lg bg-muted" /> : rollups.data?.buildings.map(r => <div key={r.buildingId} className="flex justify-between border-b pb-2 text-sm"><span>{buildings.data?.find(b => b.id === r.buildingId)?.name || r.buildingId}</span><span className="font-medium">{money(r.actual)} <span className="font-normal text-muted-foreground">/ {money(r.estimated)}</span></span></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-4 w-4 text-primary" />By trade</CardTitle></CardHeader><CardContent className="space-y-3">{rollups.isLoading ? <div className="h-20 animate-pulse rounded-lg bg-muted" /> : rollups.data?.trades.map(r => <div key={r.tradeId} className="flex justify-between border-b pb-2 text-sm"><span>{trades.data?.find(t => t.id === r.tradeId)?.name || "Unassigned"}</span><span className="font-medium">{money(r.actual)} <span className="font-normal text-muted-foreground">/ {money(r.estimated)}</span></span></div>)}</CardContent></Card></div></TabsContent>
          </Tabs></>}</div>
      </section>
      {rollups.data && <Card className="border-primary/15 bg-primary/[0.035]"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Portfolio rollup</p><p className="mt-1 text-sm text-muted-foreground">All preparation projects across existing buildings</p></div><div className="flex gap-8 text-right"><div><p className="text-xs text-muted-foreground">Estimated</p><p className="font-semibold">{money(rollups.data.grandTotal.estimated)}</p></div><div><p className="text-xs text-muted-foreground">Actual</p><p className="font-semibold">{money(rollups.data.grandTotal.actual)}</p></div></div></CardContent></Card>}
    </div>
    <Dialog open={!!dialog && ["project", "trade", "task", "plan"].includes(dialog)} onOpenChange={v => !v && setDialog(null)}><DialogContent><DialogHeader><DialogTitle>{dialog === "project" ? "New preparation project" : dialog === "trade" ? "Add trade" : dialog === "plan" ? "Attach executive plan" : editingTask ? "Edit task costs" : "Add project task"}</DialogTitle></DialogHeader>
      {dialog === "project" && <div className="space-y-3"><Input placeholder="Project name" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /><Textarea placeholder="Scope and notes" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /><Select value={form.status || "Planning"} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planning">Planning</SelectItem><SelectItem value="Ready">Ready for execution</SelectItem><SelectItem value="On hold">On hold</SelectItem></SelectContent></Select></div>}
      {dialog === "trade" && <div className="space-y-3"><Input placeholder="Trade name" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /><Textarea placeholder="Description (optional)" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>}
      {dialog === "plan" && <div className="space-y-3"><div className="rounded-lg border border-dashed p-5 text-center"><UploadCloud className="mx-auto h-7 w-7 text-primary/60" /><p className="mt-2 text-sm font-medium">Upload a PDF</p><input id="plan-file" type="file" accept="application/pdf" className="mx-auto mt-2 block max-w-full text-xs" /></div><p className="text-center text-xs text-muted-foreground">Or provide a hosted file link</p><Input placeholder="File name" value={form.fileName || ""} onChange={e => setForm({ ...form, fileName: e.target.value })} /><Input placeholder="https://..." value={form.fileUrl || ""} onChange={e => setForm({ ...form, fileUrl: e.target.value })} /></div>}
      {dialog === "task" && <div className="space-y-3"><Input placeholder="Task title" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} disabled={!!editingTask} /><Textarea placeholder="Description" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} disabled={!!editingTask} /><Select value={form.tradeId || "none"} onValueChange={v => setForm({ ...form, tradeId: v === "none" ? "" : v })} disabled={!!editingTask}><SelectTrigger><SelectValue placeholder="Assign trade" /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{trades.data?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-3"><Input type="number" placeholder="Estimated cost" value={form.estimatedCost || ""} onChange={e => setForm({ ...form, estimatedCost: e.target.value })} /><Input type="number" placeholder="Actual cost" value={form.actualCost || ""} onChange={e => setForm({ ...form, actualCost: e.target.value })} /></div><Select value={form.status || "Planned"} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planned">Planned</SelectItem><SelectItem value="In progress">In progress</SelectItem><SelectItem value="Complete">Complete</SelectItem><SelectItem value="On hold">On hold</SelectItem></SelectContent></Select></div>}
      <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={createProject.isPending || createTrade.isPending || createTask.isPending || updateTask.isPending} onClick={() => dialog === "project" ? createProject.mutate() : dialog === "trade" ? createTrade.mutate() : dialog === "plan" ? submitPlan() : editingTask ? updateTask.mutate() : createTask.mutate()}>{(createProject.isPending || createTrade.isPending || createTask.isPending || updateTask.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={dialog === "quotes"} onOpenChange={v => !v && setDialog(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="flex items-center justify-between">Quote comparison <Button size="sm" variant="outline" disabled={!quotes.data?.length} onClick={() => { const doc = new jsPDF(); doc.text(`Quote comparison — ${quoteTask?.title || ""}`, 15, 18); (quotes.data || []).forEach((q, i) => doc.text(`${i + 1}. ${q.supplierName} — ${money(q.amount)}`, 15, 32 + i * 8)); doc.save("quote-comparison.pdf"); }}><FileText className="mr-2 h-4 w-4" />Export PDF</Button></DialogTitle></DialogHeader><div className="mb-3 flex justify-end"><Button size="sm" onClick={() => openForm("quote")}><Plus className="mr-2 h-4 w-4" />Add quote</Button></div>{quotes.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : quotes.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{quotes.data.map(q => <div key={q.id} className="rounded-xl border p-4"><div className="flex items-start justify-between"><p className="font-semibold">{q.supplierName}</p><Button size="icon" variant="ghost" className="text-destructive" onClick={() => window.confirm("Delete this quote?") && deleteItem(`/api/preparations/quotes/${q.id}`, ["/api/preparations/quotes"])}><Trash2 className="h-4 w-4" /></Button></div><p className="mt-3 text-2xl font-semibold text-primary">{money(q.amount)}</p>{q.fileUrl && <a href={q.fileUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-primary hover:underline">{q.fileName || "View attachment"}</a>}</div>)}</div> : <div className="py-10 text-center text-sm text-muted-foreground">No supplier quotes for this task.</div>}</DialogContent></Dialog>
    <Dialog open={dialog === "quote"} onOpenChange={v => !v && setDialog("quotes")}><DialogContent><DialogHeader><DialogTitle>Add supplier quote</DialogTitle></DialogHeader><div className="space-y-3"><Input placeholder="Supplier name" value={form.supplierName || ""} onChange={e => setForm({ ...form, supplierName: e.target.value })} /><Input type="number" placeholder="Amount" value={form.amount || ""} onChange={e => setForm({ ...form, amount: e.target.value })} /><div className="rounded-lg border border-dashed p-4"><p className="mb-2 text-sm font-medium">Quote PDF</p><input id="quote-file" type="file" accept="application/pdf" className="block max-w-full text-xs" /></div><p className="text-center text-xs text-muted-foreground">Or provide a hosted file link</p><Input placeholder="File name (optional)" value={form.fileName || ""} onChange={e => setForm({ ...form, fileName: e.target.value })} /><Input placeholder="https://..." value={form.fileUrl || ""} onChange={e => setForm({ ...form, fileUrl: e.target.value })} /></div><DialogFooter><Button variant="outline" onClick={() => setDialog("quotes")}>Cancel</Button><Button onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>{createQuote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save quote</Button></DialogFooter></DialogContent></Dialog>
  </Layout>;
}