"use client";

import { useDemo } from "@/lib/demo-context";

export function DebugConsole() {
  const { demoMode, debugLogs, clearLogs } = useDemo();

  if (!demoMode) return null;

  return (
    <>
      {/* Spacer to prevent fixed console from covering page content */}
      <div className="h-[180px]" />
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-300 bg-gray-900 text-gray-100">
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-1.5">
          <span className="text-xs font-medium text-gray-400">
            Debug Console ({debugLogs.length} entries)
          </span>
          <button
            onClick={clearLogs}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        </div>
        <div className="max-h-[150px] overflow-y-auto px-4 py-2 font-mono text-xs">
          {debugLogs.length === 0 ? (
            <p className="text-gray-500">
              Waiting for activity... Upload a label or run verification to see
              debug output here.
            </p>
          ) : (
            debugLogs.map((log, i) => (
              <div key={i} className="py-0.5 text-green-400">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
