import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Clock, AlertTriangle, CheckCircle, CheckCircle2, Image, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Task, PRIORITIES } from "@/lib/mockData";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Location, User, MaintenanceGroup } from "@shared/schema";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  locations?: Location[];
  users?: User[];
  maintenanceGroups?: MaintenanceGroup[];
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (taskId: string) => void;
  onMarkResolved?: (taskId: string) => void;
  onSendToSmtr?: (taskId: string) => void;
}

export function TaskCard({ task, onClick, locations = [], users = [], maintenanceGroups = [], selectionMode = false, isSelected = false, onSelect, onMarkResolved, onSendToSmtr }: TaskCardProps) {
  const priorityConfig = PRIORITIES[task.priority];
  const location = locations.find(l => l.id === task.locationId);
  const assignedUser = users.find(u => u.id === task.assignedTo);
  const taskGroups = (task.assignedGroups || (task.assignedGroup ? [task.assignedGroup] : []));
  const assignedGroupsList = taskGroups
    .map(gId => maintenanceGroups.find(g => g.id === gId || g.name === gId))
    .filter(Boolean) as typeof maintenanceGroups;
  
  const isResolved = task.status === 'Resolved';
  
  const getBorderColor = () => {
    if (isResolved) return 'hsl(142, 70%, 45%)';
    switch (task.priority) {
      case 'Red Flag': return 'hsl(0, 70%, 60%)';
      case 'High': return 'hsl(25, 85%, 60%)';
      case 'Normal': return 'hsl(200, 60%, 50%)';
      default: return 'hsl(150, 50%, 45%)';
    }
  };

  const handleClick = () => {
    if (selectionMode && onSelect) {
      onSelect(task.id);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden border-l-4 hover:shadow-md transition-all cursor-pointer group",
        isResolved && "bg-green-50/50 dark:bg-green-950/20",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      style={{ borderLeftColor: getBorderColor() }}
      onClick={handleClick}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-2">
          {selectionMode && (
            <Checkbox
              checked={isSelected}
              className="mt-1 h-5 w-5"
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={() => onSelect?.(task.id)}
              data-testid={`checkbox-task-${task.id}`}
            />
          )}
          <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isResolved ? (
              <Badge className="font-medium bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Resolved
              </Badge>
            ) : (
              <Badge variant="outline" className={cn("font-medium", priorityConfig.color)}>
                {task.priority}
              </Badge>
            )}
            {task.priority === 'Red Flag' && !isResolved && (
              <span className="animate-pulse text-red-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
          </div>
          <h3 className="font-serif font-semibold text-lg leading-tight text-primary group-hover:text-blue-700 transition-colors">
            {task.title}
          </h3>
        </div>
        </div>
        {((task as any).hasImage || (task.imageUrl && task.imageUrl !== 'HAS_IMAGE')) && (
          <div className="h-12 w-12 rounded-md overflow-hidden shrink-0 border border-border bg-muted">
            <img 
              src={`/api/tasks/${task.id}/thumbnail`} 
              alt="Task" 
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.classList.add('flex', 'items-center', 'justify-center');
                  parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                }
              }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-2 pb-3">
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <MapPin className="h-3.5 w-3.5 mr-1" />
          <span className="font-medium text-foreground/80">
            {location?.name || "Unknown Location"}
          </span>
          <span className="mx-2 text-border">•</span>
          <span className="text-xs">{location?.category}</span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col gap-2 border-t border-border/50 bg-muted/20 mt-2 py-2">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {assignedUser ? (
              <div className="flex items-center gap-1.5" title={`Assigned to ${assignedUser.name}`}>
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px]">
                    {assignedUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{assignedUser.name}</span>
              </div>
            ) : (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground">
                Unassigned
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSendToSmtr && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onSendToSmtr(task.id);
                }}
                title="Send to SMTR"
                data-testid={`button-smtr-card-${task.id}`}
              >
                <Wrench className="h-4 w-4" />
              </Button>
            )}
            {task.status !== "Resolved" && onMarkResolved && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-green-600 hover:bg-green-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkResolved(task.id);
                }}
                title="Mark as resolved"
                data-testid={`button-resolve-card-${task.id}`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>
        {assignedGroupsList.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {assignedGroupsList.map(g => (
              <Badge key={g.id} className="w-fit text-[10px] h-5 px-2 font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                {g.name}
              </Badge>
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
