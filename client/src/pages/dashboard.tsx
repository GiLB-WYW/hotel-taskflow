import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { TaskCard } from "@/components/ui/task-card";
import { Task, User } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ArrowUpDown, AlertTriangle, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { isToday } from "date-fns";
import type { Category, Location, User as DbUser } from "@shared/schema";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [locationCategoryFilter, setLocationCategoryFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");
  const [resolvedTodayFilter, setResolvedTodayFilter] = useState(false);
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Fetch categories (buildings) from API
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch locations from API
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  // Fetch users from API for the user filter dropdown
  const { data: allUsers = [] } = useQuery<DbUser[]>({
    queryKey: ["/api/users"],
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

  // Helper function to check if a task was resolved today
  const isResolvedToday = (task: Task) => {
    return task.status === "Resolved" && task.updatedAt && isToday(new Date(task.updatedAt));
  };

  // Calculate resolved today count dynamically
  const resolvedTodayCount = tasks.filter(isResolvedToday).length;

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
    
    const matchesStatus = statusFilter === "All" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
    
    // Match by location category (e.g., "Suites B", "Restaurant", etc.)
    let matchesLocationCategory = true;
    if (locationCategoryFilter !== "All") {
      const taskLocation = locations.find(l => l.id === task.locationId);
      matchesLocationCategory = taskLocation?.category === locationCategoryFilter;
    }

    // If resolved today filter is active, only show tasks resolved today
    const matchesResolvedToday = !resolvedTodayFilter || isResolvedToday(task);

    // Match by user (assigned to or created by)
    let matchesUser = true;
    if (userFilter !== "All") {
      matchesUser = task.assignedTo === userFilter || task.createdBy === userFilter;
    }
    
    return matchesSearch && matchesStatus && matchesPriority && matchesLocationCategory && matchesResolvedToday && matchesUser;
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
            className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
            onClick={() => { setStatusFilter("Open"); setResolvedTodayFilter(false); }}
            data-testid="card-open-tasks"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">Open Tasks</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-primary">{tasks.filter(t => t.status === "Open").length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">tasks</span>
            </div>
          </div>
          <div 
            className="bg-card border border-red-200 bg-red-50/50 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
            onClick={() => { setPriorityFilter("Red Flag"); setResolvedTodayFilter(false); setStatusFilter("All"); }}
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
            className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
            onClick={() => { setStatusFilter("In Progress"); setResolvedTodayFilter(false); }}
            data-testid="card-in-progress"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">In Progress</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-primary">{tasks.filter(t => t.status === "In Progress").length}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">active</span>
            </div>
          </div>
          <div 
            className={`bg-card border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all ${resolvedTodayFilter ? 'border-green-400 bg-green-50/50' : 'border-border'}`}
            onClick={() => {
              if (resolvedTodayFilter) {
                setResolvedTodayFilter(false);
                setStatusFilter("All");
              } else {
                setResolvedTodayFilter(true);
                setStatusFilter("Resolved");
              }
            }}
            data-testid="card-resolved"
          >
            <p className="text-muted-foreground text-[10px] sm:text-xs font-medium uppercase tracking-wider">Resolved Today</p>
            <div className="mt-2 flex items-baseline gap-1 sm:gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-green-600">{resolvedTodayCount}</span>
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
             <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setResolvedTodayFilter(false); }}>
              <SelectTrigger className="w-28 sm:w-32 bg-background text-sm flex-shrink-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationCategoryFilter} onValueChange={setLocationCategoryFilter}>
              <SelectTrigger className="w-32 sm:w-40 bg-background text-sm flex-shrink-0">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Locations</SelectItem>
                {locationCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

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
            
            <Button variant="ghost" size="icon" className="text-muted-foreground h-10 w-10 flex-shrink-0">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Task Grid */}
        <div>
          <h3 className="text-lg font-serif font-semibold mb-4 flex items-center gap-2">
            Tasks
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
              {sortedTasks.length}
            </Badge>
          </h3>
          
          {sortedTasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {sortedTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onClick={() => setLocation(`/task/${task.id}`)}
                />
              ))}
            </div>
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
                onClick={() => {setSearchQuery(""); setStatusFilter("All"); setPriorityFilter("All"); setUserFilter("All"); setLocationCategoryFilter("All");}}
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
