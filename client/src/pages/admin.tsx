import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Search, Wrench, ExternalLink, FolderTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Location, User, MaintenanceGroup } from "@/lib/mockData";
import type { Category } from "@shared/schema";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("locations");
  const [searchQuery, setSearchQuery] = useState("");
  const [, setPageLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Form states
  const [newLocation, setNewLocation] = useState({ name: "", category: "" });
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "Basic Staff" as const });
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "", role: "", password: "" });
  const [editCategoryForm, setEditCategoryForm] = useState({ name: "", description: "" });

  // Fetch data from API
  const { data: locations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery<MaintenanceGroup[]>({
    queryKey: ["/api/maintenance-groups"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Mutations for creating items
  const createLocationMutation = useMutation({
    mutationFn: async (data: { name: string; category: string }) => {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsLocationDialogOpen(false);
      setNewLocation({ name: "", category: "" });
      toast({
        title: "Success",
        description: "Location created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create location",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string }) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsUserDialogOpen(false);
      setNewUser({ name: "", email: "", password: "", role: "Basic Staff" });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await fetch("/api/maintenance-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create group");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-groups"] });
      setIsGroupDialogOpen(false);
      setNewGroup({ name: "", description: "" });
      toast({
        title: "Success",
        description: "Maintenance group created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create maintenance group",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; email?: string; role?: string; password?: string } }) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      setEditUserForm({ name: "", email: "", role: "", password: "" });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserToDelete(null);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCategoryDialogOpen(false);
      setNewCategory({ name: "", description: "" });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsEditCategoryDialogOpen(false);
      setEditingCategory(null);
      setEditCategoryForm({ name: "", description: "" });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryToDelete(null);
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const filteredLocations = locations.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateLocation = () => {
    if (!newLocation.name || !newLocation.category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    createLocationMutation.mutate(newLocation);
  };

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleCreateGroup = () => {
    if (!newGroup.name || !newGroup.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    createGroupMutation.mutate(newGroup);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserForm({
      name: user.name,
      email: (user as any).email || "",
      role: user.role,
      password: "",
    });
    setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    
    const updates: any = {};
    if (editUserForm.name && editUserForm.name !== editingUser.name) updates.name = editUserForm.name;
    if (editUserForm.email && editUserForm.email !== (editingUser as any).email) updates.email = editUserForm.email;
    if (editUserForm.role && editUserForm.role !== editingUser.role) updates.role = editUserForm.role;
    if (editUserForm.password) updates.password = editUserForm.password;

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No Changes",
        description: "Please make some changes before saving",
      });
      return;
    }

    updateUserMutation.mutate({ id: editingUser.id, data: updates });
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleCreateCategory = () => {
    if (!newCategory.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a category name",
        variant: "destructive",
      });
      return;
    }
    createCategoryMutation.mutate(newCategory);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditCategoryForm({
      name: category.name,
      description: category.description || "",
    });
    setIsEditCategoryDialogOpen(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    
    const updates: any = {};
    if (editCategoryForm.name && editCategoryForm.name !== editingCategory.name) updates.name = editCategoryForm.name;
    if (editCategoryForm.description !== editingCategory.description) updates.description = editCategoryForm.description;

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No Changes",
        description: "Please make some changes before saving",
      });
      return;
    }

    updateCategoryMutation.mutate({ id: editingCategory.id, data: updates });
  };

  const handleDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete.id);
    }
  };

  return (
    <Layout userRole="Admin">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Administration</h1>
            <p className="text-muted-foreground">Manage hotel locations, users, and system settings.</p>
          </div>
        </div>

        <Tabs defaultValue="locations" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full md:w-[800px] grid-cols-4">
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="users">Users & Roles</TabsTrigger>
            <TabsTrigger value="groups">Maintenance Groups</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Search ${activeTab}...`} 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
            
            {activeTab === 'locations' && (
              <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground" data-testid="button-add-location">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Location</DialogTitle>
                    <DialogDescription>
                      Create a new trackable location in the hotel.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="location-name">Location Name</Label>
                      <Input
                        id="location-name"
                        placeholder="e.g., Suite A1"
                        value={newLocation.name}
                        onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                        data-testid="input-location-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location-category">Category</Label>
                      <Select 
                        value={newLocation.category} 
                        onValueChange={(value) => setNewLocation({ ...newLocation, category: value })}
                      >
                        <SelectTrigger id="location-category" data-testid="select-location-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateLocation} data-testid="button-submit-location">
                      Create Location
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {activeTab === 'users' && (
              <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground" data-testid="button-add-user">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Create a new user account with role and permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-name">Full Name</Label>
                      <Input
                        id="user-name"
                        placeholder="e.g., Jean Dupont"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        data-testid="input-user-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-email">Email</Label>
                      <Input
                        id="user-email"
                        type="email"
                        placeholder="jean@hotel.com"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        data-testid="input-user-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-password">Password</Label>
                      <Input
                        id="user-password"
                        type="password"
                        placeholder="Temporary password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        data-testid="input-user-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-role">Role</Label>
                      <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value as any })}>
                        <SelectTrigger id="user-role" data-testid="select-user-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Personnel">Personnel</SelectItem>
                          <SelectItem value="Basic Staff">Basic Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} data-testid="button-submit-user">
                      Create User
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {activeTab === 'categories' && (
              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground" data-testid="button-add-category">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Category</DialogTitle>
                    <DialogDescription>
                      Create a new category to organize locations.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="category-name">Category Name</Label>
                      <Input
                        id="category-name"
                        placeholder="e.g., Suites A"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        data-testid="input-category-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category-description">Description (optional)</Label>
                      <Input
                        id="category-description"
                        placeholder="e.g., First floor suites"
                        value={newCategory.description}
                        onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                        data-testid="input-category-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateCategory} data-testid="button-submit-category">
                      Create Category
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {activeTab === 'groups' && (
              <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground" data-testid="button-add-group">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Maintenance Group</DialogTitle>
                    <DialogDescription>
                      Create a new maintenance team specialization.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="group-name">Group Name</Label>
                      <Input
                        id="group-name"
                        placeholder="e.g., Plomberie"
                        value={newGroup.name}
                        onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                        data-testid="input-group-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="group-description">Description</Label>
                      <Input
                        id="group-description"
                        placeholder="e.g., Plumbing & Water Systems"
                        value={newGroup.description}
                        onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                        data-testid="input-group-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateGroup} data-testid="button-submit-group">
                      Create Group
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <TabsContent value="locations" className="mt-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Hotel Locations</CardTitle>
                  <CardDescription>
                    Manage all trackable areas in the hotel structure.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPageLocation("/admin/locations")}
                  className="gap-2"
                  data-testid="button-manage-locations"
                >
                  <Wrench className="h-4 w-4" />
                  Manage Locations
                </Button>
              </CardHeader>
              <CardContent>
                {locationsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLocations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell className="font-medium" data-testid={`text-location-${location.id}`}>{location.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground">
                              {location.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{location.id}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setPageLocation(`/location/${location.id}`)}
                                title="View location details"
                                data-testid={`button-view-location-${location.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="mt-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Location Categories</CardTitle>
                <CardDescription>
                  Manage categories to organize hotel locations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : filteredCategories.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No categories found. Create your first category to get started.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Locations</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.map((category) => {
                        const locationCount = locations.filter(l => l.category === category.name).length;
                        return (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium flex items-center gap-2">
                              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                                <FolderTree className="h-4 w-4 text-primary" />
                              </div>
                              <span data-testid={`text-category-${category.id}`}>{category.name}</span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{category.description || "-"}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground">
                                {locationCount} locations
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => handleEditCategory(category)}
                                  title="Edit category"
                                  data-testid={`button-edit-category-${category.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteCategory(category)}
                                  title="Delete category"
                                  data-testid={`button-delete-category-${category.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage staff access and roles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {user.avatar || user.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span data-testid={`text-user-${user.id}`}>{user.name}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{(user as any).email || "-"}</TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell>{user.group || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEditUser(user)}
                                title="Edit user"
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteUser(user)}
                                title="Delete user"
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="mt-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Maintenance Groups</CardTitle>
                  <CardDescription>
                    Manage maintenance teams and their specializations.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPageLocation("/admin/groups")}
                  className="gap-2"
                  data-testid="button-manage-groups"
                >
                  <Wrench className="h-4 w-4" />
                  Manage Groups
                </Button>
              </CardHeader>
              <CardContent>
                {groupsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Members</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGroups.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                              <Wrench className="h-4 w-4 text-primary" />
                            </div>
                            <span data-testid={`text-group-${group.id}`}>{group.name}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{group.description}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground">
                              {group.memberCount} members
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Full Name</Label>
                <Input
                  id="edit-user-name"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  data-testid="input-edit-user-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  data-testid="input-edit-user-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Role</Label>
                <Select value={editUserForm.role} onValueChange={(value) => setEditUserForm({ ...editUserForm, role: value })}>
                  <SelectTrigger id="edit-user-role" data-testid="select-edit-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Personnel">Personnel</SelectItem>
                    <SelectItem value="Basic Staff">Basic Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-password">New Password (optional)</Label>
                <Input
                  id="edit-user-password"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                  data-testid="input-edit-user-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} data-testid="button-submit-edit-user">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation */}
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {userToDelete?.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Category Dialog */}
        <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
              <DialogDescription>
                Update category information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category-name">Category Name</Label>
                <Input
                  id="edit-category-name"
                  value={editCategoryForm.name}
                  onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                  data-testid="input-edit-category-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category-description">Description</Label>
                <Input
                  id="edit-category-description"
                  value={editCategoryForm.description}
                  onChange={(e) => setEditCategoryForm({ ...editCategoryForm, description: e.target.value })}
                  data-testid="input-edit-category-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditCategoryDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateCategory} data-testid="button-submit-edit-category">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Category Confirmation */}
        <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{categoryToDelete?.name}"? 
                This will not delete locations in this category, but they will need to be reassigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteCategory}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-category"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
