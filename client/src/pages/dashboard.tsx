import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { TaskCard } from "@/components/ui/task-card";
import { Task, User } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, RotateCcw, AlertTriangle, Plus, Users, MapPin, Check, ChevronsUpDown, LayoutGrid, List, Download } from "lucide-react";
import jsPDF from "jspdf";
import { Badge } from "@/components/ui/badge";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Category, Location as LocationType, User as DbUser, MaintenanceGroup } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState(urlParams.get("priority") || "All");
  const [locationCategoryFilter, setLocationCategoryFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [userFilter, setUserFilter] = useState(urlParams.get("user") || "All");
  const [groupFilter, setGroupFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Update filters when URL parameters change (including reset when params are removed)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const priority = params.get("priority");
    const user = params.get("user");
    // Set or reset filters based on URL params
    setPriorityFilter(priority || "All");
    setUserFilter(user || "All");
  }, [searchParams]);

  // Fetch categories (buildings) from API
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch locations from API
  const { data: locations = [] } = useQuery<LocationType[]>({
    queryKey: ["/api/locations"],
  });

  // Fetch users from API for the user filter dropdown
  const { data: allUsers = [] } = useQuery<DbUser[]>({
    queryKey: ["/api/users"],
  });

  // Fetch maintenance groups from API
  const { data: maintenanceGroups = [] } = useQuery<MaintenanceGroup[]>({
    queryKey: ["/api/maintenance-groups"],
  });

  // Get building names for the filter dropdown
  const locationCategories = categories.map(cat => cat.name);

  // Get current user from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const userData = JSON.parse(userStr);
      setCurrentUser(userData as User);
    }
  }, []);

  // Fetch tasks from API
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  // Filter tasks based on user role
  const tasks = allTasks.filter(task => {
    if (!currentUser) return true; // Show all if user not loaded yet
    
    // Admin sees everything
    if (currentUser.role === "Admin") return true;
    
    // Manager sees all tasks from their group
    if (currentUser.role === "Manager" && currentUser.group) {
      return task.assignedGroup === currentUser.group;
    }
    
    // Personnel and Basic Staff see only their own tasks
    if (currentUser.role === "Personnel" || currentUser.role === "Basic Staff") {
      return task.createdBy === currentUser.id || task.assignedTo === currentUser.id;
    }
    
    return true;
  });

  // Calculate resolved count dynamically
  const resolvedCount = tasks.filter(t => t.status === "Resolved").length;

  // Filter Logic with Smart Search
  const filteredTasks = tasks.filter(task => {
    const searchLower = searchQuery.toLowerCase();
    const location = locations.find(l => l.id === task.locationId);
    
    // Smart search: match title, description, location name, location code
    const matchesSearch = 
      task.title.toLowerCase().includes(searchLower) || 
      task.description.toLowerCase().includes(searchLower) ||
      (location?.name.toLowerCase().includes(searchLower)) ||
      (location?.id.toLowerCase().includes(searchLower)) ||
      // Also match just the room/location code (e.g., "C2" from "Suite C2")
      (location?.name.split(/\s+/).some(word => word.toLowerCase().includes(searchLower)));
    
    // By default, hide resolved tasks unless explicitly filtering for them
    let matchesStatus = true;
    if (statusFilter === "All") {
      // When "All" is selected, hide resolved tasks from the main list
      matchesStatus = task.status !== "Resolved";
    } else {
      matchesStatus = task.status === statusFilter;
    }
    
    const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
    
    // Match by location category (e.g., "Suites B", "Restaurant", etc.)
    let matchesLocationCategory = true;
    if (locationCategoryFilter !== "All") {
      const taskLocation = locations.find(l => l.id === task.locationId);
      matchesLocationCategory = taskLocation?.category === locationCategoryFilter;
    }

    // Match by specific location
    let matchesLocation = true;
    if (locationFilter !== "All") {
      matchesLocation = task.locationId === locationFilter;
    }

    // Match by user (assigned to only)
    let matchesUser = true;
    if (userFilter !== "All") {
      matchesUser = task.assignedTo === userFilter;
    }

    // Match by maintenance group (check both ID and name for backwards compatibility)
    let matchesGroup = true;
    if (groupFilter !== "All") {
      const selectedGroup = maintenanceGroups.find(g => g.id === groupFilter);
      matchesGroup = task.assignedGroup === groupFilter || 
        (selectedGroup ? task.assignedGroup === selectedGroup.name : false);
    }
    
    return matchesSearch && matchesStatus && matchesPriority && matchesLocationCategory && matchesLocation && matchesUser && matchesGroup;
  });

  // Sort by Priority (Red Flag first), then by creation date (newest first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { "Red Flag": 0, "High": 1, "Normal": 2, "Low": 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const redFlagCount = tasks.filter(t => t.priority === "Red Flag").length;

  const downloadTaskListPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;
    
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Task List", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleDateString("fr-FR", { 
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" 
    });
    doc.text(`Generated: ${dateStr}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;
    
    const activeFilters = [];
    if (statusFilter !== "All") activeFilters.push(`Status: ${statusFilter}`);
    if (priorityFilter !== "All") activeFilters.push(`Priority: ${priorityFilter}`);
    if (locationCategoryFilter !== "All") activeFilters.push(`Building: ${locationCategoryFilter}`);
    if (locationFilter !== "All") {
      const loc = locations.find(l => l.id === locationFilter);
      activeFilters.push(`Location: ${loc?.name || locationFilter}`);
    }
    if (userFilter !== "All") {
      const user = allUsers.find(u => u.id === userFilter);
      activeFilters.push(`Assigned: ${user?.name || userFilter}`);
    }
    if (groupFilter !== "All") {
      const group = maintenanceGroups.find(g => g.id === groupFilter);
      activeFilters.push(`Group: ${group?.name || groupFilter}`);
    }
    if (activeFilters.length > 0) {
      doc.text(`Filters: ${activeFilters.join(" | ")}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 5;
    }
    
    doc.text(`Total: ${sortedTasks.length} tasks`, pageWidth / 2, yPos, { align: "center" });
    yPos += 15;
    
    doc.setDrawColor(200);
    doc.line(15, yPos - 5, pageWidth - 15, yPos - 5);
    
    sortedTasks.forEach((task, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const location = locations.find(l => l.id === task.locationId);
      const assignedUser = allUsers.find(u => u.id === task.assignedTo);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const priorityLabel = `[${task.priority}]`;
      const statusLabel = task.status === "Resolved" ? " ✓" : "";
      doc.text(`${index + 1}. ${priorityLabel} ${task.title}${statusLabel}`, 15, yPos);
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
        const desc = task.description.length > 100 ? task.description.substring(0, 100) + "..." : task.description;
        doc.text(`   ${desc}`, 15, yPos);
        yPos += 4;
      }
      
      doc.setTextColor(0);
      yPos += 4;
    });
    
    doc.save(`task-list-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 pb-32 w-full overflow-x-hidden">
        {/* Welcome Message */}
        {currentUser && (
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary">
              Welcome, {currentUser.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentUser.role === "Admin" && "Viewing all tasks in the system"}
              {currentUser.role === "Manager" && `Viewing all tasks for ${currentUser.group}`}
              {(currentUser.role === "Personnel" || currentUser.role === "Basic Staff") && "Viewing your assigned tasks"}
            </p>
          </div>
        )}

        {/* Stats Overview - Clickable Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <div 
            className={`bg-card border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${statusFilter === "Open" ? 'border-primary bg-primary/5' : 'border-border'}`}
            onClick={() => {
              if (statusFilter === "Open") {
                setStatusFilter("All");
              } else {
                setStatusFilter("Open");
              }
            }}
            data-testid="card-open-tasks"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">Open Tasks</p>
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
            data-testid="card-critical"
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
            onClick={() => {
              if (statusFilter === "In Progress") {
                setStatusFilter("All");
              } else {
                setStatusFilter("In Progress");
              }
            }}
            data-testid="card-in-progress"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">In Progress</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-primary">{tasks.filter(t => t.status === "In Progress").length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">active</span>
            </div>
          </div>
          <div 
            className={`bg-card border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${statusFilter === "Resolved" ? 'border-green-400 bg-green-50/50' : 'border-border'}`}
            onClick={() => {
              if (statusFilter === "Resolved") {
                setStatusFilter("All");
              } else {
                setStatusFilter("Resolved");
              }
            }}
            data-testid="card-resolved"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">Resolved</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-green-600">{resolvedCount}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">completed</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center bg-card p-3 rounded-lg border border-border shadow-sm">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks..." 
              className="pl-9 bg-background h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 flex-shrink-0">
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

            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-32 sm:w-40 bg-background text-sm flex-shrink-0" data-testid="select-group-filter">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Groups</SelectItem>
                {maintenanceGroups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
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
                setGroupFilter("All");
              }}
              title="Reset all filters"
              data-testid="button-reset-filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Task Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-serif font-semibold flex items-center gap-2">
              Tasks
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                {sortedTasks.length}
              </Badge>
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={downloadTaskListPDF}
                title="Download as PDF"
                disabled={sortedTasks.length === 0}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
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
          
          {sortedTasks.length > 0 ? (
            viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {sortedTasks.map(task => {
                // Build filter query string to preserve context when navigating to task
                const filterParams = new URLSearchParams();
                if (statusFilter !== "All") filterParams.set("status", statusFilter);
                if (priorityFilter !== "All") filterParams.set("priority", priorityFilter);
                if (locationCategoryFilter !== "All") filterParams.set("location", locationCategoryFilter);
                if (userFilter !== "All") filterParams.set("user", userFilter);
                if (groupFilter !== "All") filterParams.set("group", groupFilter);
                const queryString = filterParams.toString();
                const taskUrl = `/task/${task.id}${queryString ? `?${queryString}` : ""}`;
                
                return (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onClick={() => setLocation(taskUrl)}
                    locations={locations}
                    users={allUsers}
                    maintenanceGroups={maintenanceGroups}
                  />
                );
              })}
            </div>
            ) : (
            <div className="space-y-2">
              {sortedTasks.map(task => {
                const filterParams = new URLSearchParams();
                if (statusFilter !== "All") filterParams.set("status", statusFilter);
                if (priorityFilter !== "All") filterParams.set("priority", priorityFilter);
                if (locationCategoryFilter !== "All") filterParams.set("location", locationCategoryFilter);
                if (userFilter !== "All") filterParams.set("user", userFilter);
                if (groupFilter !== "All") filterParams.set("group", groupFilter);
                const queryString = filterParams.toString();
                const taskUrl = `/task/${task.id}${queryString ? `?${queryString}` : ""}`;
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
                    onClick={() => setLocation(taskUrl)}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer",
                      task.status === "Resolved" && "bg-green-50/50 border-green-200"
                    )}
                  >
                    <div className={cn(
                      "w-1 h-12 rounded-full shrink-0",
                      task.status === "Resolved" ? "bg-green-500" :
                      task.priority === "Red Flag" ? "bg-red-500" :
                      task.priority === "High" ? "bg-orange-500" :
                      task.priority === "Normal" ? "bg-blue-500" : "bg-green-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{task.title}</span>
                        <Badge variant="outline" className={cn("text-xs shrink-0", priorityColors[task.priority])}>
                          {task.priority}
                        </Badge>
                        {task.status === "Resolved" && (
                          <Badge className="bg-green-100 text-green-800 border-green-300 text-xs shrink-0">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {location?.name || "Unknown"}
                        </span>
                        {assignedUser && (
                          <span className="truncate">→ {assignedUser.name}</span>
                        )}
                      </div>
                    </div>
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
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No tasks found</h3>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search query.</p>
              <Button 
                variant="link" 
                className="mt-2 text-primary" 
                onClick={() => {setSearchQuery(""); setStatusFilter("All"); setPriorityFilter("All"); setUserFilter("All"); setLocationCategoryFilter("All"); setLocationFilter("All"); setGroupFilter("All");}}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setLocation("/create-task")}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 lg:bottom-8 lg:right-8 h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary text-primary-foreground shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center z-50 group"
        data-testid="button-create-task-fab"
        aria-label="Create New Task"
      >
        <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <Plus className="h-6 sm:h-7 w-6 sm:w-7 relative z-10" />
      </button>
    </Layout>
  );
}
