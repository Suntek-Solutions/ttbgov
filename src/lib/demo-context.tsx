"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface DemoContextType {
  demoMode: boolean;
  toggleDemoMode: () => void;
  debugLogs: string[];
  addLog: (message: string) => void;
  clearLogs: () => void;
}

const DemoContext = createContext<DemoContextType | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const toggleDemoMode = () => setDemoMode((prev) => !prev);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const clearLogs = () => setDebugLogs([]);

  return (
    <DemoContext.Provider
      value={{ demoMode, toggleDemoMode, debugLogs, addLog, clearLogs }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
