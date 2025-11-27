import { useLocation, useRoute } from "wouter";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Filter, Save, Edit, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Location {
  id: string;
  name: string;
  code: string;
  category: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  locationId: string;
  createdAt: string;
}

const CATEGORIES = ["Restaurant", "Suites B", "Suites C", "Technique", "Building A", "Building B", "Building C", "Building D", "Building E", "Building F", "Building G", "Building H", "Building I", "Building J"];

const PRIORITIES: Record<string, { color: string }> = {
  "Red Flag": { color: "bg-red-100 text-red-800" },
  "High": { color: "bg-orange-100 text-orange-800" },
  "Normal": { color: "bg-blue-100 text-blue-800" },
  "Low": { color: "bg-gray-100 text-gray-800" },
};

export default function LocationDetail() {
  const [, params] = useRoute("/location/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "", category: "" });
  
  // Date filter state
  const [startDate, setStartDate] = useState(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().split('T')[0]); // 30 days ago
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Today

  // Fetch location from API
  const { data: location, isLoading: locationLoading } = useQuery<Location>({
    queryKey: ["/api/locations", params?.id],
    queryFn: async () => {
      const response = await fetch(`/api/locations/${params?.id}`);
      if (!response.ok) throw new Error("Location not found");
      return response.json();
    },
    enabled: !!params?.id,
  });

  // Fetch tasks for this location
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  // Update form when location data loads
  useEffect(() => {
    if (location) {
      setFormData({ name: location.name, code: location.code, category: location.category });
    }
  }, [location]);

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; category: string }) => {
      const response = await fetch(`/api/locations/${params?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Location Updated", description: "Changes have been saved." });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update location.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formData.name || !formData.code || !formData.category) {
      toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleCancelEdit = () => {
    if (location) {
      setFormData({ name: location.name, code: location.code, category: location.category });
    }
    setIsEditing(false);
  };

  if (locationLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Loading location...</p>
        </div>
      </Layout>
    );
  }

  if (!location) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="text-xl font-bold text-muted-foreground">Location not found</h2>
          <Button variant="link" onClick={() => setLocation("/admin/locations")}>Return to Locations</Button>
        </div>
      </Layout>
    );
  }

  // Filter tasks by location and date range
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999);

  const locationTasks = allTasks.filter(t => {
    const taskDate = new Date(t.createdAt);
    return t.locationId === location.id && 
           taskDate >= startDateObj && 
           taskDate <= endDateObj;
  });

  const completedTasks = locationTasks.filter(t => t.status === "Resolved");
  const requestedTasks = locationTasks.filter(t => t.status === "Open" || t.status === "In Progress");

  const handleDateChange = () => {
    toast({
      title: "Filter Applied",
      description: `Showing tasks from ${format(startDateObj, "MMM d, yyyy")} to ${format(endDateObj, "MMM d, yyyy")}`,
    });
  };

  return (
    <Layout userRole="Admin">
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          className="pl-0 hover:bg-transparent hover:text-primary h-9 mb-4"
          onClick={() => setLocation("/admin/locations")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Locations
        </Button>

        {/* Location Info Card with Edit */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Location Details</CardTitle>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-location">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-location">
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Location Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-location-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Location Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    data-testid="input-location-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger data-testid="select-location-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-serif font-bold text-primary">{location.name}</h1>
                  <Badge variant="secondary" className="text-sm">{location.category}</Badge>
                </div>
                <p className="text-muted-foreground">Code: <span className="font-mono">{location.code}</span></p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date Range Filter */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Range Filter
            </CardTitle>
            <CardDescription>Select date range to view tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">From Date</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">To Date</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="input-end-date"
                />
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleDateChange}
                data-testid="button-apply-filter"
              >
                <Filter className="h-4 w-4 mr-2" />
                Apply Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{completedTasks.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Completed Tasks</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{requestedTasks.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Requested Tasks</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Completed Tasks Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-primary">Completed Tasks</h2>
            <Badge className="bg-green-100 text-green-800">{completedTasks.length}</Badge>
          </div>
          
          {completedTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No completed tasks in this date range</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setLocation(`/task/${task.id}`)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2 hover:text-primary">
                          {task.title}
                        </CardTitle>
                      </div>
                      <Badge className={cn("flex-shrink-0", PRIORITIES[task.priority]?.color || "")}>
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                        {task.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Requested Tasks Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-primary">Requested Tasks</h2>
            <Badge className="bg-orange-100 text-orange-800">{requestedTasks.length}</Badge>
          </div>
          
          {requestedTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No requested tasks in this date range</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requestedTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-lg transition-shadow border-orange-200 cursor-pointer" onClick={() => setLocation(`/task/${task.id}`)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2 hover:text-primary">
                          {task.title}
                        </CardTitle>
                      </div>
                      <Badge className={cn("flex-shrink-0", PRIORITIES[task.priority]?.color || "")}>
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className={cn(
                        task.status === "In Progress" 
                          ? "bg-blue-50 text-blue-700 border-blue-300" 
                          : "bg-red-50 text-red-700 border-red-300"
                      )}>
                        {task.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
