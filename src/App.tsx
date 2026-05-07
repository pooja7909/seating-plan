/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { domToJpeg, domToPng } from 'modern-screenshot';
import { jsPDF } from 'jspdf';
import { 
  Plus, 
  Trash2, 
  Settings2, 
  User, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Target, 
  Star,
  Printer,
  RotateCcw,
  Move,
  Monitor,
  DoorOpen,
  Square,
  Navigation,
  ChevronDown,
  Copy,
  ClipboardPaste,
  FileDown,
  FileUp,
  Info,
  X,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Save,
  Cloud,
  CloudOff,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  FileJson,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { SeatData, StudentGroup, StudentStatus, ClassroomState, RoomElement, ElementType } from './types';

const GRID_SIZE = 20;

const YEAR_GROUPS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'];
const SUBJECTS = [
  'Biology', 'Business Studies', 'Chemistry', 'Chinese A', 'Computer Science', 'Drama', 
  'EAL', 'EAP', 'Economics', 'English', 'ESS', 'French', 'Geography', 'German', 'Guidance', 
  'History', 'Humanities', 'Hungarian', 'Maths', 'Music', 'Physics', 'Psychology',
  'PE', 'Registration', 'Science', 'Spanish', 'Sports Science'
].sort();

const DEFAULT_GROUPS: StudentGroup[] = [
  { id: 'group-1', name: 'Group A', color: '#3b82f6' },
  { id: 'group-2', name: 'Group B', color: '#ef4444' },
  { id: 'group-3', name: 'Group C', color: '#10b981' },
  { id: 'group-4', name: 'Group D', color: '#f59e0b' },
];

const DRAFT_LAYOUT = {
  seats: Array.from({ length: 10 }).map((_, i) => ({
    id: `seat-${i}-${Date.now()}`,
    studentName: '',
    status: 'empty' as StudentStatus,
    x: 100 + (i % 5) * 160,
    y: 200 + Math.floor(i / 5) * 140,
    width: 120,
    height: 80
  })),
  roomElements: [
    { id: 'element-board', type: 'board' as ElementType, x: 300, y: 40, width: 400, height: 60, label: 'Whiteboard', color: '#ffffff' },
    { id: 'element-screen', type: 'other' as ElementType, x: 720, y: 40, width: 200, height: 60, label: 'Smart Screen' },
    { id: 'element-door', type: 'door' as ElementType, x: 20, y: 650, width: 100, height: 60, label: 'Door' },
    { id: 'element-window', type: 'window' as ElementType, x: 1120, y: 200, width: 60, height: 300, label: 'Window' }
  ]
};

const STATUS_CONFIG: Record<StudentStatus, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; text: string }> = {
  empty: { 
    label: 'Empty', 
    icon: <Monitor size={14} />, 
    color: '#94a3b8', 
    bg: 'bg-slate-100', 
    border: 'border-slate-300', 
    text: 'text-slate-500' 
  },
  present: { 
    label: 'Present', 
    icon: <CheckCircle2 size={14} />, 
    color: '#22c55e', 
    bg: 'bg-green-100', 
    border: 'border-green-400', 
    text: 'text-green-700' 
  },
  absent: { 
    label: 'Absent', 
    icon: <XCircle size={14} />, 
    color: '#ef4444', 
    bg: 'bg-red-100', 
    border: 'border-red-400', 
    text: 'text-red-700' 
  },
  focus: { 
    label: 'Needs Focus', 
    icon: <Target size={14} />, 
    color: '#f59e0b', 
    bg: 'bg-amber-100', 
    border: 'border-amber-400', 
    text: 'text-amber-700' 
  },
  support: { 
    label: 'Needs Support', 
    icon: <Star size={14} />, 
    color: '#8b5cf6', 
    bg: 'bg-violet-100', 
    border: 'border-violet-400', 
    text: 'text-violet-700' 
  },
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error Details:', JSON.stringify(errInfo, null, 2));
  return errInfo;
}

