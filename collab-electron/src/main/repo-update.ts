import { app, BrowserWindow, ipcMain } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RepoUpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "behind"
  | "pulling"
  | "error";

export interface RepoUpdateState {
  status: RepoUpdateStatus;
  behindCount?: number;
  error?: string;
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 5_000;
const GIT_TIMEOUT_MS = 15_000;

class RepoUpdateManager {
  private state: RepoUpdateState = { status: "idle" };
  private checkInterval: NodeJS.Timeout | null = null;
  private cwd = process.cwd();

  init(): void {
    // Only meaningful when running from source (`bun run dev`) — a
    // packaged build isn't sitting in a git checkout that can be pulled.
    if (app.isPackaged) return;
    setTimeout(() => this.check(), INITIAL_CHECK_DELAY_MS);
    this.checkInterval = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  async check(): Promise<void> {
    if (this.state.status === "checking" || this.state.status === "pulling") {
      return;
    }
    this.setState({ status: "checking" });

    try {
      await execFileAsync("git", ["fetch", "--quiet"], {
        cwd: this.cwd,
        timeout: GIT_TIMEOUT_MS,
      });
      const { stdout } = await execFileAsync(
        "git",
        ["rev-list", "--count", "HEAD..@{u}"],
        { cwd: this.cwd, timeout: GIT_TIMEOUT_MS },
      );
      const behindCount = parseInt(stdout.trim(), 10) || 0;
      this.setState(
        behindCount > 0
          ? { status: "behind", behindCount, error: undefined }
          : { status: "up-to-date", behindCount: 0, error: undefined },
      );
    } catch {
      // No upstream configured, not a repo, or offline — stay quiet
      // rather than nagging about something the user can't act on.
      this.setState({ status: "idle", behindCount: undefined, error: undefined });
    }
  }

  async pull(): Promise<void> {
    if (this.state.status !== "behind") return;
    this.setState({ status: "pulling" });

    try {
      await execFileAsync("git", ["pull", "--ff-only"], {
        cwd: this.cwd,
        timeout: GIT_TIMEOUT_MS * 2,
      });
      this.setState({ status: "up-to-date", behindCount: 0, error: undefined });
    } catch (err) {
      this.setState({ status: "error", error: (err as Error).message });
    }
  }

  getState(): RepoUpdateState {
    return { ...this.state };
  }

  private setState(newState: Partial<RepoUpdateState>): void {
    this.state = { ...this.state, ...newState };
    this.broadcast();
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("repoUpdate:status", this.state);
      }
    }
  }
}

export const repoUpdateManager = new RepoUpdateManager();

export function setupRepoUpdateIPC(): void {
  ipcMain.handle("repoUpdate:getStatus", () => repoUpdateManager.getState());

  ipcMain.handle("repoUpdate:check", async () => {
    await repoUpdateManager.check();
    return repoUpdateManager.getState();
  });

  ipcMain.handle("repoUpdate:pull", async () => {
    await repoUpdateManager.pull();
    return repoUpdateManager.getState();
  });
}
