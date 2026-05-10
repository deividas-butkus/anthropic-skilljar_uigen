import { Loader2 } from "lucide-react";

interface ToolInvocationPart {
  toolName: string;
  state: "partial-call" | "call" | "result";
  args?: {
    command?: string;
    path?: string;
    new_path?: string;
    [k: string]: unknown;
  };
  result?: unknown;
}

interface ToolInvocationProps {
  tool: ToolInvocationPart;
}

const STR_REPLACE_VERBS: Record<string, [string, string]> = {
  create: ["Creating", "Created"],
  str_replace: ["Editing", "Edited"],
  insert: ["Editing", "Edited"],
  view: ["Reading", "Read"],
  undo_edit: ["Reverting", "Reverted"],
};

const FILE_MANAGER_VERBS: Record<string, [string, string]> = {
  rename: ["Renaming", "Renamed"],
  delete: ["Deleting", "Deleted"],
};

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

interface Label {
  verb: string;
  fileName?: string;
  fullPath?: string;
  secondaryName?: string;
  secondaryPath?: string;
}

function getLabel(tool: ToolInvocationPart): Label {
  const done = tool.state === "result";
  const args = tool.args ?? {};
  const path = typeof args.path === "string" ? args.path : undefined;
  const newPath = typeof args.new_path === "string" ? args.new_path : undefined;
  const command = typeof args.command === "string" ? args.command : undefined;

  if (tool.toolName === "str_replace_editor") {
    if (!command || !path) return { verb: done ? "Done" : "Working…" };
    const verbs = STR_REPLACE_VERBS[command];
    if (!verbs) return { verb: done ? "Used" : "Using", fileName: tool.toolName };
    return {
      verb: verbs[done ? 1 : 0],
      fileName: basename(path),
      fullPath: path,
    };
  }

  if (tool.toolName === "file_manager") {
    if (!command || !path) return { verb: done ? "Done" : "Working…" };
    const verbs = FILE_MANAGER_VERBS[command];
    if (!verbs) return { verb: done ? "Used" : "Using", fileName: tool.toolName };
    if (command === "rename" && newPath) {
      return {
        verb: verbs[done ? 1 : 0],
        fileName: basename(path),
        fullPath: path,
        secondaryName: basename(newPath),
        secondaryPath: newPath,
      };
    }
    return {
      verb: verbs[done ? 1 : 0],
      fileName: basename(path),
      fullPath: path,
    };
  }

  return { verb: done ? "Used" : "Using", fileName: tool.toolName };
}

export function ToolInvocation({ tool }: ToolInvocationProps) {
  const done = tool.state === "result";
  const label = getLabel(tool);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {done ? (
        <div
          className="w-2 h-2 rounded-full bg-emerald-500"
          aria-label="completed"
        />
      ) : (
        <Loader2
          className="w-3 h-3 animate-spin text-blue-600"
          aria-label="in progress"
        />
      )}
      <span className="text-neutral-700">{label.verb}</span>
      {label.fileName && (
        <span className="font-mono text-neutral-900" title={label.fullPath}>
          {label.fileName}
        </span>
      )}
      {label.secondaryName && (
        <>
          <span className="text-neutral-500">→</span>
          <span
            className="font-mono text-neutral-900"
            title={label.secondaryPath}
          >
            {label.secondaryName}
          </span>
        </>
      )}
    </div>
  );
}
