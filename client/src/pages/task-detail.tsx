import { useLocation, useRoute } from "wouter";
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LOCATIONS, USERS, PRIORITIES, Task, MAINTENANCE_GROUPS } from "@/lib/mockData";
import { ArrowLeft, Calendar, MapPin, User, Download, MessageSquare, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function TaskDetail() {
  const [, params] = useRoute("/task/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  // Fetch task from API
  const { data: task, isLoading } = useQuery<Task>({
    queryKey: [`/api/tasks/${params?.id}`],
    enabled: !!params?.id,
  });
  
  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Loading task...</p>
        </div>
      </Layout>
    );
  }
  
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
  const assignedGroupName = MAINTENANCE_GROUPS.find(g => g.id === task.assignedGroup)?.name || task.assignedGroup || "General";

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      // Create a new canvas from the page content
      const pdfContainer = document.getElementById("pdf-content");
      if (!pdfContainer) {
        toast({
          title: "Error",
          description: "Could not find content to export.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 10, position + 10, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position + 10, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }

      pdf.save(`Fiche_Technique_${task.id}.pdf`);

      toast({
        title: "PDF Downloaded",
        description: `Fiche technique for "${task.title}" has been downloaded.`,
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Hidden content for PDF export */}
        <div id="pdf-content" className="hidden">
          <div className="bg-white p-12">
            {/* PDF Header */}
            <div className="mb-8 border-b-2 border-gray-300 pb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">{task.title}</h1>
                  <p className="text-sm text-gray-600">Fiche Technique</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">Hôtel TaskFlow</p>
                  <p className="text-xs text-gray-600">{format(new Date(), "PPP")}</p>
                </div>
              </div>

              {/* Priority and Status Badges */}
              <div className="flex gap-4">
                <div className="inline-block">
                  <span className="font-semibold text-xs text-gray-600 uppercase">Priority:</span>
                  <p className={cn("font-bold text-lg mt-1", priorityConfig.color)}>
                    {task.priority}
                  </p>
                </div>
                <div className="inline-block">
                  <span className="font-semibold text-xs text-gray-600 uppercase">Status:</span>
                  <p className="font-bold text-lg mt-1 text-gray-900">{task.status}</p>
                </div>
              </div>
            </div>

            {/* Task Details Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Task Information</h2>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Location</p>
                  <p className="text-lg font-semibold text-gray-900">{location?.name}</p>
                  <p className="text-sm text-gray-600">{location?.category}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Created</p>
                  <p className="text-lg font-semibold text-gray-900">{format(new Date(task.createdAt), "PPP")}</p>
                  <p className="text-sm text-gray-600">{format(new Date(task.createdAt), "p")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Assigned Group</p>
                  <p className="text-lg font-semibold text-gray-900">{assignedGroupName}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Created By</p>
                  <p className="text-lg font-semibold text-gray-900">{creator?.name || "Unknown"}</p>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
              <p className="text-gray-800 leading-relaxed mb-4">{task.description}</p>
              
              {task.imageUrl && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Evidence Photo</p>
                  <img src={task.imageUrl} alt="Task Evidence" className="w-full max-h-96 object-cover rounded border border-gray-300" />
                </div>
              )}
            </div>

            {/* Original Transcript Section */}
            {task.originalTranscript && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Original Transcript</h2>
                <p className="text-gray-700 italic bg-gray-100 p-4 rounded border-l-4 border-blue-500">
                  "{task.originalTranscript}"
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t-2 border-gray-300 pt-6 mt-12 text-center text-xs text-gray-600">
              <p>Document ID: {task.id} | Generated on {format(new Date(), "PPP 'at' p")}</p>
              <p className="mt-2">Hôtel TaskFlow Management System</p>
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="pl-0 hover:bg-transparent hover:text-primary h-9"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Back to Dashboard</span>
          <span className="sm:hidden">Back</span>
        </Button>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className={cn("text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1", priorityConfig.color)}>
                {task.priority}
              </Badge>
              <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
                {task.status}
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-primary leading-tight break-words">
              {task.title}
            </h1>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 text-muted-foreground text-xs sm:text-sm">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{location?.name} ({location?.category})</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{format(new Date(task.createdAt), "PPP 'at' p")}</span>
              </span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="gap-2 flex-shrink-0 text-xs sm:text-sm h-9 sm:h-10"
            onClick={exportPDF}
            disabled={isExporting}
          >
            <Download className={cn("h-3.5 sm:h-4 w-3.5 sm:w-4", isExporting && "animate-bounce")} />
            <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export Fiche"}</span>
            <span className="sm:hidden">{isExporting ? "..." : "Export"}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="sm:col-span-2 space-y-4 sm:space-y-6">
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
                     <Button 
                       variant="outline" 
                       className="w-full border-dashed text-muted-foreground"
                       onClick={() => toast({
                         title: "Assign Person",
                         description: "Select a team member to assign this task.",
                       })}
                     >
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
               <Button 
                 className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                 onClick={() => toast({
                   title: "Add Note",
                   description: "Note feature coming soon. You can add internal notes to this task.",
                 })}
               >
                 <MessageSquare className="h-4 w-4 mr-2" /> Add Note
               </Button>
               <Button 
                 variant="outline" 
                 className="w-full border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                 onClick={() => toast({
                   title: "Task Marked Resolved",
                   description: "Task status has been updated to Resolved.",
                 })}
               >
                 <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Resolved
               </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
