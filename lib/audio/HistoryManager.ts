/**
 * Comprehensive Undo/Redo System
 * Supports 100+ actions with visual history and selective undo
 */

export interface HistoryAction {
  id: string;
  type: string;
  timestamp: number;
  description: string;
  trackId?: string;
  data: any;
  inverse: any;
}

export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxHistorySize = 100;
  private listeners: Set<() => void> = new Set();

  addAction(action: Omit<HistoryAction, 'id' | 'timestamp'>) {
    const historyAction: HistoryAction = {
      ...action,
      id: `action-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    };

    this.undoStack.push(historyAction);
    this.redoStack = []; // Clear redo stack on new action

    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }

    this.notifyListeners();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): HistoryAction | null {
    const action = this.undoStack.pop();
    if (!action) return null;

    this.redoStack.push(action);
    this.notifyListeners();
    return action;
  }

  redo(): HistoryAction | null {
    const action = this.redoStack.pop();
    if (!action) return null;

    this.undoStack.push(action);
    this.notifyListeners();
    return action;
  }

  // Selective undo - undo actions for specific track
  undoForTrack(trackId: string): HistoryAction | null {
    const index = [...this.undoStack].reverse().findIndex(a => a.trackId === trackId);
    if (index === -1) return null;

    const actualIndex = this.undoStack.length - 1 - index;
    const action = this.undoStack.splice(actualIndex, 1)[0];
    this.redoStack.push(action);
    this.notifyListeners();
    return action;
  }

  getHistory(): HistoryAction[] {
    return [...this.undoStack];
  }

  getRedoHistory(): HistoryAction[] {
    return [...this.redoStack];
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  // Persistence
  serialize(): string {
    return JSON.stringify({
      undoStack: this.undoStack,
      redoStack: this.redoStack
    });
  }

  deserialize(data: string) {
    try {
      const parsed = JSON.parse(data);
      this.undoStack = parsed.undoStack || [];
      this.redoStack = parsed.redoStack || [];
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to deserialize history:', error);
    }
  }

  // Listeners for UI updates
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}
