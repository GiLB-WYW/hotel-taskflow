export type Priority = "Red Flag" | "High" | "Normal" | "Low";
export type Status = "Open" | "In Progress" | "Resolved";
export type Role = "Admin" | "Manager" | "Personnel" | "Basic Staff";
export type Group = "Plomberie" | "Électricité" | "Ménage" | "Général" | "Piscine";

export interface User {
  id: string;
  name: string;
  role: Role;
  group?: Group;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  originalTranscript?: string;
  detectedLanguage?: string;
  locationId: string;
  priority: Priority;
  status: Status;
  assignedTo?: string;
  assignedGroup?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string;
}

export const PRIORITIES: Record<Priority, { color: string, label: string, sla: string }> = {
  "Red Flag": { color: "text-red-600 bg-red-50 border-red-200", label: "Critical", sla: "1 Hour" },
  "High": { color: "text-orange-600 bg-orange-50 border-orange-200", label: "Urgent", sla: "24 Hours" },
  "Normal": { color: "text-blue-600 bg-blue-50 border-blue-200", label: "Routine", sla: "48 Hours" },
  "Low": { color: "text-green-600 bg-green-50 border-green-200", label: "Preventive", sla: "7 Days" },
};
