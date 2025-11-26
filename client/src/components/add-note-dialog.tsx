import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { User } from "@/lib/mockData";
import { useToast } from "@/hooks/use-toast";

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  currentUserId: string;
  availableUsers: User[];
  onNoteAdded: () => void;
}

export function AddNoteDialog({
  open,
  onOpenChange,
  taskId,
  currentUserId,
  availableUsers,
  onNoteAdded,
}: AddNoteDialogProps) {
  const [content, setContent] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "Content Required",
        description: "Please enter a note before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/tasks/${taskId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          createdBy: currentUserId,
          recipients: selectedRecipients,
        }),
      });

      if (!response.ok) throw new Error("Failed to add note");

      toast({
        title: "Note Added",
        description: "Your note has been added to the task.",
      });

      setContent("");
      setSelectedRecipients([]);
      onOpenChange(false);
      onNoteAdded();
    } catch (error) {
      toast({
        title: "Failed to Add Note",
        description: "There was an error adding your note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-note">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-content">Note Content</Label>
            <Textarea
              id="note-content"
              data-testid="input-note-content"
              placeholder="Enter your note here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Notify Users (Optional)</Label>
            <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-2"
                  data-testid={`recipient-option-${user.id}`}
                >
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedRecipients.includes(user.id)}
                    onCheckedChange={() => toggleRecipient(user.id)}
                    data-testid={`checkbox-recipient-${user.id}`}
                  />
                  <label
                    htmlFor={`user-${user.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {user.name} ({user.role})
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            data-testid="button-cancel-note"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="button-submit-note"
          >
            {isSubmitting ? "Adding..." : "Add Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
