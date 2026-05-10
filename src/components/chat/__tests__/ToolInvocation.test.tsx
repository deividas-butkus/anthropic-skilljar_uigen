import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocation } from "../ToolInvocation";

afterEach(() => {
  cleanup();
});

test("str_replace_editor + create + completed renders 'Created' and basename", () => {
  render(
    <ToolInvocation
      tool={{
        toolName: "str_replace_editor",
        state: "result",
        args: { command: "create", path: "/components/Card.tsx" },
        result: "ok",
      }}
    />
  );

  expect(screen.getByText("Created")).toBeDefined();
  expect(screen.getByText("Card.tsx")).toBeDefined();
  expect(screen.getByLabelText("completed")).toBeDefined();
});

test("str_replace_editor + str_replace + in-progress renders 'Editing' and spinner", () => {
  const { container } = render(
    <ToolInvocation
      tool={{
        toolName: "str_replace_editor",
        state: "call",
        args: { command: "str_replace", path: "/components/Card.tsx" },
      }}
    />
  );

  expect(screen.getByText("Editing")).toBeDefined();
  expect(screen.getByText("Card.tsx")).toBeDefined();
  expect(screen.getByLabelText("in progress")).toBeDefined();
  expect(container.querySelector(".animate-spin")).not.toBeNull();
});

test("str_replace_editor + view renders 'Reading'", () => {
  render(
    <ToolInvocation
      tool={{
        toolName: "str_replace_editor",
        state: "call",
        args: { command: "view", path: "/index.tsx" },
      }}
    />
  );

  expect(screen.getByText("Reading")).toBeDefined();
  expect(screen.getByText("index.tsx")).toBeDefined();
});

test("file_manager + rename + completed renders both basenames joined by an arrow", () => {
  render(
    <ToolInvocation
      tool={{
        toolName: "file_manager",
        state: "result",
        args: {
          command: "rename",
          path: "/components/Old.tsx",
          new_path: "/components/New.tsx",
        },
        result: { success: true },
      }}
    />
  );

  expect(screen.getByText("Renamed")).toBeDefined();
  expect(screen.getByText("Old.tsx")).toBeDefined();
  expect(screen.getByText("New.tsx")).toBeDefined();
  expect(screen.getByText("→")).toBeDefined();
});

test("file_manager + delete + completed renders 'Deleted'", () => {
  render(
    <ToolInvocation
      tool={{
        toolName: "file_manager",
        state: "result",
        args: { command: "delete", path: "/components/Stale.tsx" },
        result: { success: true },
      }}
    />
  );

  expect(screen.getByText("Deleted")).toBeDefined();
  expect(screen.getByText("Stale.tsx")).toBeDefined();
});

test("missing args.path renders fallback 'Working…' without throwing", () => {
  render(
    <ToolInvocation
      tool={{
        toolName: "str_replace_editor",
        state: "partial-call",
        args: {},
      }}
    />
  );

  expect(screen.getByText("Working…")).toBeDefined();
});

test("unknown tool name falls back to raw tool name", () => {
  render(
    <ToolInvocation
      tool={{
        toolName: "mystery_tool",
        state: "call",
        args: {},
      }}
    />
  );

  expect(screen.getByText("Using")).toBeDefined();
  expect(screen.getByText("mystery_tool")).toBeDefined();
});

test("full path is exposed via the title attribute on the file name", () => {
  render(
    <ToolInvocation
      tool={{
        toolName: "str_replace_editor",
        state: "result",
        args: { command: "create", path: "/deeply/nested/dir/Card.tsx" },
        result: "ok",
      }}
    />
  );

  const fileName = screen.getByText("Card.tsx");
  expect(fileName.getAttribute("title")).toBe("/deeply/nested/dir/Card.tsx");
});
