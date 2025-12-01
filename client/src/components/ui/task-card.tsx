import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Clock, AlertTriangle } from "lucide-react";
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
}

export function TaskCard({ task, onClick, locations = [], users = [], maintenanceGroups = [] }: TaskCardProps) {
  const priorityConfig = PRIORITIES[task.priority];
  const location = locations.find(l => l.id === task.locationId);
  const assignedUser = users.find(u => u.id === task.assignedTo);
  const assignedGroup = maintenanceGroups.find(g => g.id === task.assignedGroup || g.name === task.assignedGroup);

  return (
    <Card 
      className="overflow-hidden border-l-4 hover:shadow-md transition-all cursor-pointer group"
      style={{ borderLeftColor: task.priority === 'Red Flag' ? 'hsl(0, 70%, 60%)' : 
                               task.priority === 'High' ? 'hsl(25, 85%, 60%)' : 
                               task.priority === 'Normal' ? 'hsl(200, 60%, 50%)' : 
                               'hsl(150, 50%, 45%)' }}
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("font-medium", priorityConfig.color)}>
              {task.priority}
            </Badge>
            {task.priority === 'Red Flag' && (
              <span className="animate-pulse text-red-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
          </div>
          <h3 className="font-serif font-semibold text-lg leading-tight text-primary group-hover:text-blue-700 transition-colors">
            {task.title}
          </h3>
        </div>
        {task.imageUrl && (
          <div className="h-12 w-12 rounded-md overflow-hidden shrink-0 border border-border">
            <img src={task.imageUrl} alt="Task" className="h-full w-full object-cover" />
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
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
          </div>
        </div>
        {assignedGroup && (
          <Badge className="w-fit text-[10px] h-5 px-2 font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
            {assignedGroup.name}
          </Badge>
        )}
      </CardFooter>
    </Card>
  );
}
