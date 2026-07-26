import { spawn, execFileSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";
import { TEST_DB_PATH, TEST_PORT, BASE_URL } from "./constants";

const ROOT = path.resolve(__dirname, "..");

// A previous test run that got killed abruptly (e.g. an external timeout,
// SIGKILL) can leave its detached `next start` orphaned on TEST_PORT. If left
// alone, that stale server can silently answer this run's readiness check
// instead of the freshly-seeded one we're about to spawn, giving false
// results tied to whatever DB state the orphan happened to have. Best-effort
// clear the port before doing anything else.
function killWhateverIsOnTestPort() {
  try {
    execFileSync(
      "bash",
      [
        "-c",
        `ss -ltnp 2>/dev/null | grep ':${TEST_PORT} ' | grep -oP 'pid=\\K[0-9]+' | sort -u | xargs -r kill -9`,
      ],
      { stdio: "ignore" }
    );
  } catch {
    // nothing was listening, or we couldn't kill it — proceed either way,
    // the bind-failure check below is the real safety net.
  }
}

export default async function setup() {
  killWhateverIsOnTestPort();

  for (const f of [TEST_DB_PATH, `${TEST_DB_PATH}-journal`]) {
    if (existsSync(f)) rmSync(f);
  }

  const env = {
    ...process.env,
    DATABASE_URL: `file:${TEST_DB_PATH}`,
    // Isolated from the default `.next/` on purpose — see next.config.ts.
    // Using `next build && next start` (not `next dev`) for the same reason:
    // Next.js only allows one `next dev` per project directory, so tests must
    // not collide with a dev server someone (e.g. the person reviewing this)
    // already has open on this same repo.
    NEXT_TEST_DIST_DIR: ".next-test",
  };

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  execFileSync("npx", ["next", "build"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });

  const server = spawn("npx", ["next", "start", "-p", String(TEST_PORT)], {
    cwd: ROOT,
    env,
    stdio: "pipe",
    detached: true, // own process group, so teardown can kill Next's child workers too
  });

  let serverOutput = "";
  server.stdout?.on("data", (d) => (serverOutput += d.toString()));
  server.stderr?.on("data", (d) => (serverOutput += d.toString()));

  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    // Fail fast rather than polling into a stale process that happens to
    // already be listening on this port (see killWhateverIsOnTestPort above
    // for why that's a real risk, not a hypothetical one).
    if (/EADDRINUSE|address already in use/i.test(serverOutput)) {
      console.error(serverOutput);
      throw new Error(
        `Port ${TEST_PORT} was already in use and our own server failed to bind to it — refusing to continue against whatever else is answering on that port.`
      );
    }
    try {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${BASE_URL}/api/classes`, {
        signal: controller.signal,
      });
      clearTimeout(abortTimer);
      if (res.status) {
        ready = true;
        break;
      }
    } catch {
      // not up yet, or a single poll attempt timed out — keep retrying
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!ready) {
    console.error(serverOutput);
    throw new Error("Next.js test server did not become ready in time");
  }

  return async () => {
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
    await new Promise((r) => setTimeout(r, 500));
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {
        // already dead
      }
    }
  };
}
