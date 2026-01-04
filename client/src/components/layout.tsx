import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logout, getAuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { NotificationDropdown, MobileNotificationBell } from "@/components/ui/notification-dropdown";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

interface LayoutProps {
  children: React.ReactNode;
  userRole?: string;
}

export function Layout({ children, userRole = "Manager" }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();
  const authUser = getAuthUser();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/create-task", label: "New Task", icon: PlusCircle },
    { href: "/tasks", label: "All Tasks", icon: ClipboardList },
    { href: "/admin", label: "Admin", icon: Settings, hide: userRole === "Basic Staff" || userRole === "Personnel" },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <button 
        onClick={() => {
          setLocation("/");
          setIsMobileMenuOpen(false);
        }}
        className="p-6 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-serif font-bold text-xl">H</span>
          </div>
          <div className="text-left">
            <h1 className="font-serif font-bold text-lg tracking-tight text-primary">Hôtel TaskFlow</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Maintenance</p>
          </div>
        </div>
      </button>

      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.filter(item => !item.hide).map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 font-medium mb-1 h-11 transition-colors",
                  isActive 
                    ? "bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50 mt-auto">
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-muted/50">
          <Avatar className="h-9 w-9 border border-border shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground">{authUser?.avatar || "JD"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden min-w-0">
            <p className="text-sm font-medium truncate">{authUser?.name || "Jean Dupont"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {authUser?.provider === "google" ? "Google" : authUser?.provider === "microsoft" ? "Microsoft" : "Email"}
              {authUser?.role && <span className="ml-1 text-primary font-semibold">• {authUser.role.toUpperCase()}</span>}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <Link href="/settings">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="button-settings"
            >
              <UserCog className="h-4 w-4 shrink-0" />
              <span className="truncate">Account Settings</span>
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => {
              logout();
              toast({
                title: "Logged Out",
                description: "You have been successfully logged out.",
              });
              setLocation("/");
              window.location.reload();
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate">Log Out</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r border-border bg-sidebar shadow-sm fixed inset-y-0 z-20">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-between gap-2">
          <button 
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0"
          >
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-serif font-bold text-lg">H</span>
            </div>
            <span className="font-serif font-bold text-lg text-primary truncate">TaskFlow</span>
          </button>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <MobileNotificationBell />
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 sm:w-72">
                <NavContent />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Desktop Header (Actions only) */}
        <header className="hidden md:flex h-16 border-b border-border bg-background/50 backdrop-blur sticky top-0 z-30 px-6 lg:px-8 items-center justify-between gap-4">
          <h2 className="font-serif font-semibold text-lg lg:text-xl text-primary truncate">
            {navItems.find(i => i.href === location)?.label || "Dashboard"}
          </h2>
          <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
            <NotificationDropdown />
            <Button 
              size="sm" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1 lg:gap-2"
              onClick={() => setLocation("/create-task")}
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden lg:inline">New Task</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 p-3 sm:p-6 md:p-8 w-full animate-in fade-in duration-500 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
      
      <PWAInstallPrompt />
    </div>
  );
}
