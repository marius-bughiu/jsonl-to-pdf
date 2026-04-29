import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function claudeProjectsRoot(): string {
  return join(homedir(), ".claude", "projects");
}

/**
 * Decode a Claude Code project directory name back to a filesystem path.
 *
 * The encoding replaces path separators (and the ":" after a Windows drive
 * letter) with "-". Example: `C:\S\jsonl-to-pdf` ↔ `C--S-jsonl-to-pdf`.
 *
 * The encoding is lossy: a directory whose name contains "-" is
 * indistinguishable from a path separator. We mitigate by trying candidate
 * decodings and returning the first one that exists on disk; otherwise we
 * fall back to a best-effort string transform.
 */
export function decodeProjectDir(encoded: string): string {
  if (process.platform === "win32") {
    const m = encoded.match(/^([A-Za-z])--(.*)$/);
    if (m) {
      const drive = m[1].toUpperCase();
      const rest = m[2];
      const candidate = `${drive}:\\${rest.replace(/-/g, "\\")}`;
      if (existsSync(candidate)) return candidate;
      // Fallback: try splitting greedily — find the longest prefix that exists.
      const parts = rest.split("-");
      for (let i = parts.length; i > 0; i--) {
        const head = `${drive}:\\${parts.slice(0, i).join("\\")}`;
        if (existsSync(head)) {
          const tail = parts.slice(i).join("-");
          return tail ? `${head}\\${tail}` : head;
        }
      }
      return candidate;
    }
  }
  // POSIX: leading "-" represents "/", subsequent "-" represent "/".
  const candidate = "/" + encoded.replace(/^-/, "").replace(/-/g, "/");
  if (existsSync(candidate)) return candidate;
  return candidate;
}

export function encodeProjectDir(absPath: string): string {
  if (process.platform === "win32") {
    const m = absPath.match(/^([A-Za-z]):[\\/](.*)$/);
    if (m) {
      const drive = m[1].toUpperCase();
      const rest = m[2].replace(/[\\/]/g, "-");
      return `${drive}--${rest}`;
    }
    return absPath.replace(/[\\/]/g, "-");
  }
  return absPath.replace(/^\//, "-").replace(/\//g, "-");
}

export function isReadableDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
