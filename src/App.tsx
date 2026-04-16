/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Undo2,
  Redo2
} from 'lucide-react';
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

export default function App() {
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [roomElements, setRoomElements] = useState<RoomElement[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>(DEFAULT_GROUPS);
  const [yearGroup, setYearGroup] = useState(YEAR_GROUPS[0]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [classCode, setClassCode] = useState('');
  const [editingSeat, setEditingSeat] = useState<SeatData | null>(null);
  const [editingElement, setEditingElement] = useState<RoomElement | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isElementModalOpen, setIsElementModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [history, setHistory] = useState<ClassroomState[]>([]);
  const [redoStack, setRedoStack] = useState<ClassroomState[]>([]);
  const [clipboard, setClipboard] = useState<Partial<SeatData> | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
      studentName: seat.studentName,
      status: seat.status,
      groupId: seat.groupId,
      width: seat.width,
      height: seat.height
    });
    setToast({ message: 'Seat copied to clipboard!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const pasteSeat = (x: number, y: number) => {
    if (!clipboard) return;
    saveToHistory();
    const newSeat: SeatData = {
      id: `seat-${Date.now()}`,
      studentName: clipboard.studentName || '',
      status: clipboard.status || 'empty',
      groupId: clipboard.groupId,
      x: snapToGrid ? Math.round(x / GRID_SIZE) * GRID_SIZE : x,
      y: snapToGrid ? Math.round(y / GRID_SIZE) * GRID_SIZE : y,
      width: clipboard.width || 100,
      height: clipboard.height || 70
    };
    setSeats([...seats, newSeat]);
  };

  const exportTemplate = () => {
    const template = {
      seats: seats.map(s => ({ ...s, studentName: '', status: 'empty', groupId: undefined })),
      roomElements,
      groups
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-template-${subject}-${yearGroup}.json`;
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
          title: 'Import Layout Template',
          message: 'This will replace your current layout with the template. Student names will be cleared. Continue?',
          onConfirm: () => {
            saveToHistory();
            setSeats(data.seats.map((s: any) => ({ ...s, id: `seat-${Math.random()}` })));
            setRoomElements(data.roomElements.map((e: any) => ({ ...e, id: `element-${Math.random()}` })));
            if (data.groups) setGroups(data.groups);
            setConfirmModal(null);
          }
        });
      } catch (err) {
        console.error('Failed to parse template', err);
      }
    };
    reader.readAsText(file);
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
      width: type === 'aisle' ? 40 : 100,
      height: type === 'aisle' ? 200 : 40,
      label: type.charAt(0).toUpperCase() + type.slice(1)
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
    setIsPrintMode(true);
    // Give the UI a moment to update before triggering the print dialog
    setTimeout(() => {
      window.focus();
      window.print();
    }, 500);
  };

  return (
    <div className={`min-h-screen bg-[#f0ede8] text-[#1a1816] font-mono selection:bg-blue-100 print:bg-white print:text-black ${isPrintMode ? 'bg-white' : ''} print:h-auto print:block print:overflow-visible`}>
      <style>
        {`
          @media print {
            @page {
              size: A4 ${printOrientation};
              margin: 5mm;
            }
          }
        `}
      </style>
      {/* Header */}
      {!isPrintMode && (
        <header className="px-8 py-6 max-w-[1400px] mx-auto print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-6 mb-2">
            <div className="flex flex-col">
              <h1 className="text-4xl font-extrabold tracking-tighter uppercase font-sans">
                Classroom Seating Plan
              </h1>
              <p className="text-xs text-[#7a746c] mt-1">
                Double-click to edit • Drag to move • Click to delete (in delete mode)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xs text-[#7a746c]">Colour key:</span>
                {(Object.keys(STATUS_CONFIG) as StudentStatus[]).map(status => (
                  <div key={status} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].border}`} title={STATUS_CONFIG[status].label}>
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_CONFIG[status].color }} />
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setIsDeleteMode(!isDeleteMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border-2 ${isDeleteMode ? 'bg-red-50 border-red-400 text-red-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Trash2 size={16} />
                {isDeleteMode ? 'Delete mode ON' : 'Delete mode'}
              </button>

              <button 
                onClick={addSeat}
                className="flex items-center gap-2 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              >
                <Plus size={16} />
                + Add seat
              </button>

              <button 
                onClick={() => { 
                  setConfirmModal({
                    isOpen: true,
                    title: 'Load Draft Layout',
                    message: 'Load 25-seat draft layout? Current layout will be lost.',
                    onConfirm: () => {
                      saveToHistory();
                      loadDraftLayout();
                      setConfirmModal(null);
                    }
                  });
                }}
                className="px-4 py-2 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-all"
              >
                Load Draft
              </button>

              <button 
                onClick={resetAll}
                className="px-4 py-2 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-all"
              >
                Reset All
              </button>

              <div className="h-8 w-[1px] bg-slate-200 mx-1" />

              <button 
                onClick={exportTemplate}
                className="flex items-center gap-2 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                title="Export Layout Template"
              >
                <FileDown size={16} />
                Export
              </button>

              <label className="flex items-center gap-2 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer" title="Import Layout Template">
                <FileUp size={16} />
                Import
                <input type="file" accept=".json" onChange={importTemplate} className="hidden" />
              </label>

              <div className="h-8 w-[1px] bg-slate-200 mx-1" />

              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-[#1a1816] text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all"
              >
                <Printer size={16} />
                Print
              </button>

              <div className="h-8 w-[1px] bg-slate-200 mx-1" />

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
                    pasteSeat(100, 100);
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

          {/* Metadata Dropdowns */}
          <div className="flex items-center gap-4 mt-4">
            <div className="relative group">
              <select 
                value={yearGroup}
                onChange={(e) => {
                  saveToHistory();
                  setYearGroup(e.target.value);
                }}
                className="appearance-none bg-white border-2 border-slate-200 rounded-lg px-4 py-2 pr-10 text-sm font-bold outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                {YEAR_GROUPS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={16} />
            </div>

            <div className="relative group">
              <select 
                value={subject}
                onChange={(e) => {
                  saveToHistory();
                  setSubject(e.target.value);
                }}
                className="appearance-none bg-white border-2 border-slate-200 rounded-lg px-4 py-2 pr-10 text-sm font-bold outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={16} />
            </div>

            <div className="relative">
              <input 
                type="text"
                value={classCode}
                onFocus={() => saveToHistory()}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="CLASS CODE"
                className="bg-white border-2 border-slate-200 rounded-lg px-4 py-2 text-sm font-bold outline-none focus:border-blue-500 transition-all w-32 uppercase placeholder:text-slate-300"
              />
            </div>

            <div className="h-6 w-[1px] bg-slate-300 mx-2" />

            <div className="flex items-center gap-2">
              <button onClick={() => addRoomElement('door')} className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                <DoorOpen size={14} /> + Door
              </button>
              <button onClick={() => addRoomElement('window')} className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                <Square size={14} /> + Window
              </button>
              <button onClick={() => addRoomElement('aisle')} className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                <Navigation size={14} /> + Aisle
              </button>
              <button onClick={() => addRoomElement('other')} className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">
                <Square size={14} /> + Other
              </button>
            </div>
            
            <div className="flex-1" />
            
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
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
            <div className="text-xs font-bold text-slate-600">
              Print Settings (Default: A4 Portrait)
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPrintOrientation('portrait')}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${printOrientation === 'portrait' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Portrait
              </button>
              <button 
                onClick={() => setPrintOrientation('landscape')}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${printOrientation === 'landscape' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Landscape
              </button>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Press <kbd className="bg-slate-100 px-1 rounded border border-slate-300">Ctrl+P</kbd> to print
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
      <main className={`relative p-8 overflow-auto h-[calc(100vh-180px)] print:p-0 print:h-auto print:overflow-visible print:static ${isPrintMode ? 'h-auto min-h-screen p-0 no-scrollbar' : ''}`}>
        <div 
          ref={canvasRef}
          className={`relative min-w-[1200px] min-h-[800px] bg-[#faf9f7] rounded-xl border-2 border-[#d4cfc8] shadow-sm print:border-none print:shadow-none print:min-w-0 print:min-h-0 mx-auto print:bg-white print:static print:block print:w-full ${printOrientation === 'portrait' ? 'print-scale-portrait' : 'print-scale-landscape'}`}
          onContextMenu={(e) => {
            if (clipboard) {
              e.preventDefault();
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                pasteSeat(e.clientX - rect.left, e.clientY - rect.top);
              }
            }
          }}
          style={{
            backgroundImage: snapToGrid ? 'radial-gradient(#d4cfc8 1px, transparent 1px)' : 'none',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
          }}
        >
          {/* Room Label */}
          <div className="absolute -top-3 left-8 bg-[#faf9f7] px-3 text-[10px] font-bold tracking-widest uppercase text-[#7a746c] z-10 print:bg-white print:text-black">
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
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        editingSeat.status === status 
                          ? `${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].border} ${STATUS_CONFIG[status].text} ring-2 ring-offset-1 ring-blue-500` 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={STATUS_CONFIG[status].label}
                    >
                      {STATUS_CONFIG[status].icon}
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
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => deleteItem(editingElement.id, false)}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-semibold transition-colors"
              >
                <Trash2 size={18} />
                Delete Element
              </button>
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

      {/* Stats Summary (Floating) */}
      {!isPrintMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-slate-200 px-6 py-3 rounded-full shadow-xl flex items-center gap-6 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-xs font-bold text-slate-600">Total: {seats.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-bold text-green-600">Present: {seats.filter(s => s.status === 'present').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-bold text-red-600">Absent: {seats.filter(s => s.status === 'absent').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-amber-600">Focus: {seats.filter(s => s.status === 'focus').length}</span>
          </div>
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
}

function Seat({ seat, group, onDragEnd, onDoubleClick, onDelete, isDeleteMode, onCopy }: SeatProps) {
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
}

function RoomElementComp({ element, onDragEnd, onDoubleClick, onDelete, isDeleteMode }: RoomElementProps) {
  const getStyles = () => {
    switch (element.type) {
      case 'door':
        return 'bg-[#f5e6c8] border-[#d4a84b] text-[#7a5a1a]';
      case 'window':
        return 'bg-[#dce8ff] border-[#85aef5] text-[#1a3570]';
      case 'aisle':
        return 'bg-slate-100 border-slate-200 text-slate-400 border-dashed';
      case 'board':
        return 'bg-slate-800 border-slate-900 text-white';
      case 'other':
        return 'bg-white border-slate-300 text-slate-600 border-dashed';
      default:
        return 'bg-white border-slate-200';
    }
  };

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
      className={`absolute flex items-center justify-center rounded-lg border-2 text-[10px] font-bold uppercase tracking-widest cursor-grab active:cursor-grabbing z-0 ${getStyles()} ${isDeleteMode ? 'hover:border-red-500 hover:bg-red-50' : ''}`}
      style={{ width: element.width, height: element.height }}
    >
      {element.label || element.type}
      {isDeleteMode && (
        <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center rounded-lg pointer-events-none">
          <Trash2 size={16} className="text-red-600 opacity-50" />
        </div>
      )}
    </motion.div>
  );
}
