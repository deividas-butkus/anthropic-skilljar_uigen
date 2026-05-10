import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, cleanup, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const pushMock = vi.fn();
const signInActionMock = vi.fn();
const signUpActionMock = vi.fn();
const getAnonWorkDataMock = vi.fn();
const clearAnonWorkMock = vi.fn();
const getProjectsMock = vi.fn();
const createProjectMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => signInActionMock(...args),
  signUp: (...args: unknown[]) => signUpActionMock(...args),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => getAnonWorkDataMock(),
  clearAnonWork: () => clearAnonWorkMock(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: () => getProjectsMock(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => createProjectMock(...args),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAnonWorkDataMock.mockReturnValue(null);
    getProjectsMock.mockResolvedValue([]);
    createProjectMock.mockResolvedValue({ id: "new-project" });
  });

  afterEach(() => {
    cleanup();
  });

  test("initial state: not loading, exposes signIn and signUp", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });

  describe("signIn", () => {
    test("returns failure result and does not redirect when sign-in fails", async () => {
      signInActionMock.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("a@b.com", "wrong");
      });

      expect(returned).toEqual({ success: false, error: "Invalid credentials" });
      expect(signInActionMock).toHaveBeenCalledWith("a@b.com", "wrong");
      expect(pushMock).not.toHaveBeenCalled();
      expect(createProjectMock).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    test("toggles isLoading during the call", async () => {
      let resolveSignIn: (v: unknown) => void = () => {};
      signInActionMock.mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<unknown>;
      act(() => {
        signInPromise = result.current.signIn("a@b.com", "pw");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveSignIn({ success: false });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("clears isLoading even when the action throws", async () => {
      signInActionMock.mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("a@b.com", "pw");
        })
      ).rejects.toThrow("boom");

      expect(result.current.isLoading).toBe(false);
    });

    test("on success with anon work: creates a project from it, clears anon work, and redirects", async () => {
      signInActionMock.mockResolvedValue({ success: true });
      getAnonWorkDataMock.mockReturnValue({
        messages: [{ role: "user", content: "hi" }],
        fileSystemData: { "/foo.tsx": { type: "file", content: "x" } },
      });
      createProjectMock.mockResolvedValue({ id: "anon-project" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pw");
      });

      expect(createProjectMock).toHaveBeenCalledTimes(1);
      const args = createProjectMock.mock.calls[0][0];
      expect(args.messages).toEqual([{ role: "user", content: "hi" }]);
      expect(args.data).toEqual({
        "/foo.tsx": { type: "file", content: "x" },
      });
      expect(typeof args.name).toBe("string");
      expect(args.name).toMatch(/^Design from /);

      expect(clearAnonWorkMock).toHaveBeenCalledTimes(1);
      expect(getProjectsMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/anon-project");
    });

    test("ignores anon work when messages array is empty and falls back to existing project", async () => {
      signInActionMock.mockResolvedValue({ success: true });
      getAnonWorkDataMock.mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      getProjectsMock.mockResolvedValue([
        { id: "p1" },
        { id: "p2" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pw");
      });

      expect(clearAnonWorkMock).not.toHaveBeenCalled();
      expect(createProjectMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/p1");
    });

    test("on success with no anon work: redirects to most recent existing project", async () => {
      signInActionMock.mockResolvedValue({ success: true });
      getAnonWorkDataMock.mockReturnValue(null);
      getProjectsMock.mockResolvedValue([
        { id: "recent" },
        { id: "older" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pw");
      });

      expect(createProjectMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/recent");
    });

    test("on success with no anon work and no projects: creates a new project and redirects", async () => {
      signInActionMock.mockResolvedValue({ success: true });
      getAnonWorkDataMock.mockReturnValue(null);
      getProjectsMock.mockResolvedValue([]);
      createProjectMock.mockResolvedValue({ id: "fresh" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pw");
      });

      expect(createProjectMock).toHaveBeenCalledTimes(1);
      const args = createProjectMock.mock.calls[0][0];
      expect(args.messages).toEqual([]);
      expect(args.data).toEqual({});
      expect(args.name).toMatch(/^New Design #\d+$/);
      expect(clearAnonWorkMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/fresh");
    });
  });

  describe("signUp", () => {
    test("returns failure result and does not redirect when sign-up fails", async () => {
      signUpActionMock.mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("a@b.com", "pw");
      });

      expect(returned).toEqual({
        success: false,
        error: "Email already registered",
      });
      expect(signUpActionMock).toHaveBeenCalledWith("a@b.com", "pw");
      expect(pushMock).not.toHaveBeenCalled();
      expect(createProjectMock).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    test("on success runs the same post-auth flow (anon work path)", async () => {
      signUpActionMock.mockResolvedValue({ success: true });
      getAnonWorkDataMock.mockReturnValue({
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: {},
      });
      createProjectMock.mockResolvedValue({ id: "anon-project" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("a@b.com", "pw");
      });

      expect(clearAnonWorkMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/anon-project");
    });

    test("clears isLoading even when the action throws", async () => {
      signUpActionMock.mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("a@b.com", "pw");
        })
      ).rejects.toThrow("boom");

      expect(result.current.isLoading).toBe(false);
    });
  });
});
