import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Users, ArrowLeft } from "lucide-react";

interface MaintenanceGroup {
  id: string;
  name: string;
  memberCount: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  group: string | null;
}

export default function AdminGroups() {
  const [, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MaintenanceGroup | null>(null);
  const [formData, setFormData] = useState({ name: "", members: 0 });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery<MaintenanceGroup[]>({
    queryKey: ["/api/maintenance-groups"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
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
      setSelectedUserIds([]);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update group.", variant: "destructive" });
    },
  });

  const updateUserGroupMutation = useMutation({
    mutationFn: async ({ userId, groupId }: { userId: string; groupId: string | null }) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: groupId }),
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
  });

  const handleAdd = () => {
    if (!formData.name || formData.members < 0) {
      toast({ title: "Validation Error", description: "Please provide valid group name and member count.", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = async () => {
    if (!editingGroup || !formData.name) {
      toast({ title: "Validation Error", description: "Please provide a valid group name.", variant: "destructive" });
      return;
    }

    try {
      // Update group name
      await updateMutation.mutateAsync({ id: editingGroup.id, data: { name: formData.name } });

      // Get users that were in this group before
      const previousGroupMembers = users.filter(u => u.group === editingGroup.id);
      const previousMemberIds = previousGroupMembers.map(u => u.id);

      // Users to add (in selectedUserIds but not in previous)
      const usersToAdd = selectedUserIds.filter(id => !previousMemberIds.includes(id));
      
      // Users to remove (in previous but not in selectedUserIds)
      const usersToRemove = previousMemberIds.filter(id => !selectedUserIds.includes(id));

      // Update user group assignments
      const updatePromises = [
        ...usersToAdd.map(userId => updateUserGroupMutation.mutateAsync({ userId, groupId: editingGroup.id })),
        ...usersToRemove.map(userId => updateUserGroupMutation.mutateAsync({ userId, groupId: null })),
      ];

      await Promise.all(updatePromises);

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-groups"] });
      
      toast({ title: "Success", description: "Group and members updated successfully." });
      setIsEditDialogOpen(false);
      setEditingGroup(null);
      setFormData({ name: "", members: 0 });
      setSelectedUserIds([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update group.", variant: "destructive" });
    }
  };

  const openEditDialog = (group: MaintenanceGroup) => {
    setEditingGroup(group);
    setFormData({ name: group.name, members: group.memberCount });
    
    // Pre-select users that belong to this group
    const groupMembers = users.filter(u => u.group === group.id).map(u => u.id);
    setSelectedUserIds(groupMembers);
    
    setIsEditDialogOpen(true);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const openAddDialog = () => {
    setFormData({ name: "", members: 0 });
    setIsAddDialogOpen(true);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/admin")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold flex-1">Manage Maintenance Groups</h1>
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
                    {groups.map((group) => {
                      const groupMemberCount = users.filter(u => u.group === group.id).length;
                      return (
                      <tr key={group.id} className="border-b hover:bg-muted/50" data-testid={`row-group-${group.id}`}>
                        <td className="py-3 px-4 font-medium">{group.name}</td>
                        <td className="py-3 px-4">{groupMemberCount}</td>
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
                    )})}
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
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assign Users to Group
              </Label>
              <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto space-y-2">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No users available</p>
                ) : (
                  users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded"
                      data-testid={`user-option-${user.id}`}
                    >
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                        data-testid={`checkbox-user-${user.id}`}
                      />
                      <label
                        htmlFor={`user-${user.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.role}</span>
                        </div>
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
              </p>
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
