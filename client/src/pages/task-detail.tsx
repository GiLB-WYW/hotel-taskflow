import { useLocation, useRoute } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRIORITIES, Task, type Priority } from "@/lib/mockData";
import { ArrowLeft, Calendar, MapPin, User, Download, MessageSquare, CheckCircle2, Search, Trash2, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { AddNoteDialog } from "@/components/add-note-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Note {
  id: string;
  taskId: string;
  content: string;
  createdBy: string;
  createdAt: string;
  recipients: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Location {
  id: string;
  name: string;
  code: string;
  category: string;
}

interface MaintenanceGroup {
  id: string;
  name: string;
}

export default function TaskDetail() {
  const [, params] = useRoute("/task/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isAssignUserDialogOpen, setIsAssignUserDialogOpen] = useState(false);
  const [isChangeLocationDialogOpen, setIsChangeLocationDialogOpen] = useState(false);
  const [isChangeGroupDialogOpen, setIsChangeGroupDialogOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false);
  const [editTaskForm, setEditTaskForm] = useState({
    title: "",
    description: "",
    priority: "",
    locationId: "",
  });
  const queryClient = useQueryClient();
  
  // Touch swipe state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minSwipeDistance = 50;
  
  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  
  // Fetch task from API
  const { data: task, isLoading } = useQuery<Task>({
    queryKey: [`/api/tasks/${params?.id}`],
    enabled: !!params?.id,
  });

  // Fetch notes for this task
  const { data: notes = [], refetch: refetchNotes } = useQuery<Note[]>({
    queryKey: [`/api/tasks/${params?.id}/notes`],
    enabled: !!params?.id,
  });

  // Fetch users, locations, and groups from API
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: maintenanceGroups = [] } = useQuery<MaintenanceGroup[]>({
    queryKey: ["/api/maintenance-groups"],
  });

  // Fetch all tasks for navigation
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  // Sort tasks by priority then by date (same as dashboard)
  const sortedTasks = [...allTasks].sort((a, b) => {
    const priorityOrder: Record<string, number> = { "Red Flag": 0, "High": 1, "Normal": 2, "Low": 3 };
    const priorityDiff = (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Find current task index and adjacent tasks
  const currentIndex = sortedTasks.findIndex(t => t.id === params?.id);
  const prevTask = currentIndex > 0 ? sortedTasks[currentIndex - 1] : null;
  const nextTask = currentIndex < sortedTasks.length - 1 ? sortedTasks[currentIndex + 1] : null;

  // Navigation functions
  const goToPrevTask = useCallback(() => {
    if (prevTask) {
      setLocation(`/task/${prevTask.id}`);
    }
  }, [prevTask, setLocation]);

  const goToNextTask = useCallback(() => {
    if (nextTask) {
      setLocation(`/task/${nextTask.id}`);
    }
  }, [nextTask, setLocation]);

  // Touch event handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && nextTask) {
      goToNextTask();
    } else if (isRightSwipe && prevTask) {
      goToPrevTask();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevTask) {
        goToPrevTask();
      } else if (e.key === "ArrowRight" && nextTask) {
        goToNextTask();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevTask, nextTask, goToPrevTask, goToNextTask]);

  // Mutation to update task
  const updateTaskMutation = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      const response = await fetch(`/api/tasks/${params?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  // Mutation to mark task as resolved
  const markResolvedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tasks/${params?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved" }),
      });
      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task Marked Resolved",
        description: "Task status has been updated to Resolved.",
      });
      setTimeout(() => setLocation("/"), 1000);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not update task status.",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete task (Admin only)
  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tasks/${params?.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task Deleted",
        description: "The task has been permanently deleted.",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Could not delete the task.",
        variant: "destructive",
      });
    },
  });

  // Check if user can edit assignments (Admin or Manager) - case insensitive
  const userRole = currentUser.role?.toLowerCase() || "";
  const canEditAssignments = userRole === "admin" || userRole === "manager";
  const isAdmin = userRole === "admin";

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Handler functions
  const handleAssignUser = async (userId: string) => {
    try {
      await updateTaskMutation.mutateAsync({ assignedTo: userId });
      setIsAssignUserDialogOpen(false);
      setUserSearchQuery("");
      toast({ title: "Success", description: "User assigned to task." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign user.", variant: "destructive" });
    }
  };

  const handleChangeLocation = async (locationId: string) => {
    try {
      await updateTaskMutation.mutateAsync({ locationId });
      setIsChangeLocationDialogOpen(false);
      toast({ title: "Success", description: "Location updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update location.", variant: "destructive" });
    }
  };

  const handleChangeGroup = async (groupId: string) => {
    try {
      await updateTaskMutation.mutateAsync({ assignedGroup: groupId });
      setIsChangeGroupDialogOpen(false);
      toast({ title: "Success", description: "Assigned group updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update assigned group.", variant: "destructive" });
    }
  };

  const handleOpenEditDialog = () => {
    if (task) {
      setEditTaskForm({
        title: task.title,
        description: task.description,
        priority: task.priority,
        locationId: task.locationId,
      });
      setIsEditTaskDialogOpen(true);
    }
  };

  const handleSaveTaskEdit = async () => {
    try {
      await updateTaskMutation.mutateAsync({
        title: editTaskForm.title,
        description: editTaskForm.description,
        priority: editTaskForm.priority as Priority,
        locationId: editTaskForm.locationId,
      });
      setIsEditTaskDialogOpen(false);
      toast({ title: "Success", description: "Task updated successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    }
  };
  
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

  const location = locations.find(l => l.id === task.locationId);
  const creator = users.find(u => u.id === task.createdBy);
  const assignee = users.find(u => u.id === task.assignedTo);
  const priorityConfig = PRIORITIES[task.priority];
  const assignedGroup = maintenanceGroups.find(g => g.id === task.assignedGroup || g.name === task.assignedGroup);
  const assignedGroupName = assignedGroup?.name || task.assignedGroup || "General";

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      // Create a new canvas from the page content
      const pdfContainer = document.getElementById("pdf-content");
      if (!pdfContainer) {
        console.error("PDF container not found");
        toast({
          title: "Error",
          description: "Could not find content to export.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      console.log("Starting PDF export...");
      
      // Temporarily make visible for html2canvas
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.display = 'block';

      console.log("Generating canvas...");
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      console.log("Canvas generated, size:", canvas.width, "x", canvas.height);

      // Hide again
      pdfContainer.style.display = 'none';

      console.log("Converting to image data...");
      const imgData = canvas.toDataURL("image/png");
      
      if (!imgData || imgData === "data:,") {
        throw new Error("Failed to generate image data from canvas");
      }

      console.log("Creating PDF...");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      console.log("Adding image to PDF...");
      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

      console.log("Saving PDF...");
      pdf.save(`Fiche_Technique_${task.id}.pdf`);

      toast({
        title: "PDF Downloaded",
        description: `Fiche technique for "${task.title}" has been downloaded.`,
      });
      console.log("PDF export completed successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Layout>
      <div 
        ref={containerRef}
        className="max-w-4xl mx-auto space-y-4 sm:space-y-6 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Task Navigation Arrows - Fixed on sides */}
        {sortedTasks.length > 1 && (
          <>
            {/* Previous Task Arrow */}
            <button
              onClick={goToPrevTask}
              disabled={!prevTask}
              className={cn(
                "fixed left-2 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg flex items-center justify-center transition-all",
                prevTask 
                  ? "hover:bg-primary hover:text-primary-foreground hover:scale-110 cursor-pointer" 
                  : "opacity-30 cursor-not-allowed"
              )}
              data-testid="button-prev-task"
              aria-label="Previous Task"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            
            {/* Next Task Arrow */}
            <button
              onClick={goToNextTask}
              disabled={!nextTask}
              className={cn(
                "fixed right-2 top-1/2 -translate-y-1/2 z-40 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg flex items-center justify-center transition-all",
                nextTask 
                  ? "hover:bg-primary hover:text-primary-foreground hover:scale-110 cursor-pointer" 
                  : "opacity-30 cursor-not-allowed"
              )}
              data-testid="button-next-task"
              aria-label="Next Task"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Task Counter */}
        {sortedTasks.length > 1 && currentIndex >= 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-background/80 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{currentIndex + 1}</span>
            <span> of </span>
            <span className="font-semibold text-foreground">{sortedTasks.length}</span>
            <span className="ml-2 text-xs hidden sm:inline">← Swipe or use arrow keys →</span>
          </div>
        )}

        {/* Hidden content for PDF export */}
        <div id="pdf-content" style={{ display: 'none' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '48px' }}>
            {/* PDF Header */}
            <div style={{ marginBottom: '32px', borderBottom: '2px solid #d1d5db', paddingBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '36px', fontFamily: 'serif', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>{task.title}</h1>
                  <p style={{ fontSize: '14px', color: '#4b5563' }}>Fiche Technique</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Hôtel TaskFlow</p>
                  <p style={{ fontSize: '12px', color: '#4b5563' }}>{format(new Date(), "PPP")}</p>
                </div>
              </div>

              {/* Priority and Status Badges */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'inline-block' }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase' }}>Priority:</span>
                  <p style={{ 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    marginTop: '4px',
                    color: task.priority === 'Red Flag' ? '#dc2626' : 
                           task.priority === 'High' ? '#ea580c' : 
                           task.priority === 'Normal' ? '#2563eb' : '#16a34a'
                  }}>
                    {task.priority}
                  </p>
                </div>
                <div style={{ display: 'inline-block' }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: '#4b5563', textTransform: 'uppercase' }}>Status:</span>
                  <p style={{ fontWeight: 'bold', fontSize: '18px', marginTop: '4px', color: '#111827' }}>{task.status}</p>
                </div>
              </div>
            </div>

            {/* Task Details Section */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>Task Information</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Location</p>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>{location?.name}</p>
                  <p style={{ fontSize: '14px', color: '#4b5563' }}>{location?.category}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Created</p>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>{format(new Date(task.createdAt), "PPP")}</p>
                  <p style={{ fontSize: '14px', color: '#4b5563' }}>{format(new Date(task.createdAt), "p")}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Assigned Group</p>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>{assignedGroupName}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Created By</p>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>{creator?.name || "Unknown"}</p>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>Description</h2>
              <p style={{ color: '#1f2937', lineHeight: '1.625', marginBottom: '16px' }}>{task.description}</p>
              
              {task.imageUrl && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Evidence Photo</p>
                  <img src={task.imageUrl} alt="Task Evidence" style={{ width: '300px', height: '300px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                </div>
              )}
            </div>

            {/* Original Transcript Section */}
            {task.originalTranscript && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>Original Transcript</h2>
                <p style={{ color: '#374151', fontStyle: 'italic', backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '4px', borderLeft: '4px solid #3b82f6' }}>
                  "{task.originalTranscript}"
                </p>
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop: '2px solid #d1d5db', paddingTop: '24px', marginTop: '48px', textAlign: 'center', fontSize: '12px', color: '#4b5563' }}>
              <p>Document ID: {task.id} | Generated on {format(new Date(), "PPP 'at' p")}</p>
              <p style={{ marginTop: '8px' }}>Hôtel TaskFlow Management System</p>
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

            {/* Notes Section - moved from sidebar */}
            {notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {notes.map((note) => {
                      const noteAuthor = users.find(u => u.id === note.createdBy);
                      const initials = noteAuthor?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || "?";
                      return (
                        <div key={note.id} className="border-l-2 border-primary/30 pl-4 py-2" data-testid={`note-${note.id}`}>
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-sm font-semibold">{noteAuthor?.name || "Unknown"}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(note.createdAt), "PPp")}
                                </span>
                              </div>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                              {note.recipients.length > 0 && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                  <span>Notified:</span>
                                  {note.recipients.map(recipientId => {
                                    const recipient = users.find(u => u.id === recipientId);
                                    return recipient ? (
                                      <Badge key={recipientId} variant="outline" className="text-xs">
                                        {recipient.name}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Assigned Group</p>
                  <Button
                    variant="secondary"
                    className="text-sm w-full justify-center py-2 cursor-pointer hover:bg-secondary/80"
                    onClick={() => setIsChangeGroupDialogOpen(true)}
                    data-testid="button-change-group"
                  >
                    {assignedGroupName}
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Assigned To</p>
                  {assignee ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start p-2 hover:bg-muted cursor-pointer"
                      onClick={() => setIsAssignUserDialogOpen(true)}
                      data-testid="button-change-assignee"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {assignee.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                        </div>
                        <span className="text-sm font-medium">{assignee.name}</span>
                      </div>
                    </Button>
                  ) : (
                     <Button 
                       variant="outline" 
                       className="w-full border-dashed text-muted-foreground cursor-pointer"
                       onClick={() => setIsAssignUserDialogOpen(true)}
                       data-testid="button-assign-person"
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
                 onClick={() => setIsNoteDialogOpen(true)}
                 data-testid="button-add-note"
               >
                 <MessageSquare className="h-4 w-4 mr-2" /> Add Note
               </Button>
               <Button 
                 variant="outline" 
                 className="w-full"
                 onClick={handleOpenEditDialog}
                 data-testid="button-edit-task"
               >
                 <Pencil className="h-4 w-4 mr-2" /> Edit Task
               </Button>
               <Button 
                 variant="outline" 
                 className="w-full border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                 onClick={() => markResolvedMutation.mutate()}
                 disabled={markResolvedMutation.isPending || task.status === "Resolved"}
                 data-testid="button-mark-resolved"
               >
                 <CheckCircle2 className="h-4 w-4 mr-2" /> 
                 {markResolvedMutation.isPending ? "Updating..." : task.status === "Resolved" ? "Already Resolved" : "Mark Resolved"}
               </Button>
               <Button 
                 variant="destructive" 
                 className="w-full"
                 onClick={() => setIsDeleteDialogOpen(true)}
                 data-testid="button-delete-task"
               >
                 <Trash2 className="h-4 w-4 mr-2" /> Delete Task
               </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Note Dialog */}
      <AddNoteDialog
        open={isNoteDialogOpen}
        onOpenChange={setIsNoteDialogOpen}
        taskId={task.id}
        currentUserId={currentUser.id}
        availableUsers={users}
        onNoteAdded={() => refetchNotes()}
      />

      {/* Assign User Dialog */}
      <Dialog open={isAssignUserDialogOpen} onOpenChange={setIsAssignUserDialogOpen}>
        <DialogContent data-testid="dialog-assign-user">
          <DialogHeader>
            <DialogTitle>Assign Person to Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-user"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              ) : (
                filteredUsers.map((user) => (
                  <Button
                    key={user.id}
                    variant="ghost"
                    className="w-full justify-start hover:bg-muted"
                    onClick={() => handleAssignUser(user.id)}
                    data-testid={`button-select-user-${user.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {user.name[0] || user.email[0]}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Location Dialog */}
      <Dialog open={isChangeLocationDialogOpen} onOpenChange={setIsChangeLocationDialogOpen}>
        <DialogContent data-testid="dialog-change-location">
          <DialogHeader>
            <DialogTitle>Change Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={handleChangeLocation}>
              <SelectTrigger data-testid="select-location">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id} data-testid={`option-location-${loc.id}`}>
                    {loc.name} ({loc.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Assigned Group Dialog */}
      <Dialog open={isChangeGroupDialogOpen} onOpenChange={setIsChangeGroupDialogOpen}>
        <DialogContent data-testid="dialog-change-group">
          <DialogHeader>
            <DialogTitle>Change Assigned Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select onValueChange={handleChangeGroup}>
              <SelectTrigger data-testid="select-group">
                <SelectValue placeholder="Select a maintenance group" />
              </SelectTrigger>
              <SelectContent>
                {maintenanceGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id} data-testid={`option-group-${group.id}`}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-edit-task">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTaskForm.title}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                placeholder="Enter task title"
                data-testid="input-edit-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editTaskForm.description}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                placeholder="Enter task description"
                rows={4}
                data-testid="input-edit-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Select 
                value={editTaskForm.priority} 
                onValueChange={(value) => setEditTaskForm({ ...editTaskForm, priority: value })}
              >
                <SelectTrigger data-testid="select-edit-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Red Flag">Red Flag</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Select 
                value={editTaskForm.locationId} 
                onValueChange={(value) => setEditTaskForm({ ...editTaskForm, locationId: value })}
              >
                <SelectTrigger data-testid="select-edit-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} ({loc.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTaskEdit}
              disabled={updateTaskMutation.isPending}
              data-testid="button-save-task-edit"
            >
              {updateTaskMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
              All notes and attachments will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteTaskMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-task"
            >
              {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
