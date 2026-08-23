import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { Calculator, ChevronDown, ChevronRight, ClipboardList, FileText, FolderInput, ImageIcon, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UploadCloud, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type Location = { id: string; name: string; category: string; code: string };
type Project = { id: string; buildingId: string; name: string; description?: string; status?: string; createdAt: string };
type ProjectPlan = { id: string; projectId: string; fileName: string; fileUrl: string };
type Trade = { id: string; name: string };
type RegisterTask = {
  id: string; projectId: string; tradeId?: string | null; category: string; sourceTaskId?: string | null; sourceHasImage?: boolean;
  title: string; description?: string | null; productDescription?: string | null; supplierName?: string | null;
  unitPrice?: number | null; quantity?: number | null; lineTotal?: number; plannedFor?: string | null;
  sourceDocument?: string | null; invoiceNumber?: string | null; invoiceAmount?: number | null; invoiceFileName?: string | null; invoiceFileUrl?: string | null;
  status?: string; isActive: boolean; estimatedCost?: number; actualCost?: number; bestQuote: number; quoteCount: number;
};
type RollupTask = {
  id: string; title: string; description?: string | null; productDescription?: string | null;
  projectId: string; projectName: string; buildingId: string;
  supplierName?: string | null; unitPrice?: number | null; quantity?: number | null; lineTotal?: number | null;
  estimatedCost: number; actualCost: number; invoiceAmount?: number | null;
  invoiceNumber?: string | null; invoiceFileUrl?: string | null; invoiceFileName?: string | null;
  plannedFor?: string | null; sourceTaskId?: string | null; sourceHasImage?: boolean; tradeId?: string | null;
  category: string; status?: string | null; isActive: boolean;
};
type BudgetLine = { name: string; estimated: number; quoted: number; actual: number; variance: number; taskCount: number; tasks?: RollupTask[] };
type Register = { tasks: RegisterTask[]; totals: Omit<BudgetLine, "name" | "taskCount">; categories: BudgetLine[]; trades: BudgetLine[] };
type Quote = { id: string; supplierName: string; amount: number; fileName?: string; fileUrl?: string };
type ImportableTask = { id: string; title: string; description?: string; status: string; priority: string; assignedGroupName?: string; category: string; tradeName: string };
type ScopeItem = { id: string; building: string; title: string; plannedFor?: string; supplierName?: string; category: string; tradeName: string; estimatedCost?: string; quantity?: string; invoiceNumber?: string; invoiceAmount?: string; imported: boolean };
type PreparationSupplier = { id: string; name: string; groupNames: string[] };

const money = (value = 0) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
const DEFAULT_CATEGORY = "General Works";

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, credentials: "include" });
  if (response.status === 401) throw new Error("Session expired — please refresh the page and sign in again.");
  if (!response.ok) throw new Error((await response.text()) || "Request failed");
  return response.status === 204 ? (undefined as T) : response.json();
}

function BudgetTable({ lines }: { lines: BudgetLine[] }) {
  if (!lines.length) return <p className="py-4 text-sm text-muted-foreground">No budget entries yet.</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-sm">
    <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-2 font-medium">Group</th><th className="pb-2 text-right font-medium">Lines</th><th className="pb-2 text-right font-medium">Planned</th><th className="pb-2 text-right font-medium">Best quote</th><th className="pb-2 text-right font-medium">Actual</th><th className="pb-2 text-right font-medium">Variance</th></tr></thead>
    <tbody>{lines.map(line => <tr key={line.name} className="border-b last:border-0"><td className="py-3 font-medium">{line.name}</td><td className="py-3 text-right text-muted-foreground">{line.taskCount}</td><td className="py-3 text-right">{money(line.estimated)}</td><td className="py-3 text-right">{money(line.quoted)}</td><td className="py-3 text-right">{money(line.actual)}</td><td className={`py-3 text-right font-medium ${line.variance < 0 ? "text-destructive" : "text-emerald-700"}`}>{money(line.variance)}</td></tr>)}</tbody>
  </table></div>;
}

function SupplierSelect({ value, onChange, suppliers, className = "", legacyName, pendingLabel = "Pending" }: {
  value: string;
  onChange: (value: string) => void;
  suppliers: PreparationSupplier[];
  className?: string;
  legacyName?: string | null;
  pendingLabel?: string;
}) {
  const supplierNames = new Set(suppliers.map(supplier => supplier.name));
  const groups = Array.from(new Set(suppliers.flatMap(supplier => supplier.groupNames))).sort((a, b) => a.localeCompare(b));
  const unassigned = suppliers.filter(supplier => !supplier.groupNames.length);
  return (
    <select className={className} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{pendingLabel}</option>
      {groups.map(group => (
        <optgroup key={group} label={group}>
          {suppliers
            .filter(supplier => supplier.groupNames.includes(group))
            .map(supplier => <option key={`${group}-${supplier.id}`} value={supplier.name}>{supplier.name}</option>)}
        </optgroup>
      ))}
      {unassigned.length > 0 && (
        <optgroup label="Other suppliers">
          {unassigned.map(supplier => <option key={supplier.id} value={supplier.name}>{supplier.name}</option>)}
        </optgroup>
      )}
      {legacyName && !supplierNames.has(legacyName) && (
        <optgroup label="Saved supplier">
          <option value={legacyName}>{legacyName}</option>
        </optgroup>
      )}
    </select>
  );
}

