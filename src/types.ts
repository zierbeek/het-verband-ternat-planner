export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMINISTRATOR" | "EMPLOYEE";
  employee?: Employee;
}

export interface Employee {
  id: string;
  userId: string;
  maxWeeklyHours: number;
  maxConsecutiveDays: number;
  preferredShifts: string; // JSON string list
  preferredColleagues: string; // JSON string list
  user?: User;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  date: string;
  color: string;
  requiredEmployees: number;
  notes?: string;
  isRecurring: boolean;
  recurrencePattern?: string;
  assignments?: ShiftAssignment[];
}

export interface ShiftAssignment {
  id: string;
  shiftId: string;
  employeeId: string;
  status: "ASSIGNED" | "REJECTED" | "PENDING_SWAP";
  employee?: Employee;
  shift?: Shift;
}

export interface Availability {
  id: string;
  employeeId: string;
  dayOfWeek?: number;
  date?: string;
  isAvailable: boolean;
  isSpecificDate: boolean;
  startTime: string;
  endTime: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: "VACATION" | "SICK_LEAVE" | "TRAINING" | "PERSONAL";
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  comment?: string;
  approvalHistory?: string;
  createdAt: string;
  employee?: Employee;
}

export interface ShiftChangeRequest {
  id: string;
  assignmentId: string;
  employeeId: string;
  type: "TIME_CHANGE" | "ABSENCE" | "EXTRA_SHIFT";
  requestedStartTime?: string;
  requestedEndTime?: string;
  reason: string;
  comment?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  employee?: Employee;
  assignment?: ShiftAssignment;
}

export interface SwapRequest {
  id: string;
  shiftId: string;
  requesterId: string;
  targetId: string;
  targetShiftId?: string;
  status: "PENDING_TARGET" | "ACCEPTED_TARGET" | "REJECTED_TARGET" | "APPROVED_ADMIN" | "REJECTED_ADMIN";
  reason: string;
  comment?: string;
  createdAt: string;
  shift?: Shift;
  targetShift?: Shift;
  requester?: Employee;
  target?: Employee;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  isArchived?: boolean;
  link?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  isArchived?: boolean;
  createdAt: string;
  author?: {
    name: string;
  };
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  details: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  };
}
