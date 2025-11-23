import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LOCATIONS, USERS } from "@/lib/mockData";
import { Plus, Trash2, Edit, Search, UserPlus, MapPin } from "lucide-react";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("locations");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLocations = LOCATIONS.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = USERS.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <TabsList className="grid w-full md:w-[400px] grid-cols-2">
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="users">Users & Roles</TabsTrigger>
          </TabsList>

          <div className="mt-4 flex items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Search ${activeTab}...`} 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Add {activeTab === 'locations' ? 'Location' : 'User'}
            </Button>
          </div>

          <TabsContent value="locations" className="mt-4 animate-in fade-in duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Hotel Locations</CardTitle>
                <CardDescription>
                  Manage all trackable areas in the hotel structure.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                        <TableCell className="font-medium">{location.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground">
                            {location.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{location.id}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
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
                            {user.avatar}
                          </div>
                          {user.name}
                        </TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>{user.group || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
