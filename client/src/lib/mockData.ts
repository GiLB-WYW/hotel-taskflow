import { 
  Users, 
  ClipboardList, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Archive,
  Settings,
  LogOut,
  Plus,
  Mic,
  Camera
} from "lucide-react";

export type Priority = "Red Flag" | "High" | "Normal" | "Low";
export type Status = "Open" | "In Progress" | "Resolved";
export type Role = "Admin" | "Manager" | "Personnel" | "Basic Staff";
export type Group = "Plomberie" | "Électricité" | "Ménage" | "Général" | "Piscine";

export interface Location {
  id: string;
  name: string;
  category: string;
}

export interface MaintenanceGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  group?: Group;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  originalTranscript?: string; // STT original
  detectedLanguage?: string;
  locationId: string;
  priority: Priority;
  status: Status;
  assignedTo?: string; // User ID
  assignedGroup?: string; // MaintenanceGroup ID or Group name
  createdBy: string; // User ID
  createdAt: string;
  imageUrl?: string;
}

// Locations from spec
export const LOCATIONS: Location[] = [
  // Restaurant
  { id: "loc-r1", category: "Restaurant", name: "Le Restaurant" },
  { id: "loc-r2", category: "Restaurant", name: "Prive 1" },
  { id: "loc-r3", category: "Restaurant", name: "Prive 2" },
  { id: "loc-r4", category: "Restaurant", name: "Cuisine Le Restaurant" },
  // Suites B
  { id: "loc-b1", category: "Suites B", name: "Suite B1" },
  { id: "loc-b2", category: "Suites B", name: "Suite B2" },
  { id: "loc-b3", category: "Suites B", name: "Suite B3" },
  // Suites C
  { id: "loc-c1", category: "Suites C", name: "Suite C1" },
  { id: "loc-c2", category: "Suites C", name: "Suite C2" },
  // Technical
  { id: "loc-t1", category: "Technical", name: "La Réception" },
  { id: "loc-t2", category: "Technical", name: "Laverie B" },
  { id: "loc-t3", category: "Technical", name: "Cave à Vin" },
  // Pool
  { id: "loc-p1", category: "Pool Machinery", name: "Machine Piscine C" },
];

// Maintenance Groups
export const MAINTENANCE_GROUPS: MaintenanceGroup[] = [
  { id: "g1", name: "Plomberie", description: "Plumbing & Water Systems", memberCount: 3 },
  { id: "g2", name: "Électricité", description: "Electrical & Power Systems", memberCount: 2 },
  { id: "g3", name: "Ménage", description: "Cleaning & Housekeeping", memberCount: 5 },
  { id: "g4", name: "Général", description: "General Maintenance", memberCount: 4 },
  { id: "g5", name: "Piscine", description: "Pool & Sauna Maintenance", memberCount: 2 },
];

// Users
export const USERS: User[] = [
  { id: "u1", name: "Jean Dupont", role: "Admin", avatar: "JD" },
  { id: "u2", name: "Marie Curie", role: "Manager", avatar: "MC" },
  { id: "u3", name: "Paul Plombier", role: "Personnel", group: "Plomberie", avatar: "PP" },
  { id: "u4", name: "Basic Staff 1", role: "Basic Staff", avatar: "BS" },
];

// Mock Tasks
export const TASKS: Task[] = [
  {
    id: "t1",
    title: "Water Leak in Suite B1",
    description: "Major water leak in the bathroom sink. Water is flooding the floor.",
    locationId: "loc-b1",
    priority: "Red Flag",
    status: "Open",
    assignedGroup: "g1",
    createdBy: "u4",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    imageUrl: "https://images.unsplash.com/photo-1585909696425-6408252a5f63?auto=format&fit=crop&q=80&w=600",
  },
  {
    id: "t2",
    title: "AC Filter Cleaning",
    description: "Routine cleaning of AC filters in the restaurant area.",
    locationId: "loc-r1",
    priority: "Normal",
    status: "In Progress",
    assignedTo: "u3",
    assignedGroup: "g4",
    createdBy: "u2",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
  {
    id: "t3",
    title: "Broken Light Switch",
    description: "Light switch near the entrance is stuck.",
    locationId: "loc-c2",
    priority: "High",
    status: "Open",
    assignedGroup: "g2",
    createdBy: "u4",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
  }
];

export const PRIORITIES: Record<Priority, { color: string, label: string, sla: string }> = {
  "Red Flag": { color: "text-red-600 bg-red-50 border-red-200", label: "Critical", sla: "1 Hour" },
  "High": { color: "text-orange-600 bg-orange-50 border-orange-200", label: "Urgent", sla: "24 Hours" },
  "Normal": { color: "text-blue-600 bg-blue-50 border-blue-200", label: "Routine", sla: "48 Hours" },
  "Low": { color: "text-green-600 bg-green-50 border-green-200", label: "Preventive", sla: "7 Days" },
};
