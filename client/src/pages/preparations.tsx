import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import {
  Building2, Calculator, ChevronDown, ChevronRight, ClipboardList, FileText,
  FolderInput, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2,
  UploadCloud, Users,
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
type ProjectPlan = { id: string; projectId: string; fileName: string; fileUrl: string };
type Trade = { id: string; name: string; description?: string };
type ProjectTask = {
  id: string; projectId: string; tradeId?: string | null; category: string; sourceTaskId?: string | null;
  title: string; description?: string | null; status?: string; estimatedCost?: number; actualCost?: number;
};
type RegisterTask = ProjectTask & { bestQuote: number; quoteCount: number };
type BudgetLine = { name: string; estimated: number; quoted: number; actual: number; variance: number; taskCount: number };
type Register = { tasks: RegisterTask[]; totals: Omit<BudgetLine, "name" | "taskCount">; categories: BudgetLine[]; trades: BudgetLine[] };
type Quote = { id: string; supplierName: string; amount: number; fileName?: string; fileUrl?: string };
type ImportableTask = { id: string; title: string; description?: string; status: string; priority: string; assignedGroupName?: string; category: string; tradeName: string };

const money = (value = 0) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
const DEFAULT_CATEGORY = "General Works";

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, credentials: "include" });
  if (!response.ok) throw new Error((await response.text()) || "Request failed");
  return response.status === 204 ? (undefined as T) : response.json();
}