function ExpandableBudgetTable({ lines, onPatch, onEdit, projects, suppliers }: {
  lines: BudgetLine[];
  onPatch: (id: string, data: Record<string, unknown>) => void;
  onEdit: (task: RollupTask) => void;
  projects: { id: string; name: string }[];
  suppliers: PreparationSupplier[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingProject, setPendingProject] = useState<{ taskId: string; projectId: string; projectName: string } | null>(null);
  if (!lines.length) return <p className="py-4 text-sm text-muted-foreground">No budget entries yet.</p>;
  const toggle = (name: string) => setExpanded(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const selectCls = "h-7 rounded border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";
  // Strip leading "Prefix · " from project names so the dropdown stays compact
  const shortLabel = (name: string) => name.includes(' · ') ? name.split(' · ').slice(1).join(' · ') : name;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="w-7 pb-2" /><th className="pb-2 font-medium">Group</th><th className="pb-2 text-right font-medium">Lines</th><th className="pb-2 text-right font-medium">Planned</th><th className="pb-2 text-right font-medium">Best quote</th><th className="pb-2 text-right font-medium">Actual</th><th className="pb-2 text-right font-medium">Variance</th></tr>
        </thead>
        <tbody>
          {lines.map(line => {
            const isOpen = expanded.has(line.name);
            const tasks = line.tasks ?? [];
            return (
              <tr key={line.name} className="border-b last:border-0">
                <td colSpan={7} className="p-0">
                  <button type="button" onClick={() => toggle(line.name)} className="flex w-full items-center gap-0 text-left hover:bg-muted/30">
                    <span className="w-7 shrink-0 py-3 pl-1">{isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</span>
                    <span className="flex-1 py-3 font-medium">{line.name}</span>
                    <span className="w-16 py-3 text-right text-muted-foreground">{line.taskCount}</span>
                    <span className="w-24 py-3 text-right">{money(line.estimated)}</span>
                    <span className="w-24 py-3 text-right">{money(line.quoted)}</span>
                    <span className="w-24 py-3 text-right">{money(line.actual)}</span>
                    <span className={`w-24 py-3 text-right font-medium ${line.variance < 0 ? "text-destructive" : "text-emerald-700"}`}>{money(line.variance)}</span>
                  </button>
                  {isOpen && tasks.length > 0 && (
                    <div className="border-t bg-muted/10 pb-3 pt-1">
                      <div className="overflow-x-auto pl-7 pr-2">
                        <table className="w-full min-w-[820px] text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="py-2 text-left font-medium">Task</th>
                              <th className="py-2 text-left font-medium">Project</th>
                              <th className="py-2 text-left font-medium">Supplier</th>
                              <th className="py-2 text-center font-medium">Active</th>
                              <th className="py-2 text-right font-medium">Planned</th>
                              <th className="py-2 text-left font-medium">Invoice #</th>
                              <th className="py-2 text-right font-medium">Invoice amt</th>
                              <th className="py-2 font-medium" />
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map(task => {
                              const taskSupplier = task.supplierName ?? "";
                              return (
                                <tr key={task.id} className={`border-b last:border-0 ${task.isActive ? "" : "bg-muted/30 text-muted-foreground"}`}>
                                  <td className="py-2 pr-3">
                                    <div className="flex max-w-[200px] flex-wrap items-center gap-1">
                                      {task.sourceTaskId && task.sourceHasImage && (
                                        <button type="button" onClick={() => onEdit(task)} title="View task photo and edit line" className="shrink-0 overflow-hidden rounded border hover:ring-2 hover:ring-primary">
                                          <img src={`/api/tasks/${task.sourceTaskId}/thumbnail`} alt="" className="h-7 w-7 object-cover" />
                                        </button>
                                      )}
                                      <span className="font-medium leading-tight">{task.title}</span>
                                      {task.sourceTaskId && <Badge variant="outline" className="text-[9px]">App task</Badge>}
                                    </div>
                                    {task.plannedFor && <p className="mt-0.5 text-muted-foreground">{task.plannedFor}</p>}
                                  </td>
                                  <td className="py-2 pr-2">
                                    {(() => {
                                      const hasPending = pendingProject?.taskId === task.id;
                                      const displayId = hasPending ? pendingProject!.projectId : task.projectId;
                                      return (
                                        <div className="flex flex-col gap-1">
                                          <select
                                            className={`${selectCls} w-44`}
                                            value={displayId}
                                            disabled={!!task.sourceTaskId}
                                            title={task.sourceTaskId ? "App tasks cannot be moved to another project" : "Reassign to a different project"}
                                            onChange={e => {
                                              if (e.target.value === task.projectId) { setPendingProject(null); return; }
                                              const chosen = projects.find(p => p.id === e.target.value);
                                              if (chosen) setPendingProject({ taskId: task.id, projectId: chosen.id, projectName: chosen.name });
                                            }}
                                          >
                                            {!projects.some(p => p.id === task.projectId) && (
                                              <option value={task.projectId}>{shortLabel(task.projectName)}</option>
                                            )}
                                            {projects.map(p => <option key={p.id} value={p.id}>{shortLabel(p.name)}</option>)}
                                          </select>
                                          {hasPending && (
                                            <div className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[10px] ring-1 ring-amber-200">
                                              <span className="text-amber-800">→ <strong>{shortLabel(pendingProject!.projectName)}</strong></span>
                                              <button type="button" className="ml-auto rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted" onClick={() => setPendingProject(null)}>Cancel</button>
                                              <button type="button" className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground hover:bg-primary/90" onClick={() => { onPatch(task.id, { projectId: pendingProject!.projectId }); setPendingProject(null); }}>Save</button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-2 pr-2">
                                    <SupplierSelect
                                      className={`${selectCls} w-36`}
                                      value={taskSupplier}
                                      legacyName={taskSupplier}
                                      suppliers={suppliers}
                                      onChange={supplierName => onPatch(task.id, { supplierName: supplierName || null })}
                                    />
                                  </td>
                                   <td className="py-2 pr-2 text-center">
                                     <Switch
                                       checked={task.isActive}
                                       onCheckedChange={isActive => onPatch(task.id, { isActive })}
                                       aria-label={`${task.isActive ? "Deactivate" : "Activate"} ${task.title}`}
                                     />
                                   </td>
                                  <td className="py-2 pr-3 text-right">
                                    {task.lineTotal !== null && task.lineTotal !== undefined ? money(task.lineTotal) : money(task.estimatedCost)}
                                  </td>
                                  <td className="py-2 pr-2">
                                    <input
                                      className="h-7 w-28 rounded border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                      defaultValue={task.invoiceNumber ?? ""}
                                      placeholder="Invoice ref"
                                      onBlur={e => { if (e.target.value !== (task.invoiceNumber ?? "")) onPatch(task.id, { invoiceNumber: e.target.value || null }); }}
                                    />
                                  </td>
                                  <td className="py-2 pr-2">
                                    <input
                                      type="number" min="0"
                                      className="h-7 w-24 rounded border bg-background px-2 text-right text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                      defaultValue={task.invoiceAmount ?? task.actualCost ?? ""}
                                      onBlur={e => {
                                        const cur = String(task.invoiceAmount ?? task.actualCost ?? "");
                                        if (e.target.value !== cur) onPatch(task.id, { invoiceAmount: e.target.value === "" ? null : Number(e.target.value) });
                                      }}
                                    />
                                  </td>
                                  <td className="py-2">
                                    <div className="flex items-center gap-1">
                                      {task.invoiceFileUrl && (
                                        <a href={task.invoiceFileUrl} target="_blank" rel="noreferrer" title={task.invoiceFileName ?? "Invoice PDF"} onClick={e => e.stopPropagation()}>
                                          <FileText className="h-4 w-4 text-primary" />
                                        </a>
                                      )}
                                      <button type="button" title="Edit full line" onClick={e => { e.stopPropagation(); onEdit(task); }} className="rounded p-1 hover:bg-muted">
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Preparations() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [buildingId, setBuildingId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dialog, setDialog] = useState<"project" | "trade" | "task" | "plan" | "quote" | "quotes" | "import" | "scope" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingTask, setEditingTask] = useState<RegisterTask | null>(null);
  const [quoteTask, setQuoteTask] = useState<RegisterTask | null>(null);
  const [importTaskIds, setImportTaskIds] = useState<string[]>([]);
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  useEffect(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "null");
      setUser(currentUser);
      if (currentUser && !["Admin", "Coordinator"].includes(currentUser.role)) setLocation("/");
    } catch { setLocation("/"); }
  }, [setLocation]);

  const buildings = useQuery({ queryKey: ["/api/preparations/buildings"], queryFn: () => api<Location[]>("/api/preparations/buildings"), enabled: !!user });
  const projects = useQuery({ queryKey: ["/api/preparations/projects", buildingId], queryFn: () => api<Project[]>(`/api/preparations/projects?buildingId=${encodeURIComponent(buildingId)}`), enabled: !!buildingId });
  // All projects across all buildings — used for the rollup reassignment dropdown
  const allProjects = useQuery({ queryKey: ["/api/preparations/projects/all"], queryFn: () => api<Project[]>("/api/preparations/projects"), enabled: !!user, staleTime: 0 });
  const trades = useQuery({ queryKey: ["/api/preparations/trades"], queryFn: () => api<Trade[]>("/api/preparations/trades"), enabled: !!user });
  const supplierCatalog = useQuery({
    queryKey: ["/api/preparations/suppliers"],
    queryFn: () => api<PreparationSupplier[]>("/api/preparations/suppliers"),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 15000,
  });
  const rollups = useQuery({ queryKey: ["/api/preparations/rollups"], queryFn: () => api<any>("/api/preparations/rollups"), enabled: !!user, staleTime: 0 });
  const register = useQuery({ queryKey: ["/api/preparations/register", projectId], queryFn: () => api<Register>(`/api/preparations/projects/${projectId}/register`), enabled: !!projectId });
  const plans = useQuery({ queryKey: ["/api/preparations/plans", projectId], queryFn: () => api<ProjectPlan[]>(`/api/preparations/projects/${projectId}/plans`), enabled: !!projectId });
  const importableTasks = useQuery({ queryKey: ["/api/preparations/importable-tasks", projectId], queryFn: () => api<ImportableTask[]>(`/api/preparations/projects/${projectId}/importable-tasks`), enabled: !!projectId && dialog === "import" });
  const scope = useQuery({ queryKey: ["/api/preparations/source-scope", projectId], queryFn: () => api<ScopeItem[]>(`/api/preparations/projects/${projectId}/source-scope`), enabled: !!projectId && dialog === "scope" });
  const quotes = useQuery({ queryKey: ["/api/preparations/quotes", quoteTask?.id], queryFn: () => api<Quote[]>(`/api/preparations/project-tasks/${quoteTask?.id}/quotes`), enabled: !!quoteTask?.id && dialog === "quotes" });
  const selectedBuilding = buildings.data?.find(building => building.id === buildingId);
  const selectedProject = projects.data?.find(project => project.id === projectId);

  // Sync: ensure every location has a preparation project (catches locations added via Admin)
  useEffect(() => {
    if (!user) return;
    api("/api/preparations/sync-location-projects", { method: "POST" })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/preparations/rollups"] });
        queryClient.invalidateQueries({ queryKey: ["/api/preparations/buildings"] });
      })
      .catch(() => { /* non-fatal */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => { if (!buildingId && buildings.data?.[0]) setBuildingId(buildings.data[0].id); }, [buildings.data, buildingId]);
  useEffect(() => {
    if (projects.data?.length && !projects.data.some(project => project.id === projectId)) setProjectId(projects.data[0].id);
    if (projects.data && !projects.data.length) setProjectId("");
  }, [projects.data, projectId]);

  const categorySections = useMemo(() => Array.from(new Set((register.data?.tasks || []).map(task => task.category || DEFAULT_CATEGORY))).sort(), [register.data?.tasks]);

  // Derived lists for portfolio-rollup dropdowns
  const rollupProjects = useMemo(() =>
    (allProjects.data ?? []).map((p: any) => ({ id: p.id, name: p.name })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
    [allProjects.data]);
  const invalidateRegister = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/preparations/register", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/preparations/rollups"] });
    queryClient.invalidateQueries({ queryKey: ["/api/preparations/importable-tasks", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/preparations/source-scope", projectId] });
  };
  const closeDialog = () => { setDialog(null); setForm({}); setEditingTask(null); setInvoiceFile(null); };
  const fail = (error: Error, title = "Could not complete action") => toast({ title, description: error.message, variant: "destructive" });
  const selectBuilding = (id: string) => { setBuildingId(id); setProjectId(""); };
  const uploadPreparationPdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF invoice.");
    const contentType = "application/pdf";
    const signed = await api<{ uploadURL: string; objectPath: string }>("/api/preparations/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType }),
    });
    const upload = await fetch(signed.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
    if (!upload.ok) throw new Error("Invoice PDF upload failed");
    return signed.objectPath;
  };

  const createProject = useMutation({
    mutationFn: () => api("/api/preparations/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buildingId, name: form.name, description: form.description, status: form.status || "Planning" }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/projects"] }); closeDialog(); toast({ title: "Project created" }); }, onError: (error: Error) => fail(error),
  });
  const createTrade = useMutation({
    mutationFn: () => api("/api/preparations/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/trades"] }); closeDialog(); toast({ title: "Trade added" }); }, onError: (error: Error) => fail(error),
  });
  const saveTask = useMutation({
    mutationFn: async () => {
      let invoiceFileName = form.invoiceFileName;
      let invoiceFileUrl = form.invoiceFileUrl;
      if (invoiceFile) {
        invoiceFileName = invoiceFile.name;
        invoiceFileUrl = await uploadPreparationPdf(invoiceFile);
      }
      // When editing an existing task, preserve its own projectId (the state's projectId is for new tasks)
      const effectiveProjectId = editingTask ? editingTask.projectId : projectId;
      const payload = { projectId: effectiveProjectId, title: form.title, description: form.description || undefined, productDescription: form.productDescription || undefined, supplierName: form.supplierName || undefined, category: form.category || DEFAULT_CATEGORY, tradeId: form.tradeId || undefined, plannedFor: form.plannedFor || undefined, status: form.status || "Planned", unitPrice: Number(form.unitPrice || 0), quantity: Number(form.quantity || 0), estimatedCost: Number(form.estimatedCost || 0), invoiceNumber: form.invoiceNumber || undefined, invoiceAmount: form.invoiceAmount !== "" && form.invoiceAmount !== undefined ? Number(form.invoiceAmount) : 0, invoiceFileName: invoiceFileName || undefined, invoiceFileUrl: invoiceFileUrl || undefined, actualCost: Number(form.actualCost || 0) };
      return editingTask ? api(`/api/preparations/project-tasks/${editingTask.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }) : api("/api/preparations/project-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    },
    onSuccess: () => { invalidateRegister(); closeDialog(); toast({ title: editingTask ? "Line updated" : "Line added" }); }, onError: (error: Error) => fail(error),
  });
  const patchTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api(`/api/preparations/project-tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: invalidateRegister, onError: (error: Error) => fail(error, "Could not update register line"),
  });
  const importTasks = useMutation({
    mutationFn: () => api(`/api/preparations/projects/${projectId}/import-tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskIds: importTaskIds }) }),
    onSuccess: () => { invalidateRegister(); queryClient.invalidateQueries({ queryKey: ["/api/preparations/trades"] }); setImportTaskIds([]); closeDialog(); toast({ title: "Maintenance tasks imported" }); }, onError: (error: Error) => fail(error, "Could not import tasks"),
  });
  const importAllMaintenance = useMutation({
    mutationFn: () => api<{ importedCount: number; skippedCount: number }>("/api/preparations/import-all-maintenance-tasks", { method: "POST" }),
    onSuccess: data => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/projects"] }); queryClient.invalidateQueries({ queryKey: ["/api/preparations/trades"] }); invalidateRegister(); toast({ title: `${data.importedCount} historical task${data.importedCount === 1 ? "" : "s"} added`, description: `${data.skippedCount} already imported or resolved task${data.skippedCount === 1 ? "" : "s"} skipped.` }); }, onError: (error: Error) => fail(error, "Could not import historical tasks"),
  });
  const importScope = useMutation({
    mutationFn: () => api(`/api/preparations/projects/${projectId}/import-source-scope`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: scopeIds }) }),
    onSuccess: () => { setScopeIds([]); closeDialog(); queryClient.invalidateQueries({ queryKey: ["/api/preparations/trades"] }); invalidateRegister(); toast({ title: "2026 scope rows added" }); }, onError: (error: Error) => fail(error, "Could not import the PDF scope"),
  });
  const deleteTask = (task: RegisterTask) => {
    if (!window.confirm(`Delete "${task.title}" from this preparation register?`)) return;
    api(`/api/preparations/project-tasks/${task.id}`, { method: "DELETE" }).then(() => { invalidateRegister(); toast({ title: "Line removed" }); }).catch((error: Error) => fail(error));
  };
  const deletePlan = (plan: ProjectPlan) => {
    if (!window.confirm(`Delete "${plan.fileName}"?`)) return;
    api(`/api/preparations/plans/${plan.id}`, { method: "DELETE" }).then(() => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/plans", projectId] }); toast({ title: "Plan deleted" }); }).catch((error: Error) => fail(error));
  };
  const deleteQuote = (quote: Quote) => {
    if (!window.confirm(`Delete the quote from "${quote.supplierName}"?`)) return;
    api(`/api/preparations/quotes/${quote.id}`, { method: "DELETE" }).then(() => { queryClient.invalidateQueries({ queryKey: ["/api/preparations/quotes"] }); invalidateRegister(); toast({ title: "Quote deleted" }); }).catch((error: Error) => fail(error));
  };
  const submitPlan = async () => {
    const file = (document.getElementById("plan-file") as HTMLInputElement)?.files?.[0];
    try {
      let fileName = form.fileName; let fileUrl = form.fileUrl;
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
      let fileName = form.fileName; let fileUrl = form.fileUrl;
      if (file) {
        const signed = await api<{ uploadURL: string; objectPath: string }>("/api/preparations/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }) });
        const upload = await fetch(signed.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!upload.ok) throw new Error("Quote PDF upload failed");
        fileName = file.name; fileUrl = signed.objectPath;
      }
      return api(`/api/preparations/project-tasks/${quoteTask?.id}/quotes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierName: form.supplierName, amount: Number(form.amount || 0), fileName: fileName || undefined, fileUrl: fileUrl || undefined }) });
    },
    onSuccess: () => { invalidateRegister(); queryClient.invalidateQueries({ queryKey: ["/api/preparations/quotes"] }); setForm({}); setDialog("quotes"); toast({ title: "Quote added" }); }, onError: (error: Error) => fail(error, "Could not add quote"),
  });
  const openNewTask = () => { setEditingTask(null); setInvoiceFile(null); setForm({ category: DEFAULT_CATEGORY, status: "Planned", quantity: "1", unitPrice: "", estimatedCost: "0", actualCost: "0", invoiceAmount: "" }); setDialog("task"); };
  const editTask = (task: RegisterTask) => { setEditingTask(task); setInvoiceFile(null); setForm({ title: task.title, description: task.description || "", productDescription: task.productDescription || "", supplierName: task.supplierName || "", category: task.category || DEFAULT_CATEGORY, tradeId: task.tradeId || "", status: task.status || "Planned", plannedFor: task.plannedFor || "", unitPrice: String(task.unitPrice ?? ""), quantity: String(task.quantity ?? ""), estimatedCost: String(task.estimatedCost || 0), invoiceNumber: task.invoiceNumber || "", invoiceAmount: String(task.invoiceAmount ?? ""), invoiceFileName: task.invoiceFileName || "", invoiceFileUrl: task.invoiceFileUrl || "", actualCost: String(task.actualCost || 0) }); setDialog("task"); };
  const commitInline = (task: RegisterTask, field: string, value: string, numeric = false) => {
    const current = String(task[field as keyof RegisterTask] ?? "");
    if (value === current) return;
    patchTask.mutate({ id: task.id, data: { [field]: numeric ? (value === "" ? null : Number(value)) : value || null } });
  };

  if (!user || !["Admin", "Coordinator"].includes(user.role)) return null;
  return <Layout userRole={user.role}><div className="space-y-6 pb-16">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><ShieldCheck className="h-4 w-4" />Restricted workspace</div><h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Procurement register</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">A single register for planned work, suppliers, quantities, costs, and future invoice evidence.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialog("trade")}><Users className="mr-2 h-4 w-4" />Trades</Button><Button variant="outline" onClick={() => importAllMaintenance.mutate()} disabled={importAllMaintenance.isPending}>{importAllMaintenance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Import all historical tasks</Button><Button onClick={() => setDialog("project")} disabled={!buildingId}><Plus className="mr-2 h-4 w-4" />New project</Button></div></header>

    <Card><CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="space-y-2 text-sm font-medium">Location<Select value={buildingId} onValueChange={selectBuilding}><SelectTrigger><SelectValue placeholder="Choose a location" /></SelectTrigger><SelectContent>{buildings.data?.map(building => <SelectItem key={building.id} value={building.id}>{building.name} · {building.code}</SelectItem>)}</SelectContent></Select></label><label className="space-y-2 text-sm font-medium">Project<Select value={projectId || "none"} onValueChange={id => setProjectId(id === "none" ? "" : id)} disabled={!buildingId}><SelectTrigger><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent><SelectItem value="none">Choose a project</SelectItem>{projects.data?.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></label><Button variant="outline" onClick={() => setDialog("project")} disabled={!buildingId}><Plus className="mr-2 h-4 w-4" />Add project</Button></CardContent></Card>

    {!projectId ? <Card className="flex min-h-[330px] items-center justify-center border-dashed"><div className="text-center"><ClipboardList className="mx-auto h-10 w-10 text-primary/40" /><h2 className="mt-3 font-serif text-xl font-semibold">Choose a project to begin</h2><p className="mt-1 text-sm text-muted-foreground">Select a location and its project, or create a new project.</p></div></Card> : <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-serif text-2xl font-semibold">{selectedProject?.name}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedBuilding?.name} · {selectedProject?.description || "Structured procurement register"}</p></div><Badge className="bg-primary/10 text-primary hover:bg-primary/10">{selectedProject?.status || "Planning"}</Badge></div>
      <div className="grid gap-3 sm:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Planned</p><p className="mt-1 text-xl font-semibold">{money(register.data?.totals.estimated)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Best quotes</p><p className="mt-1 text-xl font-semibold">{money(register.data?.totals.quoted)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Actual / invoices</p><p className="mt-1 text-xl font-semibold">{money(register.data?.totals.actual)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Variance</p><p className={`mt-1 text-xl font-semibold ${(register.data?.totals.variance || 0) < 0 ? "text-destructive" : "text-emerald-700"}`}>{money(register.data?.totals.variance)}</p></CardContent></Card></div>
      <Tabs defaultValue="register"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="register"><ClipboardList className="mr-2 h-4 w-4" />Register</TabsTrigger><TabsTrigger value="budget"><Calculator className="mr-2 h-4 w-4" />Budget</TabsTrigger><TabsTrigger value="plans"><FileText className="mr-2 h-4 w-4" />Executive plans</TabsTrigger></TabsList>
      <TabsContent value="register" className="mt-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Procurement lines</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Click into supplier, product, unit price, quantity, timing, or status to save a line directly. Inactive lines are kept for reference but excluded from costs.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setScopeIds([]); setDialog("scope"); }}><FileText className="mr-2 h-4 w-4" />2026 works PDF</Button>
              <Button size="sm" variant="outline" onClick={() => { setImportTaskIds([]); setDialog("import"); }}><FolderInput className="mr-2 h-4 w-4" />Import this location</Button>
              <Button size="sm" onClick={openNewTask}><Plus className="mr-2 h-4 w-4" />Add line</Button>
            </div>
          </CardHeader>
          <CardContent>
            {register.isLoading ? <div className="h-48 animate-pulse rounded-lg bg-muted" /> : register.isError ? <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">The register could not be loaded. <Button variant="link" onClick={() => register.refetch()}>Retry</Button></div> : register.data?.tasks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1580px] text-sm">
                  <thead className="border-y bg-muted/20 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-3 py-3 font-medium">Task</th><th className="px-3 py-3 text-center font-medium">Active</th><th className="px-3 py-3 font-medium">Category / trade</th><th className="px-3 py-3 font-medium">Product description</th><th className="px-3 py-3 font-medium">Supplier</th><th className="px-3 py-3 text-right font-medium">Unit price</th><th className="px-3 py-3 text-right font-medium">Qty</th><th className="px-3 py-3 text-right font-medium">Total price</th><th className="px-3 py-3 font-medium">Timing / status</th><th className="px-3 py-3 font-medium">Invoice</th><th className="px-3 py-3 text-right font-medium">Actual</th><th className="px-3 py-3" /></tr>
                  </thead>
                  <tbody>
                    {register.data.tasks.map(task => (
                      <tr key={task.id} className={`border-b align-top last:border-0 ${task.isActive ? "" : "bg-muted/30 text-muted-foreground"}`}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {task.sourceTaskId && task.sourceHasImage && <button type="button" title="View task photo and edit line" onClick={() => editTask(task)} className="shrink-0 overflow-hidden rounded border hover:ring-2 hover:ring-primary"><img src={`/api/tasks/${task.sourceTaskId}/thumbnail`} alt="" className="h-10 w-10 object-cover" /></button>}
                            <span className="max-w-[220px] font-medium">{task.title}</span>
                            {task.sourceTaskId && <Badge variant="outline" className="text-[10px]">App task</Badge>}
                            {task.sourceDocument?.includes("Travaux") && <Badge variant="outline" className="text-[10px]">PDF</Badge>}
                          </div>
                          {task.description && <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">{task.description}</p>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <Switch checked={task.isActive} onCheckedChange={isActive => patchTask.mutate({ id: task.id, data: { isActive } })} aria-label={`${task.isActive ? "Deactivate" : "Activate"} ${task.title}`} />
                            <span className="text-[10px]">{task.isActive ? "Active" : "Inactive"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs"><p>{task.category}</p><p className="mt-1 text-muted-foreground">{trades.data?.find(trade => trade.id === task.tradeId)?.name || "Unassigned"}</p></td>
                        <td className="px-3 py-3"><Input className="h-8 min-w-[170px]" defaultValue={task.productDescription || ""} placeholder="Not specified" onBlur={event => commitInline(task, "productDescription", event.target.value)} /></td>
                        <td className="px-3 py-3">
                          <SupplierSelect
                            className="h-8 min-w-[170px] rounded-md border border-input bg-background px-2 text-sm"
                            value={task.supplierName || ""}
                            legacyName={task.supplierName}
                            suppliers={supplierCatalog.data || []}
                            onChange={supplierName => patchTask.mutate({ id: task.id, data: { supplierName: supplierName || null } })}
                          />
                        </td>
                        <td className="px-3 py-3"><Input type="number" min="0" className="h-8 w-24 text-right" defaultValue={task.unitPrice ?? ""} onBlur={event => commitInline(task, "unitPrice", event.target.value, true)} /></td>
                        <td className="px-3 py-3"><Input type="number" min="0" className="h-8 w-16 text-right" defaultValue={task.quantity ?? ""} onBlur={event => commitInline(task, "quantity", event.target.value, true)} /></td>
                        <td className="px-3 py-3 text-right font-semibold">{task.unitPrice !== null && task.quantity !== null ? money(task.lineTotal) : "Pending"}</td>
                        <td className="px-3 py-3"><Input className="mb-1 h-8 min-w-[108px]" defaultValue={task.plannedFor || ""} placeholder="Month / date" onBlur={event => commitInline(task, "plannedFor", event.target.value)} /><Select value={task.status || "Planned"} onValueChange={status => patchTask.mutate({ id: task.id, data: { status } })}><SelectTrigger className="h-8 min-w-[108px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planned">Planned</SelectItem><SelectItem value="In progress">In progress</SelectItem><SelectItem value="Complete">Complete</SelectItem><SelectItem value="On hold">On hold</SelectItem></SelectContent></Select></td>
                        <td className="px-3 py-3"><Input className="h-8 min-w-[120px]" defaultValue={task.invoiceNumber || ""} placeholder="Invoice reference" onBlur={event => commitInline(task, "invoiceNumber", event.target.value)} />{task.invoiceFileUrl && <a href={task.invoiceFileUrl} target="_blank" rel="noreferrer" className="mt-2 flex max-w-[180px] items-center gap-1 text-xs font-medium text-primary hover:underline"><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{task.invoiceFileName || "View invoice PDF"}</span></a>}</td>
                        <td className="px-3 py-3"><Input type="number" min="0" className="h-8 w-24 text-right" defaultValue={task.invoiceAmount ?? task.actualCost ?? ""} onBlur={event => commitInline(task, "invoiceAmount", event.target.value, true)} /></td>
                        <td className="px-3 py-3"><div className="flex gap-1"><Button size="icon" variant="ghost" title="Edit line and invoice PDF" onClick={() => editTask(task)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => { setQuoteTask(task); setDialog("quotes"); }}>Quotes</Button>{!task.sourceTaskId && <Button size="icon" variant="ghost" className="text-destructive" title="Delete line" onClick={() => deleteTask(task)}><Trash2 className="h-4 w-4" /></Button>}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="py-14 text-center"><ClipboardList className="mx-auto h-9 w-9 text-primary/35" /><p className="mt-3 font-medium">Your procurement register is empty</p><p className="mt-1 text-sm text-muted-foreground">Add a line, bring in eligible PDF scope, or import maintenance work already logged for {selectedBuilding?.name}.</p><div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={() => { setScopeIds([]); setDialog("scope"); }}>Review 2026 works PDF</Button><Button onClick={openNewTask}><Plus className="mr-2 h-4 w-4" />Add line</Button></div></div>}
          </CardContent>
        </Card>
      </TabsContent>
        <TabsContent value="budget" className="mt-4"><div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Budget by category</CardTitle></CardHeader><CardContent><BudgetTable lines={register.data?.categories || []} /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Budget by trade</CardTitle></CardHeader><CardContent><BudgetTable lines={register.data?.trades || []} /></CardContent></Card></div></TabsContent>
        <TabsContent value="plans" className="mt-4"><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Executive-plan PDFs</CardTitle><Button size="sm" onClick={() => setDialog("plan")}><UploadCloud className="mr-2 h-4 w-4" />Attach plan</Button></CardHeader><CardContent>{plans.data?.length ? <div className="space-y-2">{plans.data.map(plan => <div key={plan.id} className="flex items-center justify-between rounded-lg border p-3"><a href={plan.fileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 text-sm font-medium text-primary hover:underline"><FileText className="h-5 w-5 shrink-0" /><span className="truncate">{plan.fileName}</span></a><Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePlan(plan)}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <div className="py-10 text-center text-sm text-muted-foreground">No executive plan attached to this project.</div>}</CardContent></Card></TabsContent>
      </Tabs>
    </div>}

    {rollups.data && <Card className="border-primary/15 bg-primary/[0.035]"><CardContent className="p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Portfolio rollup</p><p className="mt-1 text-sm text-muted-foreground">Planned procurement values use unit price × quantity when both are available.</p></div><div className="flex gap-6 text-right"><div><p className="text-xs text-muted-foreground">Planned</p><p className="font-semibold">{money(rollups.data.grandTotal.estimated)}</p></div><div><p className="text-xs text-muted-foreground">Quotes</p><p className="font-semibold">{money(rollups.data.grandTotal.quoted)}</p></div><div><p className="text-xs text-muted-foreground">Actual</p><p className="font-semibold">{money(rollups.data.grandTotal.actual)}</p></div></div></div><details className="mt-5"><summary className="cursor-pointer text-sm font-medium text-primary">View portfolio budgets by project, category, and trade</summary><div className="mt-4 space-y-4"><Card><CardHeader><CardTitle className="text-sm">Projects</CardTitle></CardHeader><CardContent><ExpandableBudgetTable lines={rollups.data.projects || []} onPatch={(id, data) => patchTask.mutate({ id, data })} onEdit={task => editTask({ id: task.id, projectId: task.projectId, title: task.title, description: task.description, productDescription: task.productDescription, supplierName: task.supplierName, category: task.category, tradeId: task.tradeId, status: task.status, unitPrice: task.unitPrice, quantity: task.quantity, plannedFor: task.plannedFor, estimatedCost: task.estimatedCost, invoiceNumber: task.invoiceNumber, invoiceAmount: task.invoiceAmount, invoiceFileName: task.invoiceFileName, invoiceFileUrl: task.invoiceFileUrl, actualCost: task.actualCost, sourceTaskId: task.sourceTaskId, bestQuote: 0, quoteCount: 0, lineTotal: task.lineTotal ?? undefined } as RegisterTask)} projects={rollupProjects} suppliers={supplierCatalog.data || []} /></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Categories</CardTitle></CardHeader><CardContent><ExpandableBudgetTable lines={rollups.data.categories || []} onPatch={(id, data) => patchTask.mutate({ id, data })} onEdit={task => editTask({ id: task.id, projectId: task.projectId, title: task.title, description: task.description, productDescription: task.productDescription, supplierName: task.supplierName, category: task.category, tradeId: task.tradeId, status: task.status, unitPrice: task.unitPrice, quantity: task.quantity, plannedFor: task.plannedFor, estimatedCost: task.estimatedCost, invoiceNumber: task.invoiceNumber, invoiceAmount: task.invoiceAmount, invoiceFileName: task.invoiceFileName, invoiceFileUrl: task.invoiceFileUrl, actualCost: task.actualCost, sourceTaskId: task.sourceTaskId, bestQuote: 0, quoteCount: 0, lineTotal: task.lineTotal ?? undefined } as RegisterTask)} projects={rollupProjects} suppliers={supplierCatalog.data || []} /></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Trades</CardTitle></CardHeader><CardContent><ExpandableBudgetTable lines={rollups.data.trades || []} onPatch={(id, data) => patchTask.mutate({ id, data })} onEdit={task => editTask({ id: task.id, projectId: task.projectId, title: task.title, description: task.description, productDescription: task.productDescription, supplierName: task.supplierName, category: task.category, tradeId: task.tradeId, status: task.status, unitPrice: task.unitPrice, quantity: task.quantity, plannedFor: task.plannedFor, estimatedCost: task.estimatedCost, invoiceNumber: task.invoiceNumber, invoiceAmount: task.invoiceAmount, invoiceFileName: task.invoiceFileName, invoiceFileUrl: task.invoiceFileUrl, actualCost: task.actualCost, sourceTaskId: task.sourceTaskId, bestQuote: 0, quoteCount: 0, lineTotal: task.lineTotal ?? undefined } as RegisterTask)} projects={rollupProjects} suppliers={supplierCatalog.data || []} /></CardContent></Card></div></details></CardContent></Card>}
  </div>

  <Dialog open={!!dialog && ["project", "trade", "task", "plan"].includes(dialog)} onOpenChange={open => !open && closeDialog()}><DialogContent><DialogHeader><DialogTitle>{dialog === "project" ? "New preparation project" : dialog === "trade" ? "Add trade" : dialog === "plan" ? "Attach executive plan" : editingTask ? "Edit procurement line" : "Add procurement line"}</DialogTitle></DialogHeader>
    {dialog === "project" && <div className="space-y-3"><Input placeholder="Project name" value={form.name || ""} onChange={event => setForm({ ...form, name: event.target.value })} /><Textarea placeholder="Scope and notes" value={form.description || ""} onChange={event => setForm({ ...form, description: event.target.value })} /><Select value={form.status || "Planning"} onValueChange={status => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planning">Planning</SelectItem><SelectItem value="Ready">Ready for execution</SelectItem><SelectItem value="On hold">On hold</SelectItem></SelectContent></Select></div>}
    {dialog === "trade" && <Input placeholder="Trade name" value={form.name || ""} onChange={event => setForm({ ...form, name: event.target.value })} />}
    {dialog === "plan" && <div className="space-y-3"><div className="rounded-lg border border-dashed p-5 text-center"><UploadCloud className="mx-auto h-7 w-7 text-primary/60" /><p className="mt-2 text-sm font-medium">Upload a PDF</p><input id="plan-file" type="file" accept="application/pdf" className="mx-auto mt-2 block max-w-full text-xs" /></div><Input placeholder="File name" value={form.fileName || ""} onChange={event => setForm({ ...form, fileName: event.target.value })} /><Input placeholder="https://..." value={form.fileUrl || ""} onChange={event => setForm({ ...form, fileUrl: event.target.value })} /></div>}
    {dialog === "task" && (
      <div className="space-y-3">
        {editingTask?.sourceTaskId && editingTask.sourceHasImage !== false && (
          <a href={`/api/tasks/${editingTask.sourceTaskId}/thumbnail`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium"><ImageIcon className="h-4 w-4 text-primary" />Original maintenance photo <span className="ml-auto text-xs font-normal text-muted-foreground">Open full size</span></div>
            <img src={`/api/tasks/${editingTask.sourceTaskId}/thumbnail`} onError={event => event.currentTarget.parentElement?.remove()} alt={`Photo for ${editingTask.title}`} className="max-h-64 w-full object-contain" />
          </a>
        )}
        <Input placeholder="Task" value={form.title || ""} onChange={event => setForm({ ...form, title: event.target.value })} />
        <Textarea placeholder="Product description / scope" value={form.productDescription || ""} onChange={event => setForm({ ...form, productDescription: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Supplier</label>
            <SupplierSelect
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.supplierName || ""}
              legacyName={form.supplierName}
              suppliers={supplierCatalog.data || []}
              pendingLabel="Select a supplier"
              onChange={supplierName => setForm({ ...form, supplierName })}
            />
          </div>
          <Input placeholder="Planned month / date" value={form.plannedFor || ""} onChange={event => setForm({ ...form, plannedFor: event.target.value })} />
          <Input placeholder="Category" value={form.category || DEFAULT_CATEGORY} onChange={event => setForm({ ...form, category: event.target.value })} />
          <Select value={form.tradeId || "none"} onValueChange={tradeId => setForm({ ...form, tradeId: tradeId === "none" ? "" : tradeId })}>
            <SelectTrigger><SelectValue placeholder="Assign trade" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Unassigned</SelectItem>{trades.data?.map(trade => <SelectItem key={trade.id} value={trade.id}>{trade.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input type="number" min="0" placeholder="Unit price" value={form.unitPrice || ""} onChange={event => setForm({ ...form, unitPrice: event.target.value })} />
          <Input type="number" min="0" placeholder="Quantity" value={form.quantity || ""} onChange={event => setForm({ ...form, quantity: event.target.value })} />
          <Select value={form.status || "Planned"} onValueChange={status => setForm({ ...form, status })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Planned">Planned</SelectItem><SelectItem value="In progress">In progress</SelectItem><SelectItem value="Complete">Complete</SelectItem><SelectItem value="On hold">On hold</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div><p className="text-sm font-medium">Final invoice</p><p className="text-xs text-muted-foreground">Invoice reference and actual amount are tracked separately from the planned line total.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Invoice reference" value={form.invoiceNumber || ""} onChange={event => setForm({ ...form, invoiceNumber: event.target.value })} />
            <Input type="number" min="0" placeholder="Invoice / actual amount" value={form.invoiceAmount || ""} onChange={event => setForm({ ...form, invoiceAmount: event.target.value })} />
          </div>
          <div className="rounded-md border border-dashed bg-background p-3">
            <div className="flex items-center gap-2"><UploadCloud className="h-4 w-4 text-primary" /><label htmlFor="invoice-file" className="text-sm font-medium">Invoice PDF</label></div>
            <input id="invoice-file" type="file" accept="application/pdf,.pdf" className="mt-2 block max-w-full text-xs" onChange={event => setInvoiceFile(event.target.files?.[0] || null)} />
            <p className="mt-1 text-xs text-muted-foreground">{invoiceFile ? `${invoiceFile.name} will replace the current invoice when you save.` : form.invoiceFileUrl ? "Choose another PDF to replace the attached invoice." : "PDF only, up to 25 MB."}</p>
            {form.invoiceFileUrl && <a href={form.invoiceFileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><FileText className="h-3.5 w-3.5" />{form.invoiceFileName || "View current invoice PDF"}</a>}
          </div>
        </div>
      </div>
    )}
    <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button disabled={createProject.isPending || createTrade.isPending || saveTask.isPending} onClick={() => dialog === "project" ? createProject.mutate() : dialog === "trade" ? createTrade.mutate() : dialog === "plan" ? submitPlan() : saveTask.mutate()}>{(createProject.isPending || createTrade.isPending || saveTask.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
  </DialogContent></Dialog>

  <Dialog open={dialog === "scope"} onOpenChange={open => !open && closeDialog()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>2026 works scope for {selectedBuilding?.name}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Rows were transcribed from the stored 2026 works PDF. Empty supplier, quantity, and price values are intentionally kept blank.</p><div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">{scope.isLoading ? <div className="h-32 animate-pulse rounded-lg bg-muted" /> : scope.data?.length ? scope.data.map(item => <label key={item.id} className={`flex gap-3 rounded-lg border p-3 ${item.imported ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-muted/30"}`}><input type="checkbox" className="mt-1 h-4 w-4" disabled={item.imported} checked={scopeIds.includes(item.id)} onChange={event => setScopeIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p>{item.imported && <Badge variant="secondary">Already imported</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{item.category} · {item.tradeName} · {item.plannedFor || "Timing pending"}{item.supplierName ? ` · ${item.supplierName}` : ""}</p>{item.estimatedCost && <p className="mt-1 text-xs font-medium">Source estimate: {money(Number(item.estimatedCost))}</p>}</div></label>) : <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No PDF scope rows are mapped to this location yet.</div>}</div><DialogFooter><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button disabled={!scopeIds.length || importScope.isPending} onClick={() => importScope.mutate()}>{importScope.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add {scopeIds.length || ""} source line{scopeIds.length === 1 ? "" : "s"}</Button></DialogFooter></DialogContent></Dialog>

  <Dialog open={dialog === "import"} onOpenChange={open => !open && closeDialog()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Import maintenance tasks</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Open tasks for {selectedBuilding?.name} are matched to this location. Importing never changes the original maintenance record.</p><div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">{importableTasks.isLoading ? <div className="h-32 animate-pulse rounded-lg bg-muted" /> : importableTasks.data?.length ? importableTasks.data.map(task => <label key={task.id} className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-muted/30"><input type="checkbox" className="mt-1 h-4 w-4" checked={importTaskIds.includes(task.id)} onChange={event => setImportTaskIds(current => event.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.title}</p><Badge variant="secondary" className="text-[10px]">{task.priority}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{task.category} · {task.tradeName}{task.assignedGroupName ? ` · source group: ${task.assignedGroupName}` : ""}</p></div></label>) : <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No open maintenance tasks are available for this location.</div>}</div><DialogFooter><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button disabled={!importTaskIds.length || importTasks.isPending} onClick={() => importTasks.mutate()}>{importTasks.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import {importTaskIds.length || ""} task{importTaskIds.length === 1 ? "" : "s"}</Button></DialogFooter></DialogContent></Dialog>

  <Dialog open={dialog === "quotes"} onOpenChange={open => !open && closeDialog()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle className="flex items-center justify-between gap-3">Quote comparison<Button size="sm" variant="outline" disabled={!quotes.data?.length} onClick={() => { const doc = new jsPDF(); doc.text(`Quote comparison — ${quoteTask?.title || ""}`, 15, 18); (quotes.data || []).forEach((quote, index) => doc.text(`${index + 1}. ${quote.supplierName} — ${money(quote.amount)}`, 15, 32 + index * 8)); doc.save("quote-comparison.pdf"); }}><FileText className="mr-2 h-4 w-4" />Export PDF</Button></DialogTitle></DialogHeader><div className="flex justify-end"><Button size="sm" onClick={() => { setForm({}); setDialog("quote"); }}><Plus className="mr-2 h-4 w-4" />Add quote</Button></div>{quotes.data?.length ? <div className="grid gap-3 sm:grid-cols-2">{quotes.data.map(quote => <div key={quote.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{quote.supplierName}</p><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteQuote(quote)}><Trash2 className="h-4 w-4" /></Button></div><p className="mt-3 text-2xl font-semibold text-primary">{money(quote.amount)}</p>{quote.fileUrl && <a href={quote.fileUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-primary hover:underline">{quote.fileName || "View attachment"}</a>}</div>)}</div> : <div className="py-10 text-center text-sm text-muted-foreground">No supplier quotes for this line.</div>}</DialogContent></Dialog>
  <Dialog open={dialog === "quote"} onOpenChange={open => !open && setDialog("quotes")}>
    <DialogContent>
      <DialogHeader><DialogTitle>Add supplier quote</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Supplier</label>
          <SupplierSelect
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.supplierName || ""}
            legacyName={form.supplierName}
            suppliers={supplierCatalog.data || []}
            pendingLabel="Select a supplier"
            onChange={supplierName => setForm({ ...form, supplierName })}
          />
        </div>
        <Input type="number" min="0" placeholder="Amount" value={form.amount || ""} onChange={event => setForm({ ...form, amount: event.target.value })} />
        <div className="rounded-lg border border-dashed p-4"><p className="mb-2 text-sm font-medium">Quote PDF</p><input id="quote-file" type="file" accept="application/pdf" className="block max-w-full text-xs" /></div>
        <Input placeholder="Attachment name (optional)" value={form.fileName || ""} onChange={event => setForm({ ...form, fileName: event.target.value })} />
        <Input placeholder="Attachment link (optional)" value={form.fileUrl || ""} onChange={event => setForm({ ...form, fileUrl: event.target.value })} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setDialog("quotes")}>Cancel</Button>
        <Button onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>
          {createQuote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save quote
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </Layout>;
}