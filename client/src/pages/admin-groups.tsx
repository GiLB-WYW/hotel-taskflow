import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit } from "lucide-react";

interface MaintenanceGroup {
  id: string;
  name: string;
  members: number;
}

export default function AdminGroups() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MaintenanceGroup | null>(null);
  const [formData, setFormData] = useState({ name: "", members: 0 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery<MaintenanceGroup[]>({
    queryKey: ["/api/maintenance-groups"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; members: number }) => {
      const response = await fetch("/api/maintenance-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create group");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-groups"] });
      toast({ title: "Group Created", description: "New maintenance group has been added." });
      setIsAddDialogOpen(false);
      setFormData({ name: "", members: 0 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create group.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaintenanceGroup> }) => {
      const response = await fetch(`/api/maintenance-groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update group");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-groups"] });
      toast({ title: "Group Updated", description: "Maintenance group has been updated." });
      setIsEditDialogOpen(false);
      setEditingGroup(null);
      setFormData({ name: "", members: 0 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update group.", variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!formData.name || formData.members < 0) {
      toast({ title: "Validation Error", description: "Please provide valid group name and member count.", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = () => {
    if (!editingGroup || !formData.name || formData.members < 0) {
      toast({ title: "Validation Error", description: "Please provide valid group name and member count.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingGroup.id, data: formData });
  };

  const openEditDialog = (group: MaintenanceGroup) => {
    setEditingGroup(group);
    setFormData({ name: group.name, members: group.members });
    setIsEditDialogOpen(true);
  };

  const openAddDialog = () => {
    setFormData({ name: "", members: 0 });
    setIsAddDialogOpen(true);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Manage Maintenance Groups</h1>
          <Button onClick={openAddDialog} data-testid="button-add-group">
            <Plus className="h-4 w-4 mr-2" /> Add Group
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Maintenance Groups</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading groups...</p>
            ) : groups.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No groups found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 font-semibold">Members</th>
                      <th className="text-left py-3 px-4 font-semibold">ID</th>
                      <th className="text-right py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.id} className="border-b hover:bg-muted/50" data-testid={`row-group-${group.id}`}>
                        <td className="py-3 px-4 font-medium">{group.name}</td>
                        <td className="py-3 px-4">{group.members}</td>
                        <td className="py-3 px-4 font-mono text-sm text-muted-foreground">{group.id}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(group)}
                            data-testid={`button-edit-group-${group.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Group Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent data-testid="dialog-add-group">
          <DialogHeader>
            <DialogTitle>Add New Maintenance Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Group Name</Label>
              <Input
                id="add-name"
                data-testid="input-add-group-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Plomberie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-members">Number of Members</Label>
              <Input
                id="add-members"
                type="number"
                data-testid="input-add-group-members"
                value={formData.members}
                onChange={(e) => setFormData({ ...formData, members: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid="button-submit-add-group">
              {createMutation.isPending ? "Adding..." : "Add Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-group">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Group Name</Label>
              <Input
                id="edit-name"
                data-testid="input-edit-group-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-members">Number of Members</Label>
              <Input
                id="edit-members"
                type="number"
                data-testid="input-edit-group-members"
                value={formData.members}
                onChange={(e) => setFormData({ ...formData, members: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending} data-testid="button-submit-edit-group">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
