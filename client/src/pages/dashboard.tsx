import { useState } from "react";
import { Layout } from "@/components/layout";
import { TaskCard } from "@/components/ui/task-card";
import { TASKS, TASKS as INITIAL_TASKS, LOCATIONS, Task } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [, setLocation] = useLocation();

  // Filter Logic
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort by Priority (Red Flag first)
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { "Red Flag": 0, "High": 1, "Normal": 2, "Low": 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const redFlagCount = tasks.filter(t => t.priority === "Red Flag").length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Open Tasks</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{tasks.filter(t => t.status === "Open").length}</span>
              <span className="text-xs text-muted-foreground">tasks</span>
            </div>
          </div>
          <div className="bg-card border border-red-200 bg-red-50/50 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-red-700/80 text-xs font-medium uppercase tracking-wider">Critical</p>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-700">{redFlagCount}</span>
              <span className="text-xs text-red-600/80">needs attention</span>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">In Progress</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{tasks.filter(t => t.status === "In Progress").length}</span>
              <span className="text-xs text-muted-foreground">active</span>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Resolved Today</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">12</span>
              <span className="text-xs text-muted-foreground">completed</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-3 rounded-lg border border-border shadow-sm">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks..." 
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
             <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px] bg-background">
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
            
            <Button variant="ghost" size="icon" className="text-muted-foreground">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                onClick={() => {setSearchQuery(""); setStatusFilter("All"); setPriorityFilter("All");}}
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
