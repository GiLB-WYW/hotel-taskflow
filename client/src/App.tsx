import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getAuthUser } from "./lib/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CreateTask from "@/pages/create-task";
import Admin from "@/pages/admin";
import AdminLocations from "@/pages/admin-locations";
import AdminGroups from "@/pages/admin-groups";
import TaskDetail from "@/pages/task-detail";
import LocationDetail from "@/pages/location-detail";
import ResetPassword from "@/pages/reset-password";
import AcceptInvite from "@/pages/accept-invite";
import Settings from "@/pages/settings";
import ActivityLog from "@/pages/activity-log";
import ShoppingList from "@/pages/shopping-list";
import SmtrPage from "@/pages/smtr";

function Router({ isAuthenticated }: { isAuthenticated: boolean }) {
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/accept-invite" component={AcceptInvite} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/create-task" component={CreateTask} />
      <Route path="/tasks" component={Dashboard} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/locations" component={AdminLocations} />
      <Route path="/admin/groups" component={AdminGroups} />
      <Route path="/task/:id" component={TaskDetail} />
      <Route path="/location/:id" component={LocationDetail} />
      <Route path="/settings" component={Settings} />
      <Route path="/activity-log" component={ActivityLog} />
      <Route path="/shopping-list" component={ShoppingList} />
      <Route path="/smtr" component={SmtrPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const user = getAuthUser();
    
    // Quick check for obviously fake OAuth sessions
    if (user && user.id) {
      const isClearlyFakeSession = 
        // Generic placeholder names from old fake OAuth
        user.name === "Google User" ||
        user.name === "Microsoft User" ||
        // IDs like "google_abc123" without UUID format
        (user.id.startsWith("google_") && !user.id.includes("-")) ||
        (user.id.startsWith("microsoft_") && !user.id.includes("-"));
      
      if (isClearlyFakeSession) {
        console.log("Clearing fake OAuth session:", user.id, user.name);
        localStorage.removeItem("user");
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      // Validate session against database using secure endpoint
      // Requires both userId AND email to match - prevents ID spoofing
      fetch("/api/auth/validate-session", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
        credentials: "include",
        cache: "no-store"
      })
        .then(res => res.json())
        .then(data => {
          if (!data.valid) {
            console.log("Session invalid:", data.error);
            localStorage.removeItem("user");
            setIsAuthenticated(false);
          } else {
            // Update local storage with fresh user data from database
            localStorage.setItem("user", JSON.stringify({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              role: data.user.role,
              group: data.user.group,
              groups: data.user.groups,
              provider: data.user.authProvider || user.provider || "email",
              avatar: data.user.avatar || data.user.email[0].toUpperCase(),
            }));
            setIsAuthenticated(true);
          }
          setIsLoading(false);
        })
        .catch(() => {
          // Network error - force re-login for security (no offline trust)
          console.log("Session validation failed - network error");
          localStorage.removeItem("user");
          setIsAuthenticated(false);
          setIsLoading(false);
        });
      return;
    }
    
    setIsAuthenticated(!!user);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-serif font-bold text-xl">H</span>
          </div>
          <p className="text-white text-sm">Loading TaskFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router isAuthenticated={isAuthenticated} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