function BudgetTable({ lines }: { lines: BudgetLine[] }) {
  if (!lines.length) return <p className="py-4 text-sm text-muted-foreground">No budget entries yet.</p>;
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[540px] text-sm">
      <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
        <tr><th className="pb-2 font-medium">Group</th><th className="pb-2 text-right font-medium">Tasks</th><th className="pb-2 text-right font-medium">Estimated</th><th className="pb-2 text-right font-medium">Best quote</th><th className="pb-2 text-right font-medium">Actual</th><th className="pb-2 text-right font-medium">Variance</th></tr>
      </thead>
      <tbody>{lines.map(line => <tr key={line.name} className="border-b last:border-0">
        <td className="py-3 font-medium">{line.name}</td><td className="py-3 text-right text-muted-foreground">{line.taskCount}</td>
        <td className="py-3 text-right">{money(line.estimated)}</td><td className="py-3 text-right">{money(line.quoted)}</td>
        <td className="py-3 text-right">{money(line.actual)}</td><td className={`py-3 text-right font-medium ${line.variance < 0 ? "text-destructive" : "text-emerald-700"}`}>{money(line.variance)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export default function Preparations() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [buildingId, setBuildingId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dialog, setDialog] = useState<"project" | "trade" | "task" | "plan" | "quote" | "quotes" | "import" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingTask, setEditingTask] = useState<RegisterTask | null>(null);
  const [quoteTask, setQuoteTask] = useState<RegisterTask | null>(null);
  const [importTaskIds, setImportTaskIds] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "null");
      setUser(currentUser);
      if (currentUser && !["Admin", "Coordinator"].includes(currentUser.role)) setLocation("/");
    } catch { setLocation("/"); }
  }, [setLocation]);

  const buildings = useQuery({ queryKey: ["/api/preparations/buildings"], queryFn: () => api<Location[]>("/api/preparations/buildings"), enabled: !!user });
  const projects = useQuery({ queryKey: ["/api/preparations/projects", buildingId], queryFn: () => api<Project[]>(`/api/preparations/projects?buildingId=${encodeURIComponent(buildingId)}`), enabled: !!buildingId });
  const trades = useQuery({ queryKey: ["/api/preparations/trades"], queryFn: () => api<Trade[]>("/api/preparations/trades"), enabled: !!user });
  const rollups = useQuery({ queryKey: ["/api/preparations/rollups"], queryFn: () => api<any>("/api/preparations/rollups"), enabled: !!user });
  const register = useQuery({ queryKey: ["/api/preparations/register", projectId], queryFn: () => api<Register>(`/api/preparations/projects/${projectId}/register`), enabled: !!projectId });
  const plans = useQuery({ queryKey: ["/api/preparations/plans", projectId], queryFn: () => api<ProjectPlan[]>(`/api/preparations/projects/${projectId}/plans`), enabled: !!projectId });
  const importableTasks = useQuery({ queryKey: ["/api/preparations/importable-tasks", projectId], queryFn: () => api<ImportableTask[]>(`/api/preparations/projects/${projectId}/importable-tasks`), enabled: !!projectId && dialog === "import" });
  const quotes = useQuery({ queryKey: ["/api/preparations/quotes", quoteTask?.id], queryFn: () => api<Quote[]>(`/api/preparations/project-tasks/${quoteTask?.id}/quotes`), enabled: !!quoteTask?.id && dialog === "quotes" });
  const selectedBuilding = buildings.data?.find(building => building.id === buildingId);
  const selectedProject = projects.data?.find(project => project.id === projectId);

  useEffect(() => {
    if (!buildingId && buildings.data?.[0]) setBuildingId(buildings.data[0].id);
  }, [buildings.data, buildingId]);
  useEffect(() => {
    if (projects.data?.length && !projects.data.some(project => project.id === projectId)) setProjectId(projects.data[0].id);
    if (projects.data && !projects.data.length) setProjectId("");
  }, [projects.data, projectId]);

  const categorySections = useMemo(() => {
    const grouped = new Map<string, RegisterTask[]>();
    for (const task of register.data?.tasks || []) {
      const category = task.category || DEFAULT_CATEGORY;
      grouped.set(category, [...(grouped.get(category) || []), task]);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [register.data?.tasks]);

  useEffect(() => {
    if (categorySections.length) setExpandedCategories(categorySections.map(([category]) => category));
  }, [projectId, categorySections.length]);

  const invalidateRegister = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/preparations/register", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/preparations/rollups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/preparations/importable-tasks", projectId] });
  };
  const closeDialog = () => { setDialog(null); setForm({}); setEditingTask(null); };
  const fail = (error: Error, title = "Could not complete action") => toast({ title, description: error.message, variant: "destructive" });

  const createProject = useMutation({
    mutationFn: () => api("/api/preparations/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buildingId, name: form.name, description: form.description, status: form.status || "Planning" }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/projects"] }); closeDialog(); toast({ title: "Project created" }); },
    onError: (error: Error) => fail(error),
  });
  const createTrade = useMutation({
    mutationFn: () => api("/api/preparations/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, description: form.description }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/trades"] }); closeDialog(); toast({ title: "Trade added" }); },
    onError: (error: Error) => fail(error),
  });
  const saveTask = useMutation({
    mutationFn: () => {
      const payload = { projectId, title: form.title, description: form.description || undefined, category: form.category || DEFAULT_CATEGORY, tradeId: form.tradeId || undefined, status: form.status || "Planned", estimatedCost: Number(form.estimatedCost || 0), actualCost: Number(form.actualCost || 0) };
      return editingTask
        ? api(`/api/preparations/project-tasks/${editingTask.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : api("/api/preparations/project-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    onSuccess: () => { invalidateRegister(); closeDialog(); toast({ title: editingTask ? "Task updated" : "Task added" }); },
    onError: (error: Error) => fail(error),
  });
  const importTasks = useMutation({
    mutationFn: () => api(`/api/preparations/projects/${projectId}/import-tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskIds: importTaskIds }) }),
    onSuccess: () => { invalidateRegister(); queryClient.invalidateQueries({ queryKey: ["/api/preparations/trades"] }); setImportTaskIds([]); closeDialog(); toast({ title: "Maintenance tasks imported" }); },
    onError: (error: Error) => fail(error, "Could not import tasks"),
  });
  const deleteTask = (task: RegisterTask) => {
    if (!window.confirm(`Delete "${task.title}" from this preparation register?`)) return;
    api(`/api/preparations/project-tasks/${task.id}`, { method: "DELETE" }).then(() => { invalidateRegister(); toast({ title: "Task removed" }); }).catch((error: Error) => fail(error));
  };
  const deletePlan = (plan: ProjectPlan) => {
    if (!window.confirm(`Delete "${plan.fileName}"?`)) return;
    api(`/api/preparations/plans/${plan.id}`, { method: "DELETE" })
      .then(() => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/plans", projectId] }); toast({ title: "Plan deleted" }); })
      .catch((error: Error) => fail(error));
  };
  const deleteQuote = (quote: Quote) => {
    if (!window.confirm(`Delete the quote from "${quote.supplierName}"?`)) return;
    api(`/api/preparations/quotes/${quote.id}`, { method: "DELETE" })
      .then(() => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/quotes"] }); invalidateRegister(); toast({ title: "Quote deleted" }); })
      .catch((error: Error) => fail(error));
  };
  const submitPlan = async () => {
    const file = (document.getElementById("plan-file") as HTMLInputElement)?.files?.[0];
    try {
      let fileName = form.fileName;
      let fileUrl = form.fileUrl;
      if (file) {
        const signed = await api<{ uploadURL: string; objectPath: string }>("/api/preparations/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
        const upload = await fetch(signed.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!upload.ok) throw new Error("Upload failed");
        fileName = file.name; fileUrl = signed.objectPath;
      }
      await api(`/api/preparations/projects/${projectId}/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName, fileUrl }) });
      queryClient.invalidateQueries({ queryKey: ["/api/preparations/plans", projectId] }); closeDialog(); toast({ title: "Plan attached" });
    } catch (error) { fail(error as Error, "Could not attach plan"); }
  };
  const createQuote = useMutation({
    mutationFn: async () => {
      const file = (document.getElementById("quote-file") as HTMLInputElement)?.files?.[0];
      let fileName = form.fileName;
      let fileUrl = form.fileUrl;
      if (file) {
        const signed = await api<{ uploadURL: string; objectPath: string }>("/api/preparations/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
        const upload = await fetch(signed.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!upload.ok) throw new Error("Quote PDF upload failed");
        fileName = file.name;
        fileUrl = signed.objectPath;
      }
      return api(`/api/preparations/project-tasks/${quoteTask?.id}/quotes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierName: form.supplierName, amount: Number(form.amount || 0), fileName: fileName || undefined, fileUrl: fileUrl || undefined }) });
    },
    onSuccess: () => { invalidateRegister(); queryClient.invalidateQueries({ queryKey: ["/api/preparations/quotes"] }); setForm({}); setDialog("quotes"); toast({ title: "Quote added" }); },
    onError: (error: Error) => fail(error, "Could not add quote"),
  });
  const openNewTask = (category = DEFAULT_CATEGORY, tradeId = "") => { setEditingTask(null); setForm({ category, tradeId, status: "Planned", estimatedCost: "0", actualCost: "0" }); setDialog("task"); };
  const editTask = (task: RegisterTask) => { setEditingTask(task); setForm({ title: task.title, description: task.description || "", category: task.category || DEFAULT_CATEGORY, tradeId: task.tradeId || "", status: task.status || "Planned", estimatedCost: String(task.estimatedCost || 0), actualCost: String(task.actualCost || 0) }); setDialog("task"); };
  const selectBuilding = (id: string) => { setBuildingId(id); setProjectId(""); requestAnimationFrame(() => document.getElementById("preparation-projects")?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const toggleCategory = (category: string) => setExpandedCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);

  if (!user || !["Admin", "Coordinator"].includes(user.role)) return null;
  return <Layout userRole={user.role}>
    <div className="space-y-6 pb-16">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><ShieldCheck className="h-4 w-4" />Restricted workspace</div><h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Preparations</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Build a clear work register, by category and trade, before committing the budget.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialog("trade")}><Users className="mr-2 h-4 w-4" />Manage trades</Button><Button onClick={() => setDialog("project")} disabled={!buildingId}><Plus className="mr-2 h-4 w-4" />New project</Button></div>
      </header>

      {buildings.isLoading ? <div className="grid gap-3 md:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div> : buildings.isError ? <Card><CardContent className="p-5 text-destructive">Buildings could not be loaded. <Button variant="link" onClick={() => buildings.refetch()}>Retry</Button></CardContent></Card> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{buildings.data?.map(building => <button key={building.id} onClick={() => selectBuilding(building.id)} className={`group rounded-xl border p-4 text-left transition-all ${buildingId === building.id ? "border-primary bg-primary/[0.06] shadow-sm" : "border-border bg-card hover:border-primary/40"}`}><div className="flex items-start justify-between"><Building2 className={`h-5 w-5 ${buildingId === building.id ? "text-primary" : "text-muted-foreground"}`} /><ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></div><p className="mt-3 font-semibold">{building.name}</p><p className="text-xs text-muted-foreground">{building.code} · {building.category}</p></button>)}</div>}

      <section id="preparation-projects" className="grid gap-4 scroll-mt-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit"><CardHeader className="pb-3"><CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Projects {selectedBuilding && `· ${selectedBuilding.name}`}</CardTitle></CardHeader><CardContent className="space-y-2">{projects.data?.length ? projects.data.map(project => <button key={project.id} onClick={() => setProjectId(project.id)} className={`w-full rounded-lg border p-3 text-left ${projectId === project.id ? "border-primary/40 bg-primary/[0.06]" : "border-transparent hover:border-border hover:bg-muted/40"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{project.name}</span><Badge variant="secondary" className="text-[10px]">{project.status || "Planning"}</Badge></div><span className="mt-1 block text-xs text-muted-foreground">{new Date(project.createdAt).toLocaleDateString("fr-FR")}</span></button>) : <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No projects for this building yet.</div>}<Button variant="ghost" size="sm" className="w-full" onClick={() => setDialog("project")} disabled={!buildingId}><Plus className="mr-2 h-4 w-4" />Add project</Button></CardContent></Card>

        <div className="min-w-0">{!projectId ? <Card className="flex min-h-[380px] items-center justify-center border-dashed"><div className="text-center"><ClipboardList className="mx-auto h-10 w-10 text-primary/40" /><h2 className="mt-3 font-serif text-xl font-semibold">Choose a project to begin</h2><p className="mt-1 text-sm text-muted-foreground">Create one for the selected building, then add or import its work.</p></div></Card> : <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-2xl font-semibold">{selectedProject?.name}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedProject?.description || "Structured work register"}</p></div><Badge className="bg-primary/10 text-primary hover:bg-primary/10">{selectedProject?.status || "Planning"}</Badge></div>
          <div className="grid gap-3 sm:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Estimated</p><p className="mt-1 text-xl font-semibold">{money(register.data?.totals.estimated)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Best quotes</p><p className="mt-1 text-xl font-semibold">{money(register.data?.totals.quoted)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Actual</p><p className="mt-1 text-xl font-semibold">{money(register.data?.totals.actual)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Variance</p><p className={`mt-1 text-xl font-semibold ${(register.data?.totals.variance || 0) < 0 ? "text-destructive" : "text-emerald-700"}`}>{money(register.data?.totals.variance)}</p></CardContent></Card></div>

          <Tabs defaultValue="register"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="register"><ClipboardList className="mr-2 h-4 w-4" />Work register</TabsTrigger><TabsTrigger value="budget"><Calculator className="mr-2 h-4 w-4" />Budget overview</TabsTrigger><TabsTrigger value="plans"><FileText className="mr-2 h-4 w-4" />Executive plans</TabsTrigger></TabsList>
            <TabsContent value="register" className="mt-4"><Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Work register</CardTitle><p className="mt-1 text-sm text-muted-foreground">Tasks are grouped by category; their trade and budget stay visible in the same list.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setImportTaskIds([]); setDialog("import"); }}><FolderInput className="mr-2 h-4 w-4" />Import tasks</Button><Button size="sm" onClick={() => openNewTask()}><Plus className="mr-2 h-4 w-4" />Add task</Button></div></CardHeader><CardContent className="space-y-3">{register.isLoading ? <div className="h-48 animate-pulse rounded-lg bg-muted" /> : register.isError ? <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">The register could not be loaded. <Button variant="link" onClick={() => register.refetch()}>Retry</Button></div> : categorySections.length ? categorySections.map(([category, tasks]) => {
              const summary = register.data?.categories.find(item => item.name === category);
              const expanded = expandedCategories.includes(category);
              return <section key={category} className="overflow-hidden rounded-xl border"><button className="flex w-full items-center justify-between gap-3 bg-muted/30 px-4 py-3 text-left" onClick={() => toggleCategory(category)}><div className="flex min-w-0 items-center gap-2">{expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}<div><p className="font-semibold">{category}</p><p className="text-xs text-muted-foreground">{tasks.length} task{tasks.length === 1 ? "" : "s"} · Estimated {money(summary?.estimated)}</p></div></div><Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); openNewTask(category); }}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></button>{expanded && <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b bg-muted/10 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Task</th><th className="px-3 py-3 font-medium">Trade</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 text-right font-medium">Estimate</th><th className="px-3 py-3 text-right font-medium">Best quote</th><th className="px-3 py-3 text-right font-medium">Actual</th><th className="px-4 py-3" /></tr></thead><tbody>{tasks.map(task => <tr key={task.id} className="border-b last:border-0"><td className="px-4 py-3"><div className="flex items-center gap-2"><span className="font-medium">{task.title}</span>{task.sourceTaskId && <Badge variant="outline" className="text-[10px]">Imported</Badge>}</div>{task.description && <p className="mt-1 max-w-sm truncate text-xs text-muted-foreground">{task.description}</p>}</td><td className="px-3 py-3">{trades.data?.find(trade => trade.id === task.tradeId)?.name || "Unassigned"}</td><td className="px-3 py-3"><Badge variant="secondary" className="text-[10px]">{task.status || "Planned"}</Badge></td><td className="px-3 py-3 text-right">{money(task.estimatedCost)}</td><td className="px-3 py-3 text-right">{task.quoteCount ? money(task.bestQuote) : "—"}</td><td className="px-3 py-3 text-right">{money(task.actualCost)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Edit task" onClick={() => editTask(task)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => { setQuoteTask(task); setDialog("quotes"); }}>Quotes</Button>{!task.sourceTaskId && <Button size="icon" variant="ghost" className="text-destructive" title="Delete task" onClick={() => deleteTask(task)}><Trash2 className="h-4 w-4" /></Button>}</div></td></tr>)}</tbody></table></div>}</section>;
            }) : <div className="rounded-lg border border-dashed py-14 text-center"><ClipboardList className="mx-auto h-9 w-9 text-primary/35" /><p className="mt-3 font-medium">Your register is empty</p><p className="mt-1 text-sm text-muted-foreground">Add a planned work item or import open maintenance tasks from {selectedBuilding?.name}.</p><div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={() => { setImportTaskIds([]); setDialog("import"); }}>Import maintenance tasks</Button><Button onClick={() => openNewTask()}><Plus className="mr-2 h-4 w-4" />Add task</Button></div></div>}</CardContent></Card></TabsContent>
            <TabsContent value="budget" className="mt-4"><div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Budget by category</CardTitle></CardHeader><CardContent><BudgetTable lines={register.data?.categories || []} /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Budget by trade</CardTitle></CardHeader><CardContent><BudgetTable lines={register.data?.trades || []} /></CardContent></Card></div></TabsContent>
            <TabsContent value="plans" className="mt-4"><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Executive-plan PDFs</CardTitle><Button size="sm" onClick={() => setDialog("plan")}><UploadCloud className="mr-2 h-4 w-4" />Attach plan</Button></CardHeader><CardContent>{plans.data?.length ? <div className="space-y-2">{plans.data.map(plan => <div key={plan.id} className="flex items-center justify-between rounded-lg border p-3"><a href={plan.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 text-sm font-medium text-primary hover:underline"><FileText className="h-5 w-5 shrink-0" /><span className="truncate">{plan.fileName}</span></a><Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePlan(plan)}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <div className="py-10 text-center text-sm text-muted-foreground">No executive plan attached to this project.</div>}</CardContent></Card></TabsContent>
          </Tabs>
        </div>}</div>
      </section>

      {rollups.data && <Card className="border-primary/15 bg-primary/[0.035]"><CardContent className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Portfolio rollup</p><p className="mt-1 text-sm text-muted-foreground">All preparation projects across existing buildings</p></div><div className="flex gap-6 text-right"><div><p className="text-xs text-muted-foreground">Estimated</p><p className="font-semibold">{money(rollups.data.grandTotal.estimated)}</p></div><div><p className="text-xs text-muted-foreground">Best quotes</p><p className="font-semibold">{money(rollups.data.grandTotal.quoted)}</p></div><div><p className="text-xs text-muted-foreground">Actual</p><p className="font-semibold">{money(rollups.data.grandTotal.actual)}</p></div><div><p className="text-xs text-muted-foreground">Variance</p><p className="font-semibold">{money(rollups.data.grandTotal.variance)}</p></div></div></div><details className="mt-5"><summary className="cursor-pointer text-sm font-medium text-primary">View portfolio budgets by project, category, and trade</summary><div className="mt-4 grid gap-4 xl:grid-cols-3"><Card><CardHeader><CardTitle className="text-sm">Projects</CardTitle></CardHeader><CardContent><BudgetTable lines={rollups.data.projects || []} /></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Categories</CardTitle></CardHeader><CardContent><BudgetTable lines={rollups.data.categories || []} /></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Trades</CardTitle></CardHeader><CardContent><BudgetTable lines={rollups.data.trades || []} /></CardContent></Card></div></details></CardContent></Card>}
    </div>

    <Dialog open={!!dialog && ["project", "trade", "task", "plan"].includes(dialog)} onOpenChange={open => !open && closeDialog()}><DialogContent><DialogHeader><DialogTitle>{dialog === "project" ? "New preparation project" : dialog === "trade" ? "Add trade" : dialog === "plan" ? "Attach executive plan" : editingTask ? "Edit register task" : "Add register task"}</DialogTitle></DialogHeader>
      {dialog === "project" && <div className="space-y-3"><Input placeholder="Project name" value={form.name || ""} onChange={event => setForm({ ...form, name: event.target.value })} /><Textarea placeholder="Scope and notes" value={form.description || ""} onChange={event => setForm({ ...form, description: event.target.value })} /><Select value={form.status || "Planning"} onValueChange={status => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planning">Planning</SelectItem><SelectItem value="Ready">Ready for execution</SelectItem><SelectItem value="On hold">On hold</SelectItem></SelectContent></Select></div>}
      {dialog === "trade" && <div className="space-y-3"><Input placeholder="Trade name" value={form.name || ""} onChange={event => setForm({ ...form, name: event.target.value })} /><Textarea placeholder="Description (optional)" value={form.description || ""} onChange={event => setForm({ ...form, description: event.target.value })} /></div>}
      {dialog === "plan" && <div className="space-y-3"><div className="rounded-lg border border-dashed p-5 text-center"><UploadCloud className="mx-auto h-7 w-7 text-primary/60" /><p className="mt-2 text-sm font-medium">Upload a PDF</p><input id="plan-file" type="file" accept="application/pdf" className="mx-auto mt-2 block max-w-full text-xs" /></div><p className="text-center text-xs text-muted-foreground">Or provide a hosted file link</p><Input placeholder="File name" value={form.fileName || ""} onChange={event => setForm({ ...form, fileName: event.target.value })} /><Input placeholder="https://..." value={form.fileUrl || ""} onChange={event => setForm({ ...form, fileUrl: event.target.value })} /></div>}
      {dialog === "task" && <div className="space-y-3"><Input placeholder="Task title" value={form.title || ""} onChange={event => setForm({ ...form, title: event.target.value })} /><Textarea placeholder="Scope and notes" value={form.description || ""} onChange={event => setForm({ ...form, description: event.target.value })} /><div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Category (e.g. Electrical)" value={form.category || DEFAULT_CATEGORY} onChange={event => setForm({ ...form, category: event.target.value })} /><Select value={form.tradeId || "none"} onValueChange={tradeId => setForm({ ...form, tradeId: tradeId === "none" ? "" : tradeId })}><SelectTrigger><SelectValue placeholder="Assign trade" /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{trades.data?.map(trade => <SelectItem key={trade.id} value={trade.id}>{trade.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-3"><Input type="number" min="0" placeholder="Estimated cost" value={form.estimatedCost || ""} onChange={event => setForm({ ...form, estimatedCost: event.target.value })} /><Input type="number" min="0" placeholder="Actual cost" value={form.actualCost || ""} onChange={event => setForm({ ...form, actualCost: event.target.value })} /><Select value={form.status || "Planned"} onValueChange={status => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planned">Planned</SelectItem><SelectItem value="In progress">In progress</SelectItem><SelectItem value="Complete">Complete</SelectItem><SelectItem value="On hold">On hold</SelectItem></SelectContent></Select></div></div>}
      <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button disabled={createProject.isPending || createTrade.isPending || saveTask.isPending} onClick={() => dialog === "project" ? createProject.mutate() : dialog === "trade" ? createTrade.mutate() : dialog === "plan" ? submitPlan() : saveTask.mutate()}>{(createProject.isPending || createTrade.isPending || saveTask.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={dialog === "import"} onOpenChange={open => !open && closeDialog()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Import maintenance tasks</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Open tasks for {selectedBuilding?.name} are suggested with a category and trade. Importing does not change the original maintenance task.</p><div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">{importableTasks.isLoading ? <div className="h-32 animate-pulse rounded-lg bg-muted" /> : importableTasks.data?.length ? importableTasks.data.map(task => <label key={task.id} className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-muted/30"><input type="checkbox" className="mt-1 h-4 w-4" checked={importTaskIds.includes(task.id)} onChange={event => setImportTaskIds(current => event.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.title}</p><Badge variant="secondary" className="text-[10px]">{task.priority}</Badge></div>{task.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>}<p className="mt-2 text-xs text-muted-foreground">{task.category} · {task.tradeName}{task.assignedGroupName ? ` · existing group: ${task.assignedGroupName}` : ""}</p></div></label>) : <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No open maintenance tasks are available for this building.</div>}</div><DialogFooter><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button disabled={!importTaskIds.length || importTasks.isPending} onClick={() => importTasks.mutate()}>{importTasks.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import {importTaskIds.length || ""} task{importTaskIds.length === 1 ? "" : "s"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={dialog === "quotes"} onOpenChange={open => !open && closeDialog()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="flex items-center justify-between gap-3">Quote comparison<Button size="sm" variant="outline" disabled={!quotes.data?.length} onClick={() => { const doc = new jsPDF(); doc.text(`Quote comparison — ${quoteTask?.title || ""}`, 15, 18); (quotes.data || []).forEach((quote, index) => doc.text(`${index + 1}. ${quote.supplierName} — ${money(quote.amount)}`, 15, 32 + index * 8)); doc.save("quote-comparison.pdf"); }}><FileText className="mr-2 h-4 w-4" />Export PDF</Button></DialogTitle></DialogHeader><div className="flex justify-end"><Button size="sm" onClick={() => { setForm({}); setDialog("quote"); }}><Plus className="mr-2 h-4 w-4" />Add quote</Button></div>{quotes.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{quotes.data.map(quote => <div key={quote.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{quote.supplierName}</p><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteQuote(quote)}><Trash2 className="h-4 w-4" /></Button></div><p className="mt-3 text-2xl font-semibold text-primary">{money(quote.amount)}</p>{quote.fileUrl && <a href={quote.fileUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-primary hover:underline">{quote.fileName || "View attachment"}</a>}</div>)}</div> : <div className="py-10 text-center text-sm text-muted-foreground">No supplier quotes for this task.</div>}</DialogContent></Dialog>
    <Dialog open={dialog === "quote"} onOpenChange={open => !open && setDialog("quotes")}><DialogContent><DialogHeader><DialogTitle>Add supplier quote</DialogTitle></DialogHeader><div className="space-y-3"><Input placeholder="Supplier name" value={form.supplierName || ""} onChange={event => setForm({ ...form, supplierName: event.target.value })} /><Input type="number" min="0" placeholder="Amount" value={form.amount || ""} onChange={event => setForm({ ...form, amount: event.target.value })} /><div className="rounded-lg border border-dashed p-4"><p className="mb-2 text-sm font-medium">Quote PDF</p><input id="quote-file" type="file" accept="application/pdf" className="block max-w-full text-xs" /></div><p className="text-center text-xs text-muted-foreground">Or provide a hosted file link</p><Input placeholder="Attachment name (optional)" value={form.fileName || ""} onChange={event => setForm({ ...form, fileName: event.target.value })} /><Input placeholder="Attachment link (optional)" value={form.fileUrl || ""} onChange={event => setForm({ ...form, fileUrl: event.target.value })} /></div><DialogFooter><Button variant="outline" onClick={() => setDialog("quotes")}>Cancel</Button><Button onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>{createQuote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save quote</Button></DialogFooter></DialogContent></Dialog>
  </Layout>;
}