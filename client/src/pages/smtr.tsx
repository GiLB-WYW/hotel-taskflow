import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { TaskCard } from "@/components/ui/task-card";
import { Task, User } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, AlertTriangle, Users, MapPin, Check, ChevronsUpDown, LayoutGrid, List, Download, CheckSquare, X, CheckCircle2, Wrench } from "lucide-react";
import jsPDF from "jspdf";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Category, Location as LocationType, User as DbUser, MaintenanceGroup } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { PRIORITIES } from "@/lib/mockData";

export default function SmtrPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [locationCategoryFilter, setLocationCategoryFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [userFilter, setUserFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();

  const markResolvedMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved" }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task Resolved", description: "Task has been marked as resolved." });
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: locations = [] } = useQuery<LocationType[]>({
    queryKey: ["/api/locations"],
  });

  const { data: allUsers = [] } = useQuery<DbUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: maintenanceGroups = [] } = useQuery<MaintenanceGroup[]>({
    queryKey: ["/api/maintenance-groups"],
  });

  const locationCategories = categories.map(cat => cat.name);

  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const smtrGroup = maintenanceGroups.find(g => g.name === "SMTR team");

  const tasks = allTasks.filter(task => {
    return task.assignedGroup === smtrGroup?.id || task.assignedGroup === "SMTR team";
  });

  const resolvedCount = tasks.filter(t => t.status === "Resolved").length;

  const filteredTasks = tasks.filter(task => {
    const searchLower = searchQuery.toLowerCase();
    const location = locations.find(l => l.id === task.locationId);

    const matchesSearch =
      task.title.toLowerCase().includes(searchLower) ||
      task.description.toLowerCase().includes(searchLower) ||
      (location?.name.toLowerCase().includes(searchLower)) ||
      (location?.id.toLowerCase().includes(searchLower)) ||
      (location?.name.split(/\s+/).some(word => word.toLowerCase().includes(searchLower)));

    let matchesStatus = true;
    if (statusFilter === "All") {
      matchesStatus = task.status !== "Resolved";
    } else {
      matchesStatus = task.status === statusFilter;
    }

    const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;

    let matchesLocationCategory = true;
    if (locationCategoryFilter !== "All") {
      const taskLocation = locations.find(l => l.id === task.locationId);
      matchesLocationCategory = taskLocation?.category === locationCategoryFilter;
    }

    let matchesLocation = true;
    if (locationFilter !== "All") {
      matchesLocation = task.locationId === locationFilter;
    }

    let matchesUser = true;
    if (userFilter !== "All") {
      matchesUser = task.assignedTo === userFilter;
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesLocationCategory && matchesLocation && matchesUser;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder: Record<string, number> = { "Red Flag": 0, "High": 1, "Normal": 2, "Low": 3 };
    const priorityDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const redFlagCount = tasks.filter(t => t.priority === "Red Flag").length;

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === sortedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(sortedTasks.map(t => t.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTasks(new Set());
  };

  const downloadTaskListPDF = async (tasksToExport?: typeof sortedTasks) => {
    const exportTasks = tasksToExport || sortedTasks;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    const imageCache: Record<string, string> = {};
    const tasksWithImages = exportTasks.filter(t => (t as any).hasImage || (t.imageUrl && t.imageUrl !== 'HAS_IMAGE'));

    await Promise.all(tasksWithImages.map(async (task) => {
      try {
        const response = await fetch(`/api/tasks/${task.id}/thumbnail`);
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          imageCache[task.id] = base64;
        }
      } catch (e) {
        console.log("Failed to load thumbnail for task:", task.id);
      }
    }));

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("SMTR Team - Task List", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleDateString("fr-FR", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    doc.text(`Generated: ${dateStr}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;

    doc.text(`Total: ${exportTasks.length} tasks`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    doc.setDrawColor(200);
    doc.line(15, yPos - 5, pageWidth - 15, yPos - 5);

    const thumbnailSize = 20;

    exportTasks.forEach((task, index) => {
      const hasImage = imageCache[task.id];
      const rowHeight = thumbnailSize + 6;

      if (yPos + rowHeight > 280) {
        doc.addPage();
        yPos = 20;
      }

      const location = locations.find(l => l.id === task.locationId);
      const assignedUser = allUsers.find(u => u.id === task.assignedTo);

      const thumbnailX = pageWidth - 15 - thumbnailSize;
      const thumbnailY = yPos - 2;

      doc.setDrawColor(180);
      doc.setFillColor(245, 245, 245);
      doc.rect(thumbnailX, thumbnailY, thumbnailSize, thumbnailSize, 'FD');

      if (hasImage) {
        try {
          doc.addImage(imageCache[task.id], 'JPEG', thumbnailX, thumbnailY, thumbnailSize, thumbnailSize);
        } catch (e) {
          console.log("Failed to add image to PDF");
        }
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const priorityLabel = `[${task.priority}]`;
      const statusLabel = task.status === "Resolved" ? " ✓" : "";
      const titleText = `${index + 1}. ${priorityLabel} ${task.title}${statusLabel}`;
      doc.text(titleText.substring(0, 60) + (titleText.length > 60 ? "..." : ""), 15, yPos);
      yPos += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`   Location: ${location?.name || "Unknown"} | Status: ${task.status}`, 15, yPos);
      yPos += 4;

      if (assignedUser) {
        doc.text(`   Assigned to: ${assignedUser.name}`, 15, yPos);
        yPos += 4;
      }

      if (task.description) {
        const desc = task.description.length > 70 ? task.description.substring(0, 70) + "..." : task.description;
        doc.text(`   ${desc}`, 15, yPos);
        yPos += 4;
      }

      doc.setTextColor(0);
      yPos += 8;
    });

    doc.save(`smtr-tasks-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (isLoading) {
    return (
      <Layout userRole="Admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading SMTR tasks...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout userRole="Admin">
      <div className="space-y-4 sm:space-y-6 pb-32 w-full overflow-x-hidden">
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-amber-700" data-testid="text-smtr-title">
                SMTR Team
              </h1>
              <p className="text-muted-foreground mt-0.5">
                All tasks assigned to the SMTR maintenance team
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div
            className={`bg-card border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${statusFilter === "Open" ? 'border-primary bg-primary/5' : 'border-border'}`}
            onClick={() => setStatusFilter(statusFilter === "Open" ? "All" : "Open")}
            data-testid="card-smtr-open"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">Open</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-primary">{tasks.filter(t => t.status === "Open").length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">tasks</span>
            </div>
          </div>
          <div
            className={`bg-card border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${priorityFilter === "Red Flag" ? 'border-red-500 bg-red-100/70 ring-2 ring-red-300' : 'border-red-200 bg-red-50/50'}`}
            onClick={() => {
              if (priorityFilter === "Red Flag") {
                setPriorityFilter("All");
              } else {
                setPriorityFilter("Red Flag");
                setStatusFilter("All");
              }
            }}
            data-testid="card-smtr-critical"
          >
            <div className="flex items-center justify-between">
              <p className="text-red-700/80 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Critical</p>
              <AlertTriangle className="h-3.5 sm:h-4 w-3.5 sm:w-4 text-red-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-red-700">{redFlagCount}</span>
              <span className="text-[10px] sm:text-xs text-red-600/80">needs attention</span>
            </div>
          </div>
          <div
            className={`bg-card border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${statusFilter === "In Progress" ? 'border-blue-400 bg-blue-50/50' : 'border-border'}`}
            onClick={() => setStatusFilter(statusFilter === "In Progress" ? "All" : "In Progress")}
            data-testid="card-smtr-in-progress"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">In Progress</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-primary">{tasks.filter(t => t.status === "In Progress").length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">active</span>
            </div>
          </div>
          <div
            className={`bg-card border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${statusFilter === "Resolved" ? 'border-green-400 bg-green-50/50' : 'border-border'}`}
            onClick={() => setStatusFilter(statusFilter === "Resolved" ? "All" : "Resolved")}
            data-testid="card-smtr-resolved"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">Resolved</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-green-600">{resolvedCount}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">completed</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center bg-card p-3 rounded-lg border border-border shadow-sm">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SMTR tasks..."
              className="pl-9 bg-background h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-smtr-search"
            />
          </div>
          <div className="flex gap-1 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 flex-shrink-0 scrollbar-thin" style={{ WebkitOverflowScrolling: "touch" }}>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 sm:w-32 bg-background text-sm flex-shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Active Tasks</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationCategoryFilter} onValueChange={(val) => {
              setLocationCategoryFilter(val);
              setLocationFilter("All");
            }}>
              <SelectTrigger className="w-32 sm:w-40 bg-background text-sm flex-shrink-0">
                <SelectValue placeholder="Building" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Buildings</SelectItem>
                {locationCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={locationSearchOpen} onOpenChange={setLocationSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={locationSearchOpen}
                  className="w-40 sm:w-48 justify-between bg-background text-sm flex-shrink-0"
                >
                  <MapPin className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">
                    {locationFilter === "All"
                      ? "All Locations"
                      : locations.find(l => l.id === locationFilter)?.name || "Select..."}
                  </span>
                  <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search locations..." />
                  <CommandList>
                    <CommandEmpty>No location found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setLocationFilter("All");
                          setLocationSearchOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", locationFilter === "All" ? "opacity-100" : "opacity-0")} />
                        All Locations
                      </CommandItem>
                      {locations
                        .filter(loc => locationCategoryFilter === "All" || loc.category === locationCategoryFilter)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(loc => (
                          <CommandItem
                            key={loc.id}
                            value={loc.name}
                            onSelect={() => {
                              setLocationFilter(loc.id);
                              setLocationSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", locationFilter === loc.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{loc.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{loc.category}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-28 sm:w-32 bg-background text-sm flex-shrink-0">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Priorities</SelectItem>
                <SelectItem value="Red Flag">Red Flag</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-32 sm:w-40 bg-background text-sm flex-shrink-0">
                <Users className="h-4 w-4 mr-1" />
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Users</SelectItem>
                {allUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-10 w-10 flex-shrink-0 hover:text-primary"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("All");
                setPriorityFilter("All");
                setUserFilter("All");
                setLocationCategoryFilter("All");
                setLocationFilter("All");
              }}
              title="Reset all filters"
              data-testid="button-smtr-reset-filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-serif font-semibold flex items-center gap-2">
              SMTR Tasks
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                {sortedTasks.length}
              </Badge>
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant={selectionMode ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                title={selectionMode ? "Cancel selection" : "Select tasks"}
                disabled={sortedTasks.length === 0}
                data-testid="button-smtr-toggle-selection"
              >
                {selectionMode ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                <span className="hidden sm:inline">{selectionMode ? "Cancel" : "Select"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  if (selectionMode && selectedTasks.size > 0) {
                    const selected = sortedTasks.filter(t => selectedTasks.has(t.id));
                    downloadTaskListPDF(selected);
                  } else {
                    downloadTaskListPDF();
                  }
                }}
                title={selectionMode && selectedTasks.size > 0 ? `Export ${selectedTasks.size} selected as PDF` : "Download all as PDF"}
                disabled={sortedTasks.length === 0 || (selectionMode && selectedTasks.size === 0)}
                data-testid="button-smtr-download-pdf"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {selectionMode && selectedTasks.size > 0 ? `PDF (${selectedTasks.size})` : "PDF"}
                </span>
              </Button>
              <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/50">
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode("cards")}
                  title="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {selectionMode && sortedTasks.length > 0 && (
            <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={toggleSelectAll}
                data-testid="button-smtr-select-all"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {selectedTasks.size === sortedTasks.length ? "Deselect all" : "Select all"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedTasks.size} of {sortedTasks.length} selected
              </span>
            </div>
          )}

          {sortedTasks.length > 0 ? (
            viewMode === "cards" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {sortedTasks.map(task => {
                  const taskUrl = `/task/${task.id}`;
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setLocation(taskUrl)}
                      locations={locations}
                      users={allUsers}
                      maintenanceGroups={maintenanceGroups}
                      selectionMode={selectionMode}
                      isSelected={selectedTasks.has(task.id)}
                      onSelect={toggleTaskSelection}
                      onMarkResolved={(id) => markResolvedMutation.mutate(id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTasks.map(task => {
                  const taskUrl = `/task/${task.id}`;
                  const location = locations.find(l => l.id === task.locationId);
                  const assignedUser = allUsers.find(u => u.id === task.assignedTo);
                  const priorityColors: Record<string, string> = {
                    "Red Flag": "bg-red-100 text-red-800 border-red-300",
                    "High": "bg-orange-100 text-orange-800 border-orange-300",
                    "Normal": "bg-blue-100 text-blue-800 border-blue-300",
                    "Low": "bg-green-100 text-green-800 border-green-300"
                  };

                  return (
                    <div
                      key={task.id}
                      onClick={() => selectionMode ? toggleTaskSelection(task.id) : setLocation(taskUrl)}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer",
                        task.status === "Resolved" && "bg-green-50/50 border-green-200",
                        selectedTasks.has(task.id) && "ring-2 ring-primary bg-primary/5"
                      )}
                      data-testid={`row-smtr-task-${task.id}`}
                    >
                      {selectionMode && (
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          className="h-5 w-5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleTaskSelection(task.id)}
                        />
                      )}
                      <Badge className={cn("text-[10px] px-2 py-0.5 border shrink-0", priorityColors[task.priority] || "")}>
                        {task.priority}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate">{location?.name || "Unknown"}</span>
                          <span className="text-border">|</span>
                          <Badge variant={task.status === "Resolved" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                            {task.status}
                          </Badge>
                          {assignedUser && (
                            <span className="truncate">→ {assignedUser.name}</span>
                          )}
                        </div>
                      </div>
                      {task.status !== "Resolved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-green-600 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            markResolvedMutation.mutate(task.id);
                          }}
                          title="Mark as resolved"
                          data-testid={`button-smtr-resolve-${task.id}`}
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </Button>
                      )}
                      {((task as any).hasImage || (task.imageUrl && task.imageUrl !== 'HAS_IMAGE')) && (
                        <div className="h-10 w-10 rounded overflow-hidden bg-muted shrink-0 border border-border">
                          <img
                            src={`/api/tasks/${task.id}/thumbnail`}
                            alt="Task"
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Wrench className="h-6 w-6 text-muted-foreground" />
              </div>
              <h4 className="font-medium text-lg">No SMTR tasks found</h4>
              <p className="text-muted-foreground mt-1 text-sm">
                {searchQuery || statusFilter !== "All" || priorityFilter !== "All"
                  ? "Try adjusting your filters"
                  : "No tasks are currently assigned to the SMTR team"}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
