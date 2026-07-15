import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Calendar,
  AlertCircle,
  Trash2,
  Plus,
  CheckCircle,
  Clock,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  X,
  History,
  ArrowRight,
  ArrowUpDown,
  BookOpen,
  Info,
  CalendarCheck,
  Award,
  ListTodo,
  FileText
} from "lucide-react";
import { NOTE_TEMPLATES, NoteTemplate } from "./templates";
import { Todo, NoteHistoryItem, PriorityLevel } from "./types";

export default function App() {
  // State variables
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [history, setHistory] = useState<NoteHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("notetodone_history_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Copy status feedback
  const [copied, setCopied] = useState(false);

  // Guide panel toggle
  const [showGuide, setShowGuide] = useState(true);

  // Inline editing states
  const [editTodoId, setEditTodoId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState("");
  const inlineEditRef = useRef<HTMLInputElement>(null);

  // Rotating loading messages interval
  useEffect(() => {
    let intervalId: any;
    if (isLoading) {
      const messages = [
        "🔍 회의록에서 의미 있는 키워드를 검색하고 있습니다...",
        "📝 자유 메모에서 실질적인 '할 일'을 가려내는 중...",
        "⚡ 문맥을 통해 중요도와 우선순위(상, 중, 하)를 분석하고 있습니다...",
        "📅 '내일', '다음 주' 등의 시간 표현을 찾아 기한을 조율하는 중...",
        "✨ 오추출을 방지하기 위한 정밀 검증 필터를 적용하는 중...",
      ];
      let index = 0;
      setLoadingMessage(messages[0]);
      intervalId = setInterval(() => {
        index = (index + 1) % messages.length;
        setLoadingMessage(messages[index]);
      }, 1500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading]);

  // Sync history to Local Storage
  useEffect(() => {
    localStorage.setItem("notetodone_history_v1", JSON.stringify(history));
  }, [history]);

  // Focus input when editing starts
  useEffect(() => {
    if (editTodoId && inlineEditRef.current) {
      inlineEditRef.current.focus();
    }
  }, [editTodoId]);

  // Handle template selection
  const handleLoadTemplate = (template: NoteTemplate) => {
    setNote(template.content);
    setError(null);
    // Clear active selection to allow custom modification
    setActiveHistoryId(null);
  };

  // Convert Note to To-Dos via server API
  const handleExtractTodos = async () => {
    if (!note.trim()) {
      setError("메모 내용을 먼저 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "서버 통신 중 오류가 발생했습니다.");
      }

      const data = await response.json();
      if (!data.todos || !Array.isArray(data.todos)) {
        throw new Error("올바른 형태의 할 일 목록이 추출되지 않았습니다.");
      }

      // Map API response to our rich Todo structure
      const parsedTodos: Todo[] = data.todos.map((t: any, index: number) => ({
        id: `todo-${Date.now()}-${index}`,
        title: t.title || "할 일",
        dueDate: t.dueDate || "2026-07-17",
        dueDateExplanation: t.dueDateExplanation || "기한 관련 텍스트 감지 불가 (기본값 설정)",
        isDueDateExtracted: typeof t.isDueDateExtracted === "boolean" ? t.isDueDateExtracted : false,
        priority: (t.priority === "High" || t.priority === "Medium" || t.priority === "Low" ? t.priority : "Medium") as PriorityLevel,
        priorityExplanation: t.priorityExplanation || "기본 추천 우선순위",
        completed: false,
      }));

      setTodos(parsedTodos);

      // Create a history item
      const newHistoryItem: NoteHistoryItem = {
        id: `history-${Date.now()}`,
        title: note.trim().split("\n")[0].substring(0, 30).replace(/[[\]*#-]/g, "") || "분석된 회의록",
        note: note,
        timestamp: new Date().toISOString(),
        todos: parsedTodos,
      };

      setHistory((prev) => [newHistoryItem, ...prev]);
      setActiveHistoryId(newHistoryItem.id);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "추출 과정에서 에러가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new manual blank To-Do item
  const handleAddTodo = () => {
    const todayStr = "2026-07-14";
    const newTodo: Todo = {
      id: `manual-${Date.now()}`,
      title: "새로운 할 일 직접 입력",
      dueDate: todayStr,
      dueDateExplanation: "사용자가 수동으로 생성한 항목입니다.",
      isDueDateExtracted: false,
      priority: "Medium",
      priorityExplanation: "수동 생성 (중 기본값)",
      completed: false,
    };

    const updatedTodos = [...todos, newTodo];
    setTodos(updatedTodos);

    // If viewing an active history item, save changes to it as well
    if (activeHistoryId) {
      updateHistoryItem(activeHistoryId, updatedTodos);
    }
  };

  // Update specific history item's todos list
  const updateHistoryItem = (historyId: string, updatedTodos: Todo[]) => {
    setHistory((prev) =>
      prev.map((item) => (item.id === historyId ? { ...item, todos: updatedTodos } : item))
    );
  };

  // Delete an individual To-Do item
  const handleDeleteTodo = (todoId: string) => {
    const updated = todos.filter((t) => t.id !== todoId);
    setTodos(updated);
    if (activeHistoryId) {
      updateHistoryItem(activeHistoryId, updated);
    }
  };

  // Toggle To-Do completion
  const handleToggleTodo = (todoId: string) => {
    const updated = todos.map((t) => (t.id === todoId ? { ...t, completed: !t.completed } : t));
    setTodos(updated);
    if (activeHistoryId) {
      updateHistoryItem(activeHistoryId, updated);
    }
  };

  // Update individual property of a To-Do
  const handleUpdateTodoProperty = (todoId: string, property: keyof Todo, value: any) => {
    const updated = todos.map((t) => {
      if (t.id === todoId) {
        const item = { ...t, [property]: value };
        // If they override manually, we can set indicators
        if (property === "dueDate") {
          item.isDueDateExtracted = false;
          item.dueDateExplanation = "사용자가 날짜를 변경함";
        }
        if (property === "priority") {
          item.priorityExplanation = "사용자가 우선순위를 변경함";
        }
        return item;
      }
      return t;
    });
    setTodos(updated);
    if (activeHistoryId) {
      updateHistoryItem(activeHistoryId, updated);
    }
  };

  // Toggle inline editing mode
  const handleStartInlineEdit = (todo: Todo) => {
    setEditTodoId(todo.id);
    setEditTitleText(todo.title);
  };

  const handleSaveInlineEdit = (todoId: string) => {
    if (editTitleText.trim()) {
      handleUpdateTodoProperty(todoId, "title", editTitleText.trim());
    }
    setEditTodoId(null);
  };

  // Load a historic conversion back to work on it
  const handleLoadHistory = (item: NoteHistoryItem) => {
    setNote(item.note);
    setTodos(item.todos);
    setActiveHistoryId(item.id);
    setError(null);
  };

  // Delete history item
  const handleDeleteHistory = (e: React.MouseEvent, historyId: string) => {
    e.stopPropagation();
    setHistory((prev) => prev.filter((item) => item.id !== historyId));
    if (activeHistoryId === historyId) {
      setActiveHistoryId(null);
      setTodos([]);
    }
  };

  // Clear current active list and note workspace
  const handleClearWorkspace = () => {
    setNote("");
    setTodos([]);
    setActiveHistoryId(null);
    setError(null);
  };

  // Export current list to clipboard as Markdown
  const handleCopyMarkdown = () => {
    if (todos.length === 0) return;

    const todayStr = "2026-07-14";
    let text = `### 📝 NoteToDone 추출된 할 일 목록\n`;
    text += `*기준 일자: ${todayStr} (화)*\n\n`;

    todos.forEach((todo) => {
      const box = todo.completed ? "[x]" : "[ ]";
      const priorityLabel = todo.priority === "High" ? "상" : todo.priority === "Medium" ? "중" : "하";
      const badgeStr = todo.isDueDateExtracted ? " (AI 추천)" : "";
      text += `${box} **${todo.title}**\n`;
      text += `   - 마감일: ${todo.dueDate}${badgeStr} | 우선순위: [${priorityLabel}] (${todo.priorityExplanation})\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Counting statistics
  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const highPriorityCount = todos.filter((t) => t.priority === "High").length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans transition-colors duration-200">
      {/* Top Premium Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-200 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-display bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900 bg-clip-text text-transparent">
                NoteToDone
              </h1>
              <p className="text-xs text-slate-500 font-medium">개인용 AI 회의록 To-Do 자동 분석기</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Information */}
            <div className="hidden md:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-mono">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              <span>기준 일자: 2026-07-14 (화)</span>
            </div>

            {todos.length > 0 && (
              <button
                onClick={handleClearWorkspace}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all text-xs font-semibold text-slate-600 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                새로 시작
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT AREA: Inputs & Templates (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Helper Quick Guides (FR-1) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">NoteToDone 활용 팁</h3>
                </div>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="text-xs">{showGuide ? "접기" : "보기"}</span>
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-3"
                  >
                    <p className="text-xs text-slate-600 leading-relaxed">
                      회의록, 카톡 메시지, 또는 브레인스토밍 낙서를 자유롭게 입력하세요. 
                      아래 간단한 기호 가이드를 활용하면 추출 정확도를 더욱 높일 수 있습니다.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-50 p-3 rounded-lg border border-slate-150">
                      <div className="flex items-start gap-1.5">
                        <span className="text-indigo-600 font-bold">-</span>
                        <span className="text-slate-600">할 일 항목 목록의 시작</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-indigo-600 font-bold">*</span>
                        <span className="text-slate-600">중요 또는 긴급도 지시자</span>
                      </div>
                      <div className="flex items-start gap-1.5 col-span-2">
                        <span className="text-purple-600 font-bold">~하기</span>
                        <span className="text-slate-600">문장 끝에 행동어(전달, 작성, 피드백) 포함</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Presets / Templates */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                <BookOpen className="h-3.5 w-3.5" />
                <span>예시 메모 빠르게 불러오기</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {NOTE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleLoadTemplate(tpl)}
                    className="group flex flex-col items-start p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-200 transition-all text-left shadow-sm hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-950">
                        {tpl.title}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {tpl.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Note Input Textarea */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="meeting-note-input" className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-slate-400" />
                  회의록 및 메모 입력
                </label>
                <span className="text-xs text-slate-400 font-mono">
                  {note.length} 자
                </span>
              </div>

              <textarea
                id="meeting-note-input"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setError(null);
                }}
                placeholder="여기에 회의 중 작성한 자유로운 형태의 메모나 낙서를 붙여넣거나 입력해 주세요...
예: - 디자인 피드백 내일까지 전달하기, 급함"
                className="w-full h-80 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm leading-relaxed text-slate-800 resize-none outline-none font-sans"
              />

              {error && (
                <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleExtractTodos}
                disabled={isLoading || !note.trim()}
                className={`w-full py-4 px-6 rounded-xl flex items-center justify-center gap-2 text-white font-semibold transition-all duration-300 shadow-lg cursor-pointer ${
                  isLoading
                    ? "bg-indigo-400 cursor-not-allowed shadow-none"
                    : !note.trim()
                    ? "bg-slate-300 shadow-none cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-100 hover:scale-[1.01]"
                }`}
              >
                {isLoading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
                    />
                    <span className="text-sm">To-Do 분석 추출 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    <span>할 일 목록 추출하기 (AI 추천)</span>
                  </>
                )}
              </button>
            </div>

            {/* Loader with changing AI Messages (Usability requirement) */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-indigo-50/70 border border-indigo-150 rounded-2xl p-4 text-center shadow-sm"
                >
                  <p className="text-xs text-indigo-700 font-medium animate-pulse">
                    {loadingMessage}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Local History Sidebar/Drawer List */}
            {history.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  <History className="h-3.5 w-3.5" />
                  <span>지난 메모 변환 역사 ({history.length}개)</span>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-1 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {history.map((item) => {
                    const isSelected = activeHistoryId === item.id;
                    const dateObj = new Date(item.timestamp);
                    const timeStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}`;
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleLoadHistory(item)}
                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer text-left transition-all ${
                          isSelected
                            ? "bg-indigo-50/60 text-indigo-900 font-medium border border-indigo-100"
                            : "hover:bg-slate-50 text-slate-700 border border-transparent"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-xs font-semibold block truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            {timeStr} • 할 일 {item.todos.length}개
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteHistory(e, item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-200/80 hover:text-rose-600 transition-all text-slate-400 cursor-pointer"
                          title="히스토리 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT AREA: Extraction Results (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Header / Summary stats */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-indigo-500" />
                    AI가 분석한 할 일 목록
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    자유로운 실시간 텍스트 수정, 마감일 및 우선순위 정정이 가능합니다.
                  </p>
                </div>

                {totalCount > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150 text-center">
                      <span className="text-[10px] block font-semibold text-slate-400">진행도</span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {completedCount}/{totalCount} 완료
                      </span>
                    </div>
                    {highPriorityCount > 0 && (
                      <div className="bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 text-center">
                        <span className="text-[10px] block font-semibold text-rose-400">긴급(상)</span>
                        <span className="text-xs font-mono font-bold text-rose-700">
                          {highPriorityCount}개
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {totalCount > 0 && (
                <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* The actual list card container */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              
              <AnimatePresence initial={false}>
                {todos.length === 0 ? (
                  /* Empty state */
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-12 text-center"
                  >
                    <div className="flex flex-col items-center max-w-sm mx-auto space-y-4">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2">
                        <ListTodo className="h-7 w-7" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">
                        할 일 목록이 아직 준비되지 않았습니다
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        왼쪽 입력창에 회의록을 입력하거나 템플릿을 선택한 뒤, 
                        <strong className="text-indigo-600 font-semibold"> '할 일 목록 추출하기' </strong> 
                        버튼을 눌러 분석해 보세요!
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  /* Todos rendering */
                  <div className="divide-y divide-slate-100">
                    {todos.map((todo, idx) => (
                      <motion.div
                        key={todo.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-all ${
                          todo.completed ? "bg-slate-50/40" : ""
                        }`}
                      >
                        {/* Checkbox (Complete Trigger) */}
                        <div className="pt-1 select-none">
                          <button
                            onClick={() => handleToggleTodo(todo.id)}
                            className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                              todo.completed
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 hover:border-indigo-400 bg-white"
                            }`}
                          >
                            {todo.completed && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                          </button>
                        </div>

                        {/* Middle Action Content */}
                        <div className="flex-1 min-w-0 space-y-2.5">
                          {/* Title Inline Editing Section */}
                          <div className="flex items-center justify-between gap-2 group/title">
                            {editTodoId === todo.id ? (
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  ref={inlineEditRef}
                                  type="text"
                                  value={editTitleText}
                                  onChange={(e) => setEditTitleText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveInlineEdit(todo.id);
                                    if (e.key === "Escape") setEditTodoId(null);
                                  }}
                                  onBlur={() => handleSaveInlineEdit(todo.id)}
                                  className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-indigo-400 rounded px-2.5 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
                                />
                                <button
                                  onClick={() => handleSaveInlineEdit(todo.id)}
                                  className="px-2 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-500 cursor-pointer"
                                >
                                  저장
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 w-full">
                                <span
                                  onClick={() => handleStartInlineEdit(todo)}
                                  className={`text-sm font-semibold cursor-pointer select-none leading-snug break-words pr-2 hover:bg-indigo-50 hover:text-indigo-900 px-1 py-0.5 rounded transition-all flex-1 ${
                                    todo.completed
                                      ? "text-slate-400 line-through decoration-slate-300"
                                      : "text-slate-800"
                                  }`}
                                  title="클릭하여 할 일 편집"
                                >
                                  {todo.title}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Details Row: Due Date + Priority (FR-4 & FR-2, FR-3) */}
                          <div className="flex flex-wrap items-center gap-y-3 gap-x-4 pt-1 text-xs">
                            
                            {/* Deadline Picker Column */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-medium">마감일:</span>
                              <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors border border-slate-200">
                                <Calendar className="h-3 w-3 text-indigo-500" />
                                <input
                                  type="date"
                                  value={todo.dueDate}
                                  onChange={(e) =>
                                    handleUpdateTodoProperty(todo.id, "dueDate", e.target.value)
                                  }
                                  className="bg-transparent border-none text-[11px] font-mono text-slate-700 outline-none p-0 cursor-pointer"
                                />
                              </div>

                              {/* AI Recommended Badge */}
                              {todo.isDueDateExtracted ? (
                                <span
                                  className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 cursor-help"
                                  title={todo.dueDateExplanation}
                                >
                                  <Sparkles className="h-2.5 w-2.5" />
                                  AI 추천
                                </span>
                              ) : (
                                <span
                                  className="bg-slate-50 text-slate-500 border border-slate-150 px-2 py-0.5 rounded-md text-[10px] font-medium inline-flex items-center gap-1 cursor-help"
                                  title={todo.dueDateExplanation}
                                >
                                  {todo.dueDateExplanation.includes("사용자") ? "수동 지정" : "Fallback"}
                                </span>
                              )}
                            </div>

                            {/* Priority Selection Dropdown (FR-3, FR-4) */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-medium">우선순위:</span>
                              <select
                                value={todo.priority}
                                onChange={(e) =>
                                  handleUpdateTodoProperty(
                                    todo.id,
                                    "priority",
                                    e.target.value as PriorityLevel
                                  )
                                }
                                  className={`px-2 py-1 rounded-lg border text-xs font-bold font-sans outline-none cursor-pointer transition-all ${
                                    todo.priority === "High"
                                      ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                                      : todo.priority === "Low"
                                      ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                                      : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                  }`}
                                  title={todo.priorityExplanation}
                                >
                                  <option value="High">🔴 상</option>
                                  <option value="Medium">🟡 중</option>
                                  <option value="Low">🔵 하</option>
                                </select>
                                
                                {/* Info icon for priority reason */}
                                <span
                                  className="text-slate-400 hover:text-slate-600 cursor-help p-0.5 rounded transition-all"
                                  title={todo.priorityExplanation}
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </span>
                            </div>

                          </div>
                        </div>

                        {/* Right Actions: Delete */}
                        <div className="self-center">
                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title="할 일 삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>

              {/* Action buttons at the bottom of the list */}
              {todos.length > 0 && (
                <div className="p-4 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                  
                  {/* Copy & Share actions */}
                  <button
                    onClick={handleCopyMarkdown}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>복사 완료!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>텍스트(Markdown)로 복사</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Clear all */}
                    <button
                      onClick={() => {
                        setTodos([]);
                        if (activeHistoryId) updateHistoryItem(activeHistoryId, []);
                      }}
                      className="w-1/2 sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      전체 삭제
                    </button>

                    {/* Add manual todo */}
                    <button
                      onClick={handleAddTodo}
                      className="w-1/2 sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-indigo-100 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>할 일 직접 추가</span>
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Custom Guide explaining calculations (Honest Architectural label - clean human labels) */}
            <div className="bg-slate-100/50 rounded-2xl border border-slate-200 p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-slate-500" />
                추천 로직 설계 안내
              </h4>
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  <strong>날짜 계산 규칙:</strong> 메모에 명시된 요일이나 일정을 시스템 기준 시점(2026년 7월 14일)을 기반으로 환산합니다. 
                  기한이 감지되지 않는 경우 할 일을 놓치지 않도록 기본값(오늘+3일)로 우선 배치해 둡니다.
                </p>
                <p>
                  <strong>우선순위 가중치:</strong> 긴급도를 나타내는 어조나 명시적 문장 맥락을 감안해 상[🔴]/중[🟡]/하[🔵]를 배정합니다. 언제든 우선순위 배지를 눌러 변경해 보세요.
                </p>
              </div>
            </div>

          </div>
          
        </div>
      </main>

      {/* Modern Compact Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>NoteToDone &copy; 2026 • 개인용 비정형 미팅록 To-Do 변환기</span>
          <span className="font-mono bg-slate-50 border border-slate-150 px-2 py-1 rounded text-slate-500">
            Engine: Gemini 3.5 Flash Model
          </span>
        </div>
      </footer>
    </div>
  );
}
