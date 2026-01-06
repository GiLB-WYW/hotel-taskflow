import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getAuthUser } from "@/lib/auth";
import { format, startOfDay, isSameDay } from "date-fns";
import { Plus, FileText, Calendar, Edit2, Trash2, Save, X, Loader2 } from "lucide-react";
import type { ActivityLog } from "@shared/schema";

export default function ActivityLogPage() {
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authUser = getAuthUser();

  const { data: entries = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-log"],
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/activity-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          authorId: authUser?.id,
          authorName: authUser?.name || "Unknown",
          entryDate: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error("Failed to create entry");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log"] });
      setNewContent("");
      setIsAddingEntry(false);
      toast({ title: "Entry Added", description: "Your update has been posted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add entry.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await fetch(`/api/activity-log/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to update entry");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log"] });
      setEditingId(null);
      setEditContent("");
      toast({ title: "Entry Updated", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update entry.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/activity-log/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete entry");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-log"] });
      toast({ title: "Entry Deleted", description: "The entry has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete entry.", variant: "destructive" });
    },
  });

  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    const dateKey = format(new Date(entry.entryDate), "yyyy-MM-dd");
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  const handleSubmit = () => {
    if (!newContent.trim()) return;
    createMutation.mutate(newContent.trim());
  };

  const handleUpdate = (id: string) => {
    if (!editContent.trim()) return;
    updateMutation.mutate({ id, content: editContent.trim() });
  };

  const startEditing = (entry: ActivityLog) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isToday = (dateStr: string) => {
    return isSameDay(new Date(dateStr), new Date());
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-page-title">
                Team Activity Log
              </h1>
              <p className="text-sm text-muted-foreground">
                Daily updates from the team
              </p>
            </div>
          </div>
          {!isAddingEntry && (
            <Button
              onClick={() => setIsAddingEntry(true)}
              className="gap-2"
              data-testid="button-add-entry"
            >
              <Plus className="h-4 w-4" />
              Add Update
            </Button>
          )}
        </div>

        {/* Add New Entry Form */}
        {isAddingEntry && (
          <Card className="mb-6 border-primary/20 shadow-lg" data-testid="card-new-entry">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Today's Update - {format(new Date(), "MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="What are you working on today? Share updates, progress, or notes for the team..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="input-entry-content"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingEntry(false);
                    setNewContent("");
                  }}
                  data-testid="button-cancel-entry"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!newContent.trim() || createMutation.isPending}
                  data-testid="button-submit-entry"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Post Update
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          /* Empty State */
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No entries yet</h3>
              <p className="text-muted-foreground mb-4">
                Start documenting your team's daily activities and progress.
              </p>
              <Button onClick={() => setIsAddingEntry(true)} data-testid="button-first-entry">
                <Plus className="h-4 w-4 mr-2" />
                Add First Entry
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Entries List - Document Style */
          <div className="space-y-6">
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="relative">
                {/* Date Header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isToday(dateKey)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {format(new Date(dateKey), "d")}
                    </div>
                    <div>
                      <h2 className="font-semibold">
                        {isToday(dateKey) ? "Today" : format(new Date(dateKey), "EEEE")}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(dateKey), "MMMM d, yyyy")}
                      </p>
                    </div>
                    {isToday(dateKey) && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Entries for this date */}
                <div className="space-y-3 pl-4 border-l-2 border-border ml-4">
                  {groupedEntries[dateKey].map((entry) => (
                    <Card
                      key={entry.id}
                      className="relative ml-4"
                      data-testid={`card-entry-${entry.id}`}
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-[26px] top-4 h-3 w-3 rounded-full bg-primary/20 border-2 border-primary" />

                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(entry.authorName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{entry.authorName}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(entry.createdAt), "h:mm a")}
                              </span>
                            </div>

                            {editingId === entry.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  rows={3}
                                  className="resize-none"
                                  data-testid="input-edit-content"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdate(entry.id)}
                                    disabled={updateMutation.isPending}
                                    data-testid="button-save-edit"
                                  >
                                    {updateMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditContent("");
                                    }}
                                    data-testid="button-cancel-edit"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                                {entry.content}
                              </p>
                            )}
                          </div>

                          {/* Actions - only show for own entries or admin */}
                          {(entry.authorId === authUser?.id ||
                            authUser?.role === "Admin") &&
                            editingId !== entry.id && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={() => startEditing(entry)}
                                  data-testid={`button-edit-${entry.id}`}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteMutation.mutate(entry.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-delete-${entry.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