export default function App() {
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [roomElements, setRoomElements] = useState<RoomElement[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>(DEFAULT_GROUPS);
  const [yearGroup, setYearGroup] = useState(YEAR_GROUPS[0]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [classCode, setClassCode] = useState('');
  const [syncPin, setSyncPin] = useState('');
  const [editingSeat, setEditingSeat] = useState<SeatData | null>(null);
  const [editingElement, setEditingElement] = useState<RoomElement | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isElementModalOpen, setIsElementModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<ClassroomState[]>([]);
  const [redoStack, setRedoStack] = useState<ClassroomState[]>([]);
  const [clipboard, setClipboard] = useState<{ type: 'seat' | 'element', data: any } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<{ grayscale: boolean; orientation: 'portrait' | 'landscape' }>({
    grayscale: false,
    orientation: 'landscape'
  });
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState(() => {
    return localStorage.getItem('cloud-sync-enabled') !== 'false';
  });
  
  useEffect(() => {
    localStorage.setItem('cloud-sync-enabled', isCloudSyncEnabled.toString());
  }, [isCloudSyncEnabled]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [cloudPlanAvailable, setCloudPlanAvailable] = useState<boolean>(false);
  
  // Draft metadata for the header to prevent instant switching
  const [draftYear, setDraftYear] = useState(yearGroup);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftCode, setDraftCode] = useState(classCode);
  const [isChangingMetadata, setIsChangingMetadata] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Sync draft with actual state when it changes elsewhere
  useEffect(() => {
    setDraftYear(yearGroup);
    setDraftSubject(subject);
    setDraftCode(classCode);
  }, [yearGroup, subject, classCode]);

  // Persistence Key
  const getStorageKey = () => `seating-plan-${yearGroup}-${subject}-${classCode || 'default'}`;
  const getCloudKey = () => {
    const rawKey = `${yearGroup}-${subject}-${classCode || 'default'}`;
    return rawKey
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')   // Replace all non-alphanumeric sequences with hyphens
      .replace(/^-+|-+$/g, '');      // Trim hyphens from ends
  };

  const applyNewMetadata = (moveData: boolean = false) => {
    const normalizedCode = draftCode.toUpperCase();
    if (moveData) {
      const newState = { seats, roomElements, groups };
      const newKey = `seating-plan-${draftYear}-${draftSubject}-${normalizedCode || 'default'}`;
      localStorage.setItem(newKey, JSON.stringify(newState));
      setToast({ message: 'Layout successfully moved to new class!', type: 'success' });
    }
    
    setYearGroup(draftYear);
    setSubject(draftSubject);
    setClassCode(normalizedCode);
    setIsChangingMetadata(false);
    setTimeout(() => setToast(null), 3000);
  };

  const saveToCloud = async (force: boolean = false) => {
    if (!isCloudSyncEnabled && !force) return;
    if (!auth.currentUser) return;
    
    setIsSyncing(true);
    try {
      const planId = getCloudKey();
      const planData = {
        yearGroup,
        subject,
        classCode,
        pin: syncPin,
        seats,
        roomElements,
        groups,
        ownerId: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'seatingPlans', planId), planData);
      setLastSynced(new Date());
      setToast({ message: 'Synced to Cloud!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seatingPlans/${getCloudKey()}`);
      setToast({ message: 'Cloud Sync Failed', type: 'info' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const loadFromCloud = async () => {
    setIsSyncing(true);
    try {
      const planId = getCloudKey();
      const docRef = doc(db, 'seatingPlans', planId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pin && data.pin !== syncPin) {
          setToast({ message: 'Incorrect Sync PIN for this plan', type: 'info' });
          setTimeout(() => setToast(null), 3000);
          return;
        }
        saveToHistory();
        setSeats(data.seats || []);
        setRoomElements(data.roomElements || []);
        setGroups(data.groups || DEFAULT_GROUPS);
        setLastSynced(data.updatedAt?.toDate() || new Date());
        setToast({ message: 'Plan loaded from Cloud!', type: 'success' });
        setCloudPlanAvailable(false);
      } else {
        setToast({ message: 'No cloud plan found for this class', type: 'info' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `seatingPlans/${getCloudKey()}`);
      setToast({ message: 'Failed to load from cloud', type: 'info' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const checkForCloudPlan = async () => {
    if (isInitialLoad.current) return;
    try {
      const planId = getCloudKey();
      const docRef = doc(db, 'seatingPlans', planId);
      const docSnap = await getDoc(docRef);
      const exists = docSnap.exists();
      setCloudPlanAvailable(exists);
      
      if (exists && !localStorage.getItem(getStorageKey())) {
        setToast({ message: 'Seating plan found in Cloud!', type: 'info' });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `seatingPlans/${getCloudKey()}`);
    }
  };

  // Load state when class metadata changes
  useEffect(() => {
    const loadData = async () => {
      // Fallback to localStorage
      const key = getStorageKey();
      const saved = localStorage.getItem(key);
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSeats(parsed.seats || []);
          setRoomElements(parsed.roomElements || []);
          setGroups(parsed.groups || DEFAULT_GROUPS);
        } catch (e) {
          console.error('Failed to load saved state', e);
        }
      } else {
        // Clear if no data exists for this class
        if (!isInitialLoad.current) {
          setSeats([]);
          setRoomElements([]);
          setGroups(DEFAULT_GROUPS);
        }
        // Check cloud if local is empty
        checkForCloudPlan();
      }
    };

    loadData();
    isInitialLoad.current = false;
  }, [yearGroup, subject, classCode]);

  // Save state when it changes
  useEffect(() => {
    if (isInitialLoad.current) return;
    const key = getStorageKey();
    const state = {
      seats,
      roomElements,
      groups
    };
    localStorage.setItem(key, JSON.stringify(state));
    
    // Auto-sync to cloud if enabled
    if (isCloudSyncEnabled) {
      const timeoutId = setTimeout(() => {
        saveToCloud();
      }, 2000); // Debounce cloud saves
      return () => clearTimeout(timeoutId);
    }
  }, [seats, roomElements, groups, isCloudSyncEnabled]);

  const saveAsMyRoomTemplate = async () => {
    const template = {
      roomElements: roomElements.map(e => ({ ...e })),
      seats: seats.map(s => ({
        ...s,
        studentName: '', 
        status: 'empty' as StudentStatus,
        groupId: undefined
      }))
    };

    localStorage.setItem('classroom-user-template', JSON.stringify(template));
    setToast({ message: 'Current layout saved locally!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const applyMyRoomTemplate = async () => {
    let savedData = null;

    const local = localStorage.getItem('classroom-user-template');
    if (local) savedData = JSON.parse(local);

    if (!savedData) {
      setToast({ message: 'No room template found. Save your layout first!', type: 'info' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    saveToHistory();
    try {
      const templatedSeats = savedData.seats.map((s: any) => ({
        ...s,
        id: `seat-${Math.random().toString(36).substr(2, 9)}`
      }));
      const templatedElements = savedData.roomElements.map((e: any) => ({
        ...e,
        id: `element-${Math.random().toString(36).substr(2, 9)}`
      }));
      
      setSeats(templatedSeats);
      setRoomElements(templatedElements);
      setGroups(DEFAULT_GROUPS);
      setToast({ message: 'Room template applied!', type: 'success' });
    } catch (e) {
      console.error('Failed to apply room template', e);
    }
    setTimeout(() => setToast(null), 3000);
  };

  const loadDraft = () => {
    saveToHistory();
    // Use fresh IDs for seats to avoid duplicates if loaded multiple times
    const draftSeats = DRAFT_LAYOUT.seats.map(s => ({ ...s, id: `seat-${Math.random().toString(36).substr(2, 9)}` }));
    setSeats(draftSeats);
    setRoomElements(DRAFT_LAYOUT.roomElements);
    setGroups(DEFAULT_GROUPS);
    setIsWelcomeModalOpen(false);
    setToast({ message: 'Default draft layout loaded!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const getCurrentState = (): ClassroomState => ({
    seats,
    groups,
    roomElements,
    yearGroup,
    subject,
    classCode
  });

  const saveToHistory = () => {
    const currentState = getCurrentState();
    setHistory(prev => [...prev, currentState].slice(-50));
    setRedoStack([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    const currentState = getCurrentState();
    
    setRedoStack(prev => [currentState, ...prev]);
    setHistory(prev => prev.slice(0, -1));
    
    setSeats(prevState.seats);
    setGroups(prevState.groups);
    setRoomElements(prevState.roomElements);
    setYearGroup(prevState.yearGroup);
    setSubject(prevState.subject);
    setClassCode(prevState.classCode);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[0];
    const currentState = getCurrentState();
    
    setHistory(prev => [...prev, currentState]);
    setRedoStack(prev => prev.slice(1));
    
    setSeats(nextState.seats);
    setGroups(nextState.groups);
    setRoomElements(nextState.roomElements);
    setYearGroup(nextState.yearGroup);
    setSubject(nextState.subject);
    setClassCode(nextState.classCode);
  };

  const copySeat = (seat: SeatData) => {
    setClipboard({
      type: 'seat',
      data: {
        studentName: seat.studentName,
        status: seat.status,
        groupId: seat.groupId,
        width: seat.width,
        height: seat.height
      }
    });
    setToast({ message: 'Seat copied to clipboard!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const copyElement = (element: RoomElement) => {
    setClipboard({
      type: 'element',
      data: {
        type: element.type,
        width: element.width,
        height: element.height,
        label: element.label,
        color: element.color
      }
    });
    setToast({ message: 'Element copied to clipboard!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const pasteItem = (x: number, y: number) => {
    if (!clipboard) return;
    saveToHistory();
    const finalX = snapToGrid ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
    const finalY = snapToGrid ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;

    if (clipboard.type === 'seat') {
      const newSeat: SeatData = {
        id: `seat-${Date.now()}`,
        studentName: clipboard.data.studentName || '',
        status: clipboard.data.status || 'empty',
        groupId: clipboard.data.groupId,
        x: finalX,
        y: finalY,
        width: clipboard.data.width || 100,
        height: clipboard.data.height || 70
      };
      setSeats([...seats, newSeat]);
    } else {
      const newElement: RoomElement = {
        id: `element-${Date.now()}`,
        type: clipboard.data.type,
        x: finalX,
        y: finalY,
        width: clipboard.data.width,
        height: clipboard.data.height,
        label: clipboard.data.label,
        color: clipboard.data.color
      };
      setRoomElements([...roomElements, newElement]);
    }
  };

  const exportArchitecture = () => {
    const template = {
      roomElements: roomElements.map(e => ({ ...e })),
      seats: seats.map(s => ({
        ...s,
        studentName: '',
        status: 'empty' as StudentStatus,
        groupId: undefined
      })),
      yearGroup: '',
      subject: '',
      classCode: ''
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Room-Template-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Room architecture exported!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const exportTemplate = () => {
    const template = {
      seats,
      roomElements,
      groups,
      yearGroup,
      subject,
      classCode
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `${yearGroup} - ${classCode || 'NoCode'} - ${subject}`.replace(/[/\\?%*:|"<>]/g, '-');
    a.download = `${fileName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setConfirmModal({
          isOpen: true,
          title: 'Import Seating Plan',
          message: 'This will replace your current layout and all student data with the imported file. Continue?',
          onConfirm: () => {
            saveToHistory();
            // Use existing IDs if they exist to maintain consistency, or generate new ones if needed
            // But for a full import, we usually want the exact state
            setSeats(data.seats);
            setRoomElements(data.roomElements);
            if (data.groups) setGroups(data.groups);
            if (data.yearGroup) setYearGroup(data.yearGroup);
            if (data.subject) setSubject(data.subject);
            if (data.classCode) setClassCode(data.classCode);
            setConfirmModal(null);
            setIsWelcomeModalOpen(false);
            setToast({ message: 'Seating plan imported successfully', type: 'success' });
          }
        });
      } catch (err) {
        console.error('Failed to parse file', err);
        setToast({ message: 'Failed to import file. Invalid format.', type: 'info' });
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be imported again
    e.target.value = '';
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, redoStack, seats, groups, roomElements, yearGroup, subject, classCode]);

  const loadDraftLayout = () => {
    const initialSeats: SeatData[] = [];
    const ROWS = 5;
    const COLS = 5; // 5x5 = 25 computers
    const SEAT_WIDTH = 100;
    const SEAT_HEIGHT = 70;
    const START_X = 150;
    const START_Y = 150;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        initialSeats.push({
          id: `seat-${r}-${c}-${Date.now()}`,
          studentName: '',
          status: 'empty',
          x: START_X + c * (SEAT_WIDTH + 20),
          y: START_Y + r * (SEAT_HEIGHT + 20),
          width: SEAT_WIDTH,
          height: SEAT_HEIGHT
        });
      }
    }

    setSeats(initialSeats);
    setRoomElements([
      { id: 'board-1', type: 'board', x: 350, y: 20, width: 400, height: 40, label: 'Main Whiteboard' },
      { id: 'door-1', type: 'door', x: 20, y: 150, width: 60, height: 100, label: 'Entrance' },
      { id: 'window-1', type: 'window', x: 1100, y: 200, width: 20, height: 200, label: 'Window' }
    ]);
  };

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('classroom-seating-plan-v4');
    if (saved) {
      try {
        const data: ClassroomState = JSON.parse(saved);
        setSeats(data.seats || []);
        setGroups(data.groups || DEFAULT_GROUPS);
        setRoomElements(data.roomElements || []);
        setYearGroup(data.yearGroup || YEAR_GROUPS[0]);
        setSubject(data.subject || SUBJECTS[0]);
        setClassCode(data.classCode || '');
      } catch (e) {
        console.error('Failed to load seating plan', e);
      }
    } else {
      loadDraftLayout();
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    const state: ClassroomState = { seats, groups, roomElements, yearGroup, subject, classCode };
    localStorage.setItem('classroom-seating-plan-v4', JSON.stringify(state));
  }, [seats, groups, roomElements, yearGroup, subject, classCode]);

  const addSeat = () => {
    saveToHistory();
    const newSeat: SeatData = {
      id: `seat-${Date.now()}`,
      studentName: '',
      status: 'empty',
      x: 50,
      y: 50,
      width: 100,
      height: 70
    };
    setSeats([...seats, newSeat]);
  };

  const addRoomElement = (type: ElementType) => {
    saveToHistory();
    const newElement: RoomElement = {
      id: `element-${Date.now()}`,
      type,
      x: 50,
      y: 50,
      width: type === 'board' ? 300 : (type === 'aisle' ? 40 : 100),
      height: type === 'board' ? 60 : (type === 'aisle' ? 200 : 40),
      label: type === 'board' ? 'Whiteboard' : type.charAt(0).toUpperCase() + type.slice(1)
    };
    setRoomElements([...roomElements, newElement]);
  };

  const deleteItem = (id: string, isSeat: boolean) => {
    saveToHistory();
    if (isSeat) {
      setSeats(seats.filter(s => s.id !== id));
      if (editingSeat?.id === id) {
        setIsEditModalOpen(false);
        setEditingSeat(null);
      }
    } else {
      setRoomElements(roomElements.filter(e => e.id !== id));
      if (editingElement?.id === id) {
        setIsElementModalOpen(false);
        setEditingElement(null);
      }
    }
  };

  const updatePosition = (id: string, x: number, y: number, isSeat: boolean) => {
    const finalX = snapToGrid ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
    const finalY = snapToGrid ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;

    // Only save to history if position actually changed
    const currentItem = isSeat ? seats.find(s => s.id === id) : roomElements.find(e => e.id === id);
    if (currentItem && (currentItem.x !== finalX || currentItem.y !== finalY)) {
      saveToHistory();
    }

    if (isSeat) {
      setSeats(prev => prev.map(s => s.id === id ? { ...s, x: finalX, y: finalY } : s));
    } else {
      setRoomElements(prev => prev.map(e => e.id === id ? { ...e, x: finalX, y: finalY } : e));
    }
  };

  const updateSize = (id: string, width: number, height: number, isSeat: boolean) => {
    const minSize = 20;
    const finalWidth = snapToGrid ? Math.max(minSize, Math.round(width / GRID_SIZE) * GRID_SIZE) : Math.max(minSize, width);
    const finalHeight = snapToGrid ? Math.max(minSize, Math.round(height / GRID_SIZE) * GRID_SIZE) : Math.max(minSize, height);

    const currentItem = isSeat ? seats.find(s => s.id === id) : roomElements.find(e => e.id === id);
    if (currentItem && (currentItem.width !== finalWidth || currentItem.height !== finalHeight)) {
      saveToHistory();
    }

    if (isSeat) {
      setSeats(prev => prev.map(s => s.id === id ? { ...s, width: finalWidth, height: finalHeight } : s));
    } else {
      setRoomElements(prev => prev.map(e => e.id === id ? { ...e, width: finalWidth, height: finalHeight } : e));
    }
  };

  const handleDoubleClick = (item: SeatData | RoomElement, isSeat: boolean) => {
    if (isDeleteMode) {
      deleteItem(item.id, isSeat);
      return;
    }
    if (isSeat) {
      setEditingSeat(item as SeatData);
      setIsEditModalOpen(true);
    } else {
      setEditingElement(item as RoomElement);
      setIsElementModalOpen(true);
    }
  };

  const saveSeatDetails = (updatedSeat: SeatData) => {
    saveToHistory();
    setSeats(prev => prev.map(s => s.id === updatedSeat.id ? updatedSeat : s));
    setIsEditModalOpen(false);
    setEditingSeat(null);
  };

  const saveElementDetails = (updatedElement: RoomElement) => {
    saveToHistory();
    setRoomElements(prev => prev.map(e => e.id === updatedElement.id ? updatedElement : e));
    setIsElementModalOpen(false);
    setEditingElement(null);
  };

  const resetAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset All Seats',
      message: 'Are you sure you want to reset all seats? This will clear all names and statuses.',
      onConfirm: () => {
        saveToHistory();
        setSeats(prev => prev.map(s => ({ ...s, studentName: '', status: 'empty', groupId: undefined })));
        setConfirmModal(null);
      }
    });
  };

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  const triggerPrint = () => {
    setIsPrintModalOpen(false);
    setIsPrintMode(true);
    // Give the UI a moment to update before triggering the print dialog
    setTimeout(() => {
      window.focus();
      window.print();
    }, 500);
  };

  const handleSaveAsImage = async () => {
    if (!canvasRef.current) return;
    
    setToast({ message: 'Generating image...', type: 'info' });
    
    try {
      // Temporarily remove transform for clean capture
      const originalTransform = canvasRef.current.style.transform;
      const originalWidth = canvasRef.current.style.width;
      
      // Force dimensions and reset zoom for capture
      canvasRef.current.style.transform = 'none';
      canvasRef.current.style.width = '1200px';

      const dataUrl = await domToJpeg(canvasRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      
      // Restore state
      canvasRef.current.style.transform = originalTransform;
      canvasRef.current.style.width = originalWidth;

      const link = document.createElement('a');
      const fileName = `${yearGroup} - ${classCode || 'NoCode'} - ${subject}`.replace(/[/\\?%*:|"<>]/g, '-');
      link.download = `${fileName}.jpg`;
      link.href = dataUrl;
      link.click();
      
      setToast({ message: 'Image saved successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Failed to save image', err);
      setToast({ message: 'Error generating image. Try again.', type: 'info' });
    }
  };

  const handleSaveAsPDF = async () => {
    if (!canvasRef.current) return;
    
    setToast({ message: 'Generating high-quality PDF...', type: 'info' });
    
    try {
      const originalTransform = canvasRef.current.style.transform;
      const originalWidth = canvasRef.current.style.width;
      
      // Force dimensions for consistent capture
      canvasRef.current.style.transform = 'none';
      canvasRef.current.style.width = '1200px';

      // Use PNG for PDF for better quality/reliability
      const dataUrl = await domToPng(canvasRef.current, {
        scale: 1.5, // Balanced for quality vs memory
        backgroundColor: '#ffffff',
      });
      
      canvasRef.current.style.transform = originalTransform;
      canvasRef.current.style.width = originalWidth;

      // Initialize jsPDF with explicit orientation
      const orientation = printSettings.orientation === 'portrait' ? 'p' : 'l';
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const outputWidth = pdfWidth - 20; // 10mm margins
      const outputHeight = (imgProps.height * outputWidth) / imgProps.width;
      
      let finalWidth = outputWidth;
      let finalHeight = outputHeight;
      const maxPageHeight = pdfHeight - 20;
      
      if (finalHeight > maxPageHeight) {
        finalHeight = maxPageHeight;
        finalWidth = (imgProps.width * finalHeight) / imgProps.height;
      }
      
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;
      
      pdf.addImage(dataUrl, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
      
      const fileName = `${yearGroup} - ${classCode || 'NoCode'} - ${subject}`.replace(/[/\\?%*:|"<>]/g, '-');
      
      try {
        pdf.save(`${fileName}.pdf`);
        setToast({ message: 'PDF saved successfully!', type: 'success' });
      } catch (saveError) {
        // Fallback for restricted iframe downloads
        console.warn('Standard PDF save failed, attempting data URL fallback', saveError);
        const pdfData = pdf.output('datauristring');
        const link = document.createElement('a');
        link.href = pdfData;
        link.download = `${fileName}.pdf`;
        link.click();
        setToast({ message: 'PDF saved via data fallback!', type: 'success' });
      }
      
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error('Failed to save PDF', err);
      setToast({ message: 'Error generating PDF. Try JPEG instead if this persists.', type: 'info' });
    }
  };

  const handleExportJSON = () => {
    const data = {
      seats,
      roomElements,
      groups,
      yearGroup,
      subject,
      classCode,
      version: '1.0',
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `SeatingPlan-${yearGroup}-${classCode || 'NoCode'}-${subject}`.replace(/[/\\?%*:|"<>]/g, '-');
    link.href = url;
    link.download = `${fileName}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Backup file saved to your computer!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Basic validation
        if (!data.seats || !Array.isArray(data.seats)) {
          throw new Error('This file doesn\'t look like a valid Seating Plan backup.');
        }

        setSeats(data.seats);
        if (data.roomElements) setRoomElements(data.roomElements);
        if (data.groups) setGroups(data.groups);
        if (data.yearGroup) setYearGroup(data.yearGroup);
        if (data.subject) setSubject(data.subject);
        if (data.classCode) setClassCode(data.classCode);
        
        setToast({ message: 'Plan restored from file!', type: 'success' });
        saveToHistory();
        setTimeout(() => setToast(null), 3000);
      } catch (err: any) {
        console.error('Import Error:', err);
        setToast({ message: `Load Failed: ${err.message || 'Invalid file'}`, type: 'info' });
        setTimeout(() => setToast(null), 4000);
      }
      // Reset input so the same file can be selected again
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className={`min-h-screen bg-[#f0ede8] text-[#1a1816] font-mono selection:bg-blue-100 print:bg-white print:text-black ${isPrintMode ? 'bg-white' : ''} print:h-auto print:block print:overflow-visible`}>
      <input 
        type="file" 
        id="json-import-input" 
        accept=".json" 
        onChange={handleImportJSON} 
        className="hidden" 
      />
      <style>
        {`
          @media print {
            @page {
              size: A4 ${printSettings.orientation};
              margin: 0;
            }
          }
        `}
      </style>
      {/* Header */}
      {!isPrintMode && (
        <header className="px-4 md:px-8 py-4 md:py-6 w-full print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter uppercase font-sans">
                  Classroom Seating Plan
                </h1>
              </div>
              <p className="text-[10px] md:text-xs text-[#7a746c] mt-1">
                Double-click to edit • Drag to move • Click to delete (in delete mode)
              </p>
              <div className="mt-2 text-[9px] md:text-[10px] text-blue-600 font-bold bg-blue-50/50 px-2 py-1 rounded inline-block">
                Note: Print works best in Landscape & A4 for PDF/JPEG. If issues persist, take a screenshot, save as JPEG, and print.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <button 
                onClick={() => setIsHelpModalOpen(true)}
                className="p-2 bg-white hover:bg-slate-50 text-slate-500 rounded-lg border-2 border-slate-100 transition-all"
                title="How to Use Guide"
              >
                <Info size={20} />
              </button>

              <div className="flex flex-wrap items-center gap-2 mr-2 md:mr-4">
                <span className="text-[10px] md:text-xs text-[#7a746c] hidden sm:inline">Colour key:</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_CONFIG) as StudentStatus[]).map(status => (
                    <div key={status} className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] md:text-xs font-semibold ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].border}`}>
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_CONFIG[status].color }} />
                      <span>{STATUS_CONFIG[status].label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setIsDeleteMode(!isDeleteMode)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight transition-all border-2 shadow-sm ${isDeleteMode ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'}`}
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">{isDeleteMode ? 'DELETE MODE ON' : 'DELETE MODE'}</span>
              </button>

              <button 
                onClick={addSeat}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight transition-all shadow-lg shadow-blue-100 active:scale-95"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">ADD SEAT</span>
                <span className="sm:hidden">SEAT</span>
              </button>

              <button 
                onClick={saveAsMyRoomTemplate}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight transition-all shadow-lg shadow-amber-100 active:scale-95"
                title="Save current layout as your master template (clears names)"
              >
                <Save size={18} />
                <span className="hidden sm:inline">SAVE DRAFT</span>
                <span className="sm:hidden">SAVE</span>
              </button>

              <button 
                onClick={applyMyRoomTemplate}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight transition-all shadow-lg shadow-indigo-100 active:scale-95"
                title="Apply your saved master template to this class"
              >
                <LayoutGrid size={18} />
                <span className="hidden sm:inline">USE DRAFT</span>
                <span className="sm:hidden">USE</span>
              </button>

              <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden lg:block" />

              <div className="relative group">
                <button 
                  onClick={handleExportJSON}
                  className="flex items-center gap-2 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-600 px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight transition-all shadow-sm active:scale-95"
                >
                  <FileJson size={18} className="text-amber-500" />
                  <span className="hidden lg:inline">SAVE TO COMPUTER</span>
                  <span className="hidden sm:inline lg:hidden">BACKUP</span>
                  <span className="sm:hidden text-[10px]">SAVE FILE</span>
                </button>
                <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed shadow-xl">
                  <strong>SAVE TO COMPUTER:</strong> Downloads a tiny backup file to your "Downloads" folder. Use this to keep a copy of your plan or share it with a colleague!
                </div>
              </div>

              <div className="relative group">
                <button 
                  onClick={() => document.getElementById('json-import-input')?.click()}
                  className="flex items-center gap-2 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-600 px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight transition-all shadow-sm active:scale-95"
                >
                  <Upload size={18} className="text-indigo-500" />
                  <span className="hidden lg:inline">LOAD FROM FILE</span>
                  <span className="hidden sm:inline lg:hidden">RESTORE</span>
                  <span className="sm:hidden text-[10px]">LOAD FILE</span>
                </button>
                <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 leading-relaxed shadow-xl">
                  <strong>LOAD FROM FILE:</strong> Use this to open a plan you previously saved to your computer. Just select the SeatingPlan file you downloaded earlier.
                </div>
              </div>

              {clipboard?.type === 'seat' && (
                <button 
                  onClick={() => pasteItem(100, 100)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight transition-all shadow-lg shadow-emerald-100 active:scale-95 animate-in fade-in zoom-in duration-300"
                  title="Paste Copied Seat"
                >
                  <ClipboardPaste size={18} />
                  <span className="hidden sm:inline">PASTE SEAT</span>
                  <span className="sm:hidden">PASTE</span>
                </button>
              )}

              <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden md:block" />

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative group">
                  <select 
                    value={draftYear}
                    onChange={(e) => {
                      setDraftYear(e.target.value);
                      setIsChangingMetadata(true);
                    }}
                    className={`appearance-none bg-white border-2 rounded-xl px-3 py-2 md:px-4 md:py-2.5 pr-8 md:pr-10 text-[10px] md:text-xs font-black outline-none transition-all cursor-pointer shadow-sm ${isChangingMetadata ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100 focus:border-blue-500'}`}
                  >
                    {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
                </div>

                <div className="relative group">
                  <select 
                    value={draftSubject}
                    onChange={(e) => {
                      setDraftSubject(e.target.value);
                      setIsChangingMetadata(true);
                    }}
                    className={`appearance-none bg-white border-2 rounded-xl px-3 py-2 md:px-4 md:py-2.5 pr-8 md:pr-10 text-[10px] md:text-xs font-black outline-none transition-all cursor-pointer shadow-sm ${isChangingMetadata ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100 focus:border-blue-500'}`}
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={12} />
                </div>

                <div className="relative flex items-center gap-2">
                  <input 
                    type="text"
                    value={draftCode}
                    onChange={(e) => {
                      setDraftCode(e.target.value.toUpperCase());
                      setIsChangingMetadata(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyNewMetadata(false);
                    }}
                    placeholder="CLASS CODE"
                    className={`bg-white border-2 rounded-xl px-3 py-2 md:px-4 md:py-2.5 text-[10px] md:text-xs font-black outline-none transition-all w-28 md:w-36 uppercase placeholder:text-slate-300 shadow-sm ${isChangingMetadata ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100 focus:border-blue-500'}`}
                  />
                  
                  {isChangingMetadata && (
                    <div className="flex gap-1 animate-in slide-in-from-left-2 duration-300">
                      <button 
                        onClick={() => applyNewMetadata(true)}
                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm transition-all text-[8px] font-black uppercase"
                        title="Rename & Keep Layout"
                      >
                        RENAME
                      </button>
                      <button 
                        onClick={() => applyNewMetadata(false)}
                        className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 shadow-sm transition-all text-[8px] font-black uppercase"
                        title="Switch Class"
                      >
                        SWITCH
                      </button>
                      <button 
                        onClick={() => {
                          setDraftYear(yearGroup);
                          setDraftSubject(subject);
                          setDraftCode(classCode);
                          setIsChangingMetadata(false);
                        }}
                        className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 shadow-sm transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black tracking-tight hover:bg-slate-800 transition-all shadow-md active:scale-95 ml-auto"
              >
                <Printer size={18} />
                <span className="hidden sm:inline">PRINT PLAN</span>
              </button>

              <div className="relative group">
                <button 
                  className="flex items-center gap-2 bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-700 px-3 md:px-4 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all shadow-sm"
                >
                  <FileDown size={16} />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button 
                    onClick={handleSaveAsPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                      <FileDown size={14} />
                    </div>
                    Save as PDF
                  </button>
                  <button 
                    onClick={handleSaveAsImage}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                      <ImageIcon size={14} />
                    </div>
                    Save as JPEG
                  </button>
                </div>
              </div>

              <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden md:block" />

              <div className="flex items-center gap-1">
                <button 
                  onClick={undo}
                  disabled={history.length === 0}
                  className="p-2 bg-white border-2 border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={18} />
                </button>
                <button 
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="p-2 bg-white border-2 border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={18} />
                </button>
              </div>

              {clipboard && (
                <button 
                  onClick={() => {
                    // Paste in the center of the visible area or at a default offset
                    pasteItem(100, 100);
                    setToast({ message: 'Seat pasted!', type: 'success' });
                    setTimeout(() => setToast(null), 2000);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-200 rounded-lg text-blue-600 text-sm font-bold hover:bg-blue-100 transition-all animate-pulse"
                  title="Paste copied seat"
                >
                  <ClipboardPaste size={16} /> Paste Seat
                </button>
              )}
            </div>
          </div>

          {/* Settings & Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4 mt-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsWelcomeModalOpen(true)}
                className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-black hover:bg-slate-900 transition-all shadow-md active:scale-95"
              >
                <Settings2 size={16} />
                Plan Settings
              </button>

              {isCloudSyncEnabled && (
                <div 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    isSyncing ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                  {isSyncing ? "Syncing" : "Cloud Active"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {/* Zoom control moved to bottom bar */}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => addRoomElement('board')} className="flex items-center gap-2 px-2 md:px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all">
                <Monitor size={14} /> <span className="hidden sm:inline">+ Whiteboard</span>
              </button>
              <button onClick={() => addRoomElement('door')} className="flex items-center gap-2 px-2 md:px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all">
                <DoorOpen size={14} /> <span className="hidden sm:inline">+ Door</span>
              </button>
              <button onClick={() => addRoomElement('window')} className="flex items-center gap-2 px-2 md:px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all">
                <Square size={14} /> <span className="hidden sm:inline">+ Window</span>
              </button>
              <button onClick={() => addRoomElement('aisle')} className="flex items-center gap-2 px-2 md:px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all">
                <Navigation size={14} /> <span className="hidden sm:inline">+ Aisle</span>
              </button>
              <button onClick={() => addRoomElement('other')} className="flex items-center gap-2 px-2 md:px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all">
                <Square size={14} /> <span className="hidden sm:inline">+ Other</span>
              </button>
            </div>
            
            <div className="flex-1" />
            
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all ml-auto"
            >
              <Settings2 size={16} /> Groups
            </button>
          </div>
        </header>
      )}

      {/* Print Header */}
      <div className="hidden print:block p-4 bg-white border-b-2 border-slate-200 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{yearGroup} - {subject}</h1>
            <p className="text-lg font-bold text-slate-500 mt-1">{classCode || 'NO CLASS CODE'}</p>
          </div>
        </div>
      </div>

      {isPrintMode && (
        <div className="fixed top-4 right-4 z-[100] print:hidden flex flex-col items-end gap-2">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg border border-slate-200 shadow-lg flex flex-col gap-2">
            <div className="flex gap-2">
              <button 
                onClick={() => setPrintSettings({ ...printSettings, orientation: 'portrait' })}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${printSettings.orientation === 'portrait' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Portrait
              </button>
              <button 
                onClick={() => setPrintSettings({ ...printSettings, orientation: 'landscape' })}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${printSettings.orientation === 'landscape' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Landscape
              </button>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Press <kbd className="bg-slate-100 px-1 rounded border border-slate-300">Ctrl+P</kbd> to print
            </div>
            <div className="text-[9px] text-red-500 font-bold max-w-[150px] leading-tight mt-1">
              * "Save as PDF" in Browser may be blocked in some views. Use the PDF button below.
            </div>
            <div className="h-[1px] bg-slate-100 my-1" />
            <div className="flex gap-2">
              <button 
                onClick={handleSaveAsPDF}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded text-[10px] font-bold hover:bg-slate-700 transition-all"
                title="Save this view as PDF"
              >
                <FileDown size={14} /> PDF
              </button>
              <button 
                onClick={handleSaveAsImage}
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded text-[10px] font-bold hover:bg-slate-700 transition-all"
                title="Save this view as JPEG"
              >
                <ImageIcon size={14} /> JPEG
              </button>
            </div>
          </div>
          <button 
            onClick={() => setIsPrintMode(false)}
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl hover:bg-red-700 transition-all active:scale-95"
          >
            <RotateCcw size={20} />
            Exit Print Mode
          </button>
        </div>
      )}

      {/* Main Canvas */}
      <main className={`relative p-4 md:p-8 overflow-auto h-[calc(100vh-220px)] md:h-[calc(100vh-180px)] print:p-0 print:h-auto print:overflow-visible print:static ${isPrintMode ? 'h-auto min-h-screen p-0 no-scrollbar' : ''}`}>
        <div 
          ref={canvasRef}
          className={`relative min-w-[1200px] min-h-[800px] bg-[#faf9f7] rounded-xl border-2 border-[#d4cfc8] shadow-sm print:border-none print:shadow-none print:bg-white print:static print:block ${isPrintMode ? (printSettings.orientation === 'portrait' ? 'print-scale-portrait' : 'print-scale-landscape') : ''}`}
          onContextMenu={(e) => {
            if (clipboard) {
              e.preventDefault();
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                pasteItem(e.clientX - rect.left, e.clientY - rect.top);
              }
            }
          }}
          style={{
            transform: !isPrintMode ? `scale(${zoom})` : undefined,
            transformOrigin: 'top center',
            marginBottom: !isPrintMode ? `${(zoom - 1) * 800}px` : undefined,
            marginRight: !isPrintMode ? `${(zoom - 1) * 1200}px` : undefined,
            backgroundImage: snapToGrid && !isPrintMode ? 'radial-gradient(#d4cfc8 1px, transparent 1px)' : 'none',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            paddingTop: isPrintMode ? '20px' : '0px',
            filter: isPrintMode && printSettings.grayscale ? 'grayscale(100%) contrast(1.2)' : 'none',
          }}
        >
          {/* Room Label */}
          <div className={`absolute left-8 bg-[#faf9f7] px-3 text-[10px] font-bold tracking-widest uppercase text-[#7a746c] z-10 print:bg-white print:text-black ${isPrintMode ? 'top-4' : '-top-3'}`}>
            {yearGroup} {classCode && `- ${classCode}`} | {subject}
          </div>

          {/* Paste Hint */}
          {clipboard && !isPrintMode && (
            <div className="absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold animate-bounce z-50 flex items-center gap-2">
              <ClipboardPaste size={14} />
              Right-click anywhere to paste!
            </div>
          )}

          {/* Room Elements */}
          {roomElements.map((element) => (
            <RoomElementComp 
              key={element.id}
              element={element}
              onDragEnd={(x, y) => updatePosition(element.id, x, y, false)}
              onDoubleClick={() => handleDoubleClick(element, false)}
              onDelete={() => deleteItem(element.id, false)}
              isDeleteMode={isDeleteMode}
              onCopy={() => copyElement(element)}
              onResize={(w, h) => updateSize(element.id, w, h, false)}
              isPrintMode={isPrintMode}
            />
          ))}

          {/* Seats */}
          <AnimatePresence>
            {seats.map((seat) => (
              <Seat 
                key={seat.id}
                seat={seat}
                group={groups.find(g => g.id === seat.groupId)}
                onDragEnd={(x, y) => updatePosition(seat.id, x, y, true)}
                onDoubleClick={() => handleDoubleClick(seat, true)}
                onDelete={() => deleteItem(seat.id, true)}
                isDeleteMode={isDeleteMode}
                onCopy={() => copySeat(seat)}
                onResize={(w, h) => updateSize(seat.id, w, h, true)}
                isPrintMode={isPrintMode}
              />
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-sm ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Seat Modal */}
      {isEditModalOpen && editingSeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Edit Seat Details</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Student Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={editingSeat.studentName}
                    onChange={(e) => setEditingSeat({ ...editingSeat, studentName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Enter student name..."
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Width (px)</label>
                  <input 
                    type="number" 
                    value={editingSeat.width || ''}
                    onChange={(e) => setEditingSeat({ ...editingSeat, width: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Height (px)</label>
                  <input 
                    type="number" 
                    value={editingSeat.height || ''}
                    onChange={(e) => setEditingSeat({ ...editingSeat, height: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(STATUS_CONFIG) as StudentStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setEditingSeat({ ...editingSeat, status })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        editingSeat.status === status 
                          ? `${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].border} ${STATUS_CONFIG[status].text} ring-2 ring-offset-1 ring-blue-500` 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {STATUS_CONFIG[status].icon}
                      {STATUS_CONFIG[status].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Group</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditingSeat({ ...editingSeat, groupId: undefined })}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      !editingSeat.groupId 
                        ? 'bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-offset-1 ring-blue-500' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    No Group
                  </button>
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => setEditingSeat({ ...editingSeat, groupId: group.id })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        editingSeat.groupId === group.id 
                          ? 'ring-2 ring-offset-1 ring-blue-500' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      style={{ 
                        backgroundColor: editingSeat.groupId === group.id ? `${group.color}20` : undefined,
                        borderColor: editingSeat.groupId === group.id ? group.color : undefined,
                        color: editingSeat.groupId === group.id ? group.color : undefined
                      }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="flex gap-4">
          <button 
            onClick={() => deleteItem(editingSeat.id, true)}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-semibold transition-colors"
          >
            <Trash2 size={18} />
            Delete
          </button>
          <button 
            onClick={() => {
              copySeat(editingSeat);
              setIsEditModalOpen(false);
            }}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors"
          >
            <Copy size={18} />
            Copy
          </button>
        </div>
        <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => saveSeatDetails(editingSeat)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Room Element Modal */}
      {isElementModalOpen && editingElement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Edit {editingElement.type}</h2>
              <button onClick={() => setIsElementModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Label</label>
                <input 
                  type="text" 
                  value={editingElement.label}
                  onChange={(e) => setEditingElement({ ...editingElement, label: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Enter label..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Width (px)</label>
                  <input 
                    type="number" 
                    value={editingElement.width || ''}
                    onChange={(e) => setEditingElement({ ...editingElement, width: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Height (px)</label>
                  <input 
                    type="number" 
                    value={editingElement.height || ''}
                    onChange={(e) => setEditingElement({ ...editingElement, height: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Custom Color</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={editingElement.color || (editingElement.type === 'board' ? '#1e293b' : '#e2e8f0')}
                    onChange={(e) => setEditingElement({ ...editingElement, color: e.target.value })}
                    className="w-10 h-10 rounded-lg border-none cursor-pointer overflow-hidden p-0 bg-transparent"
                  />
                  <input 
                    type="text" 
                    value={editingElement.color || ''}
                    onChange={(e) => setEditingElement({ ...editingElement, color: e.target.value })}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs uppercase"
                    placeholder="Auto by type"
                  />
                  {editingElement.color && (
                    <button 
                      onClick={() => setEditingElement({ ...editingElement, color: undefined })}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex gap-4">
                <button 
                  onClick={() => deleteItem(editingElement.id, false)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-semibold transition-colors"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
                <button 
                  onClick={() => {
                    copyElement(editingElement);
                    setIsElementModalOpen(false);
                  }}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-colors"
                >
                  <Copy size={18} />
                  Copy
                </button>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsElementModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => saveElementDetails(editingElement)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Group Management Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Manage Groups</h2>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {groups.map((group, idx) => (
                <div key={group.id} className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={group.color}
                    onChange={(e) => {
                      const newGroups = [...groups];
                      newGroups[idx].color = e.target.value;
                      setGroups(newGroups);
                    }}
                    className="w-10 h-10 rounded-lg border-none cursor-pointer overflow-hidden"
                  />
                  <input 
                    type="text" 
                    value={group.name}
                    onChange={(e) => {
                      const newGroups = [...groups];
                      newGroups[idx].name = e.target.value;
                      setGroups(newGroups);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button 
                    onClick={() => setGroups(groups.filter(g => g.id !== group.id))}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setGroups([...groups, { id: `group-${Date.now()}`, name: 'New Group', color: '#64748b' }])}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-2 font-semibold text-sm"
              >
                <Plus size={18} />
                Add New Group
              </button>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsGroupModalOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">{confirmModal.title}</h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 shadow-md transition-all active:scale-95"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Stats Summary & Zoom (Floating) */}
      {!isPrintMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200 px-4 md:px-6 py-3 rounded-2xl md:rounded-full shadow-xl flex flex-col md:flex-row items-center gap-4 md:gap-6 z-10 print:hidden max-w-[90vw]">
          <div className="flex items-center gap-4 border-r border-slate-100 pr-4 md:pr-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-[10px] md:text-xs font-bold text-slate-600">Total: {seats.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] md:text-xs font-bold text-green-600">Present: {seats.filter(s => s.status === 'present').length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[10px] md:text-xs font-bold text-red-600">Absent: {seats.filter(s => s.status === 'absent').length}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Zoom</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setZoom(prev => Math.max(0.3, prev - 0.1))}
                className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <input 
                type="range"
                min="0.3"
                max="1.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-20 md:w-24 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <button 
                onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
                className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
              <span className="text-[10px] md:text-xs font-black text-slate-500 min-w-[35px]">{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      )}
      {/* Welcome Setup Modal */}
      {isWelcomeModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20"
          >
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Settings2 size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Plan Settings</h2>
                  <p className="text-slate-500 text-sm font-medium">Manage your class information and storage</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Year Group</label>
                    <div className="relative group">
                      <select 
                        value={draftYear}
                        onChange={(e) => {
                          setDraftYear(e.target.value);
                          setIsChangingMetadata(true);
                        }}
                        className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 transition-all cursor-pointer"
                      >
                        {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Subject</label>
                    <div className="relative group">
                      <select 
                        value={draftSubject}
                        onChange={(e) => {
                          setDraftSubject(e.target.value);
                          setIsChangingMetadata(true);
                        }}
                        className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 transition-all cursor-pointer"
                      >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors" size={18} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Class Code / Group Name</label>
                  <input 
                    type="text"
                    value={draftCode}
                    onChange={(e) => {
                      setDraftCode(e.target.value.toUpperCase());
                      setIsChangingMetadata(true);
                    }}
                    placeholder="E.G. 10B/MA1"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-blue-500 transition-all uppercase placeholder:text-slate-300"
                  />
                  <p className="text-[10px] text-slate-400 ml-1 font-medium italic">Name your class to save its unique layout.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Sync PIN (Optional)</label>
                  <input 
                    type="password"
                    value={syncPin}
                    onChange={(e) => setSyncPin(e.target.value)}
                    placeholder="E.G. 1234"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-300"
                  />
                  <p className="text-[10px] text-slate-400 ml-1 font-medium italic">Enter/Set a PIN to secure your cloud sync across devices.</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border-2 border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isCloudSyncEnabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <Cloud size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">Cloud Sync</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Sync plans across all your devices</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCloudSyncEnabled(!isCloudSyncEnabled)}
                    className={`w-12 h-6 rounded-full transition-all relative ${isCloudSyncEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isCloudSyncEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-4">
                {localStorage.getItem(`seating-plan-${yearGroup}-${subject}-${classCode || 'default'}`) ? (
                  <button 
                    onClick={() => setIsWelcomeModalOpen(false)}
                    className="w-full bg-emerald-600 text-white rounded-2xl px-6 py-4 font-black text-sm hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    Resume Local Plan
                    <Save size={18} />
                  </button>
                ) : cloudPlanAvailable ? (
                  <button 
                    onClick={() => {
                      loadFromCloud();
                      setIsWelcomeModalOpen(false);
                    }}
                    className="w-full bg-blue-600 text-white rounded-2xl px-6 py-4 font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-3 animate-pulse"
                  >
                    Sync from Cloud
                    <CloudDownload size={18} />
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsWelcomeModalOpen(false)}
                    className="w-full bg-slate-800 text-white rounded-2xl px-6 py-4 font-black text-sm hover:bg-slate-900 shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    Start from Scratch
                    <Plus size={18} />
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex-1 bg-white border-2 border-slate-200 text-slate-800 rounded-2xl px-4 py-4 font-black text-xs hover:bg-slate-50 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-center group">
                    <FileUp size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    <span>Import JSON</span>
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={(e) => {
                        importTemplate(e);
                      }} 
                      className="hidden" 
                    />
                  </label>

                  <button 
                    onClick={exportTemplate}
                    className="flex-1 bg-white border-2 border-slate-200 text-slate-800 rounded-2xl px-4 py-4 font-black text-xs hover:bg-slate-50 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 group text-center"
                  >
                    <FileDown size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    <span>Export JSON</span>
                  </button>
                </div>

                <div className="h-px bg-slate-100 my-2" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button 
                    onClick={saveAsMyRoomTemplate}
                    className="flex-1 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl px-4 py-4 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex flex-col items-center gap-1"
                    title="Save current room setup as template"
                  >
                    <Save size={16} />
                    Save Room Template
                  </button>
                  <button 
                    onClick={resetAll}
                    className="flex-1 bg-red-50 border-2 border-red-100 text-red-600 rounded-2xl px-4 py-4 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all flex flex-col items-center gap-1"
                  >
                    <Trash2 size={16} />
                    Reset Everything
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                {isChangingMetadata ? (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => applyNewMetadata(true)}
                      className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all uppercase tracking-widest"
                    >
                      Move Layout
                    </button>
                    <button 
                      onClick={() => applyNewMetadata(false)}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all uppercase tracking-widest"
                    >
                      Switch Plan
                    </button>
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
                
                <button 
                  onClick={() => {
                    if (isChangingMetadata) {
                      applyNewMetadata(false);
                    } else {
                      setIsWelcomeModalOpen(false);
                    }
                  }}
                  className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-[1.2rem] font-black text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 uppercase tracking-widest"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
      )}

      {/* Print Settings Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Printer size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Print Settings</h2>
                  <p className="text-slate-500 text-sm font-medium">Customize your layout for A4 paper</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400">Orientation</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPrintSettings({ ...printSettings, orientation: 'portrait' })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${printSettings.orientation === 'portrait' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className="w-8 h-10 border-2 border-current rounded-sm flex items-start justify-center pt-1">
                        <div className="w-4 h-1 bg-current opacity-20" />
                      </div>
                      <span className="text-xs font-bold">Portrait</span>
                    </button>
                    <button 
                      onClick={() => setPrintSettings({ ...printSettings, orientation: 'landscape' })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${printSettings.orientation === 'landscape' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className="w-10 h-8 border-2 border-current rounded-sm flex items-start justify-center pt-1">
                        <div className="w-6 h-1 bg-current opacity-20" />
                      </div>
                      <span className="text-xs font-bold">Landscape</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400">Color Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPrintSettings({ ...printSettings, grayscale: false })}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${!printSettings.grayscale ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 via-green-400 to-blue-400" />
                      <span className="text-xs font-bold">Full Color</span>
                    </button>
                    <button 
                      onClick={() => setPrintSettings({ ...printSettings, grayscale: true })}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${printSettings.grayscale ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-slate-400" />
                      <span className="text-xs font-bold">Grayscale</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button 
                  onClick={() => setIsPrintModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-sm text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={triggerPrint}
                  className="flex-[2] bg-blue-600 text-white rounded-2xl px-6 py-4 font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3"
                >
                  Print Full Page
                  <Printer size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {/* Help / Guide Modal */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#faf9f7] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white">
                  <Info size={20} />
                </div>
                <h2 className="text-xl font-black text-slate-800">Teacher's Quick Guide</h2>
              </div>
              <button 
                onClick={() => setIsHelpModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 overflow-auto custom-scrollbar space-y-10">
              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#d4a84b]">Step 1: Classroom Setup</h3>
                <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm space-y-3">
                  <p className="text-slate-600 text-sm leading-relaxed">
                    When you first open the app, you'll see the <strong>Classroom Setup</strong> screen.
                  </p>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-2 ml-2">
                    <li><strong>Year Group & Subject:</strong> Helps you identify which class you're working on.</li>
                    <li><strong>Class Code:</strong> This is the <u>unique identifier</u> for your saving. Each Class Code gets its own separate layout and student list.</li>
                  </ul>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight italic">Tip: You can change these details later by clicking the names in the top header.</p>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-600">Step 2: Design Your Architecture</h3>
                <div className="space-y-3">
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Before adding students, set up your room furniture:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-2xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-sm mb-1">Add Items</h4>
                      <p className="text-xs text-slate-500">Drag desks, chairs, whiteboards, and doors from the side menu onto your classroom grid.</p>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-sm mb-1">Customize</h4>
                      <p className="text-xs text-slate-500">Double-click any item to change its label, size, or colour (e.g. making a desk yellow).</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600">Step 3: Save & Reuse Templates</h3>
                <div className="bg-emerald-50/50 p-6 rounded-3xl border-2 border-emerald-100 space-y-6">
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-lg">
                      <Save size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm uppercase">Save My Room Template</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Once your desks are exactly where you want them, click this. It "freezes" your furniture layout <strong>without</strong> student names. 
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 bg-white border-2 border-emerald-200 rounded-xl flex-shrink-0 flex items-center justify-center text-emerald-600 shadow-sm">
                      <ClipboardPaste size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm uppercase">Apply My Room</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Starting a new subject or year group? Change your Class Code, then click this to instantly "teleport" your furniture layout there so you don't have to redraw it.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Step 4: Student Lists & Groups</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">Adding Names</h4>
                    <p className="text-xs text-slate-600 mb-2">Double-click a desk and type a student's name. You can also track their <strong>Attendance</strong> or <strong>Support Needs</strong>.</p>
                  </div>
                  
                  <div className="p-4 bg-white rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">Organizing Groups</h4>
                    <p className="text-xs text-slate-600">Click <strong>Groups</strong> in the top menu to create colour-coded sets (e.g. <em>Reading A</em>). Assign students to these groups to see their desks change colour instantly.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[#4f46e5]">Step 5: Exporting & Shared Use</h3>
                <div className="p-6 bg-[#4f46e5] rounded-3xl text-white shadow-xl shadow-indigo-100">
                  <h4 className="font-bold text-base mb-2">Moving your plan between computers?</h4>
                  <p className="text-xs text-indigo-100 leading-relaxed mb-4">
                    You don't need a login or special accounts.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 p-3 rounded-xl border border-white/20">
                      <div className="font-bold text-[10px] uppercase mb-1">On Device A</div>
                      <p className="text-[11px]">Click <strong>Export</strong> to save a <strong>.json</strong> file to your downloads.</p>
                    </div>
                    <div className="bg-white/10 p-3 rounded-xl border border-white/20">
                      <div className="font-bold text-[10px] uppercase mb-1">On Device B</div>
                      <p className="text-[11px]">Click <strong>Import</strong> and select that file. Your plan opens exactly as you left it.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Step 6: Printing</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Click <strong>PDF Export</strong>. Choose <strong>Landscape</strong> for wide rooms. 
                  This creates a professional, clean document for your teacher's folder or to hand to a substitute teacher.
                </p>
              </section>
            </div>


            <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsHelpModalOpen(false)}
                className="px-6 py-3 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all shadow-lg"
              >
                Got it, thanks!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

interface SeatProps {
  key?: React.Key;
  seat: SeatData;
  group?: StudentGroup;
  onDragEnd: (x: number, y: number) => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  isDeleteMode: boolean;
  onCopy: () => void;
  onResize: (width: number, height: number) => void;
  isPrintMode: boolean;
}

function Seat({ seat, group, onDragEnd, onDoubleClick, onDelete, isDeleteMode, onCopy, onResize, isPrintMode }: SeatProps) {
  const config = STATUS_CONFIG[seat.status];
  
  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={(_, info) => {
        onDragEnd(seat.x + info.offset.x, seat.y + info.offset.y);
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: seat.x,
        y: seat.y
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onDoubleClick={onDoubleClick}
      onClick={() => {
        if (isDeleteMode) onDelete();
      }}
      className={`absolute rounded-xl border-2 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center p-2 transition-shadow hover:shadow-lg z-[1] group ${config.bg} ${config.border} print:shadow-none print:!h-auto print:min-h-[60px] ${isDeleteMode ? 'hover:border-red-500 hover:bg-red-50' : ''}`}
      style={{
        width: seat.width,
        height: seat.height,
        boxShadow: group ? `0 0 0 2px ${group.color}40, 0 4px 6px -1px rgb(0 0 0 / 0.1)` : undefined,
        borderColor: group ? group.color : undefined,
        borderWidth: group ? '3px' : '2px'
      }}
    >
      <div className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-1 shadow-sm print:hidden">
        {config.icon}
      </div>
      
      {group && (
        <div 
          className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white shadow-sm uppercase tracking-tighter"
          style={{ backgroundColor: group.color }}
        >
          {group.name}
        </div>
      )}

      <div className="flex flex-col items-center gap-1 w-full pointer-events-none">
        <div className="print:hidden">
          {config.icon}
        </div>
        <span className={`text-[11px] font-bold text-center leading-tight truncate w-full ${config.text} print:text-slate-900 print:text-[14px] print:font-black print:overflow-visible print:whitespace-normal print:break-words`}>
          {seat.studentName || 'Empty'}
        </span>
      </div>

      {isDeleteMode && (
        <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center rounded-xl pointer-events-none">
          <Trash2 size={24} className="text-red-600 opacity-50" />
        </div>
      )}

      {!isDeleteMode && (
        <div className="absolute -top-2 -left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden z-20">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onCopy(); 
            }}
            className="p-1.5 bg-blue-600 border border-blue-700 rounded-lg shadow-lg text-white hover:bg-blue-700 transition-colors"
            title="Copy Seat"
          >
            <Copy size={14} />
          </button>
        </div>
      )}

      {/* Resize Handles */}
      {!isDeleteMode && !isPrintMode && (
        <>
          {/* Edges */}
          <motion.div
            drag="x"
            dragMomentum={false}
            onDragEnd={(_, info) => onResize(seat.width + info.offset.x, seat.height)}
            className="absolute top-0 -right-1 w-2 h-full cursor-ew-resize z-30 hover:bg-blue-500/20 transition-colors"
            style={{ x: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
          <motion.div
            drag="y"
            dragMomentum={false}
            onDragEnd={(_, info) => onResize(seat.width, seat.height + info.offset.y)}
            className="absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize z-30 hover:bg-blue-500/20 transition-colors"
            style={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Corner */}
          <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => onResize(seat.width + info.offset.x, seat.height + info.offset.y)}
            className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border-2 border-blue-600 rounded-sm shadow-sm"
            style={{ x: 0, y: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )}
    </motion.div>
  );
}

interface RoomElementProps {
  key?: React.Key;
  element: RoomElement;
  onDragEnd: (x: number, y: number) => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  isDeleteMode: boolean;
  onCopy: () => void;
  onResize: (width: number, height: number) => void;
  isPrintMode: boolean;
}

function RoomElementComp({ element, onDragEnd, onDoubleClick, onDelete, isDeleteMode, onCopy, onResize, isPrintMode }: RoomElementProps) {
  const getStyles = () => {
    switch (element.type) {
      case 'door':
        return 'bg-[#f5e6c8] border-[#d4a84b] text-[#7a5a1a]';
      case 'window':
        return 'bg-[#dce8ff] border-[#85aef5] text-[#1a3570]';
      case 'aisle':
        return 'bg-slate-100 border-slate-200 text-slate-400 border-dashed';
      case 'board':
        return 'bg-white border-slate-300 text-slate-800 shadow-sm';
      case 'other':
        return 'bg-white border-slate-300 text-slate-600 border-dashed';
      default:
        return 'bg-white border-slate-200';
    }
  };

  const style: React.CSSProperties = { 
    width: element.width, 
    height: element.height 
  };
  
  if (element.color) {
    style.backgroundColor = element.color;
    // Simple luminance check for text contrast
    // Using a basic heuristic for white/dark text
    const color = element.color.replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    style.color = luminance > 0.5 ? '#1e293b' : 'white';
    style.borderColor = luminance > 0.8 ? '#cbd5e1' : (element.color === '#ffffff' ? '#cbd5e1' : 'transparent');
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={(_, info) => {
        onDragEnd(element.x + info.offset.x, element.y + info.offset.y);
      }}
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1, 
        x: element.x,
        y: element.y
      }}
      onDoubleClick={onDoubleClick}
      onClick={() => {
        if (isDeleteMode) onDelete();
      }}
      className={`absolute flex items-center justify-center rounded-lg border-2 text-[10px] font-bold uppercase tracking-widest cursor-grab active:cursor-grabbing z-0 group ${!element.color ? getStyles() : ''} ${isDeleteMode ? 'hover:border-red-500 hover:bg-red-50' : ''}`}
      style={style}
    >
      {element.label || element.type}
      
      {!isDeleteMode && (
        <div className="absolute -top-2 -left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden z-20">
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onCopy(); 
            }}
            className="p-1.5 bg-blue-600 border border-blue-700 rounded-lg shadow-lg text-white hover:bg-blue-700 transition-colors"
            title="Copy Element"
          >
            <Copy size={12} />
          </button>
        </div>
      )}

      {isDeleteMode && (
        <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center rounded-lg pointer-events-none">
          <Trash2 size={16} className="text-red-600 opacity-50" />
        </div>
      )}

      {/* Resize Handles */}
      {!isDeleteMode && !isPrintMode && (
        <>
          {/* Edges */}
          <motion.div
            drag="x"
            dragMomentum={false}
            onDragEnd={(_, info) => onResize(element.width + info.offset.x, element.height)}
            className="absolute top-0 -right-1 w-2 h-full cursor-ew-resize z-30 hover:bg-blue-500/20 transition-colors"
            style={{ x: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
          <motion.div
            drag="y"
            dragMomentum={false}
            onDragEnd={(_, info) => onResize(element.width, element.height + info.offset.y)}
            className="absolute -bottom-1 left-0 w-full h-2 cursor-ns-resize z-30 hover:bg-blue-500/20 transition-colors"
            style={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Corner */}
          <motion.div
            drag
            dragMomentum={false}
            onDragEnd={(_, info) => onResize(element.width + info.offset.x, element.height + info.offset.y)}
            className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white border-2 border-blue-600 rounded-sm shadow-sm"
            style={{ x: 0, y: 0 }}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )}
    </motion.div>
  );
}
