import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASKS, LOCATIONS, USERS, PRIORITIES, Task } from "@/lib/mockData";
import { ArrowLeft, Calendar, MapPin, User, Download, MessageSquare, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function TaskDetail() {
  const [, params] = useRoute("/task/:id");
  const [, setLocation] = useLocation();
  
  const task = TASKS.find(t => t.id === params?.id);
  
  if (!task) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="text-xl font-bold text-muted-foreground">Task not found</h2>
          <Button variant="link" onClick={() => setLocation("/")}>Return to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  const location = LOCATIONS.find(l => l.id === task.locationId);
  const creator = USERS.find(u => u.id === task.createdBy);
  const assignee = USERS.find(u => u.id === task.assignedTo);
  const priorityConfig = PRIORITIES[task.priority];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button 
          variant="ghost" 
          className="pl-0 hover:bg-transparent hover:text-primary"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={cn("text-sm px-3 py-1", priorityConfig.color)}>
                {task.priority}
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {task.status}
              </Badge>
            </div>
            <h1 className="text-3xl font-serif font-bold text-primary leading-tight">
              {task.title}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground text-sm">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {location?.name} ({location?.category})
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(task.createdAt), "PPP 'at' p")}
              </span>
            </div>
          </div>
          
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Fiche
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-foreground/90 leading-relaxed">
                  {task.description}
                </p>
                {task.originalTranscript && (
                  <div className="bg-muted/30 p-4 rounded-lg border border-border text-sm italic text-muted-foreground">
                    <p className="font-semibold text-xs uppercase tracking-wider mb-1 not-italic text-primary/70">Original Transcript</p>
                    "{task.originalTranscript}"
                  </div>
                )}
                {task.imageUrl && (
                   <div className="mt-4 rounded-lg overflow-hidden border border-border">
                     <img src={task.imageUrl} alt="Task Evidence" className="w-full max-h-96 object-cover" />
                   </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative pl-6 border-l border-border space-y-6">
                  <div className="relative">
                    <div className="absolute -left-[31px] h-4 w-4 rounded-full bg-green-500 border-2 border-background"></div>
                    <p className="text-sm font-medium">Task Created</p>
                    <p className="text-xs text-muted-foreground">By {creator?.name || "Unknown"} • {format(new Date(task.createdAt), "p")}</p>
                  </div>
                  {task.status === "In Progress" && (
                    <div className="relative">
                      <div className="absolute -left-[31px] h-4 w-4 rounded-full bg-blue-500 border-2 border-background"></div>
                      <p className="text-sm font-medium">Status changed to In Progress</p>
                      <p className="text-xs text-muted-foreground">By Manager • 10 mins ago</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Assigned Group</p>
                  <Badge variant="secondary" className="text-sm w-full justify-center py-1">
                    {task.assignedGroup || "General"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Assigned To</p>
                  {assignee ? (
                    <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {assignee.avatar}
                      </div>
                      <span className="text-sm font-medium">{assignee.name}</span>
                    </div>
                  ) : (
                     <Button variant="outline" className="w-full border-dashed text-muted-foreground">
                       <User className="h-4 w-4 mr-2" />
                       Assign Person
                     </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">SLA Status</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-sm font-medium">Target Time</span>
                   <span className="text-sm font-bold text-primary">{priorityConfig.sla}</span>
                 </div>
                 <div className="w-full bg-muted rounded-full h-2">
                   <div className="bg-green-500 h-2 rounded-full" style={{ width: "30%" }}></div>
                 </div>
                 <p className="text-xs text-muted-foreground mt-2 text-right">Well within limits</p>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
               <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                 <MessageSquare className="h-4 w-4 mr-2" /> Add Note
               </Button>
               <Button variant="outline" className="w-full border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300">
                 <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Resolved
               </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
