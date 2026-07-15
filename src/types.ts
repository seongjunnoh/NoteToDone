export type PriorityLevel = "High" | "Medium" | "Low";

export interface Todo {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueDateExplanation: string;
  isDueDateExtracted: boolean;
  priority: PriorityLevel;
  priorityExplanation: string;
  completed: boolean;
}

export interface NoteHistoryItem {
  id: string;
  title: string;
  note: string;
  timestamp: string;
  todos: Todo[];
}
