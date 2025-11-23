import { useLocation, useRoute } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASKS, LOCATIONS, USERS, PRIORITIES } from "@/lib/mockData";
import { ArrowLeft, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function LocationDetail() {
  const [, params] = useRoute("/location/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const location = LOCATIONS.find(l => l.id === params?.id);
  
  // Date filter state
  const [startDate, setStartDate] = useState(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().split('T')[0]); // 30 days ago
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Today

  if (!location) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="text-xl font-bold text-muted-foreground">Location not found</h2>
          <Button variant="link" onClick={() => setLocation("/admin")}>Return to Admin</Button>
        </div>
      </Layout>
    );
  }

  // Filter tasks by location and date range
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999); // Include entire end date

  const locationTasks = TASKS.filter(t => {
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
          onClick={() => setLocation("/admin")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-serif font-bold text-primary">{location.name}</h1>
            <Badge variant="secondary" className="text-sm">{location.category}</Badge>
          </div>
          <p className="text-muted-foreground">Location ID: {location.id}</p>
        </div>

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
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">To Date</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleDateChange}
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
                <Card key={task.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2 cursor-pointer hover:text-primary" onClick={() => setLocation(`/task/${task.id}`)}>
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
                <Card key={task.id} className="hover:shadow-lg transition-shadow border-orange-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base line-clamp-2 cursor-pointer hover:text-primary" onClick={() => setLocation(`/task/${task.id}`)}>
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
