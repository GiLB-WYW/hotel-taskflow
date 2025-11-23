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
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  userRole?: string;
}

export function Layout({ children, userRole = "Manager" }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/create-task", label: "New Task", icon: PlusCircle },
    { href: "/tasks", label: "All Tasks", icon: ClipboardList },
    { href: "/admin", label: "Admin", icon: Settings, hide: userRole === "Basic Staff" || userRole === "Personnel" },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-serif font-bold text-xl">H</span>
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg tracking-tight text-primary">Hôtel TaskFlow</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Maintenance</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-6 px-3 space-y-1">
        {navItems.filter(item => !item.hide).map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 font-medium mb-1 h-11",
                  isActive 
                    ? "bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-muted/50">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarFallback className="bg-primary text-primary-foreground">JD</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">Jean Dupont</p>
            <p className="text-xs text-muted-foreground truncate">{userRole}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />
          Log Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r border-border bg-sidebar shadow-sm fixed inset-y-0 z-20">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-serif font-bold text-lg">H</span>
            </div>
            <span className="font-serif font-bold text-lg text-primary">TaskFlow</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border border-background"></span>
            </Button>
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <NavContent />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Desktop Header (Actions only) */}
        <header className="hidden md:flex h-16 border-b border-border bg-background/50 backdrop-blur sticky top-0 z-30 px-8 items-center justify-between">
          <h2 className="font-serif font-semibold text-xl text-primary">
            {navItems.find(i => i.href === location)?.label || "Dashboard"}
          </h2>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="gap-2">
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
