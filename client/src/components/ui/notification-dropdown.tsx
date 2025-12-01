import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  taskId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationDropdown() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const authUser = getAuthUser();
  const userId = authUser?.id;

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(`/api/notifications/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const { data: unreadCountData } = useQuery<{ count: number }>({
    queryKey: ["notifications-count", userId],
    queryFn: async () => {
      if (!userId) return { count: 0 };
      const response = await fetch(`/api/notifications/${userId}/unread-count`);
      if (!response.ok) throw new Error("Failed to fetch unread count");
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const unreadCount = unreadCountData?.count || 0;

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const response = await fetch(`/api/notifications/${userId}/read-all`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.taskId) {
      setLocation(`/tasks?taskId=${notification.taskId}`);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "task_assigned":
        return "bg-blue-500";
      case "status_changed":
        return "bg-amber-500";
      case "task_updated":
        return "bg-green-500";
      case "note_added":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!userId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 relative"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="hidden lg:inline">Notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => markAllReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 20).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer",
                  !notification.isRead && "bg-muted/50"
                )}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-item-${notification.id}`}
              >
                <div className={cn("h-2 w-2 rounded-full mt-2 flex-shrink-0", getTypeIcon(notification.type))} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", !notification.isRead && "font-semibold")}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileNotificationBell() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const authUser = getAuthUser();
  const userId = authUser?.id;
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(`/api/notifications/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const { data: unreadCountData } = useQuery<{ count: number }>({
    queryKey: ["notifications-count", userId],
    queryFn: async () => {
      if (!userId) return { count: 0 };
      const response = await fetch(`/api/notifications/${userId}/unread-count`);
      if (!response.ok) throw new Error("Failed to fetch unread count");
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const unreadCount = unreadCountData?.count || 0;

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.taskId) {
      setLocation(`/tasks?taskId=${notification.taskId}`);
    }
    setIsOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "task_assigned":
        return "bg-blue-500";
      case "status_changed":
        return "bg-amber-500";
      case "task_updated":
        return "bg-green-500";
      case "note_added":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  if (!userId) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative text-muted-foreground h-10 w-10"
          data-testid="button-mobile-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 20).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer",
                  !notification.isRead && "bg-muted/50"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className={cn("h-2 w-2 rounded-full mt-2 flex-shrink-0", getTypeIcon(notification.type))} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", !notification.isRead && "font-semibold")}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
