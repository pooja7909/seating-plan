export type StudentStatus = 'present' | 'absent' | 'focus' | 'support' | 'empty';
export type ElementType = 'door' | 'window' | 'aisle' | 'board' | 'other';

export interface StudentGroup {
  id: string;
  name: string;
  color: string;
}

export interface SeatData {
  id: string;
  studentName: string;
  status: StudentStatus;
  groupId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface ClassroomState {
  seats: SeatData[];
  groups: StudentGroup[];
  roomElements: RoomElement[];
  yearGroup: string;
  subject: string;
  classCode: string;
}
