// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted shared mock references — must be declared before vi.mock() factories
// that reference them, because vi.mock() is hoisted to the top of the module.
// ---------------------------------------------------------------------------
const {
	mockHonoApp,
	mockUpgradeWebSocket,
	mockBunServeFn,
	mockGetSessionState,
	mockHandleCommand,
	mockShellChain,
	mockShell,
} = vi.hoisted(() => {
	const mockHonoApp = {
		get: vi.fn(),
		use: vi.fn(),
		fetch: vi.fn(),
	};
	const mockUpgradeWebSocket = vi.fn((factory: () => Record<string, unknown>) => factory);
	const mockBunServeFn = vi.fn().mockReturnValue({ port: 3848, stop: vi.fn() });
	const mockGetSessionState = vi.fn().mockReturnValue({ type: "state", connected: true });
	const mockHandleCommand = vi.fn().mockResolvedValue({ type: "response", command: "ping", success: true });

	// Stub the Bun global before any module import so server.ts can access
	// Bun.env and Bun.serve at module-evaluation time. vitest's node
	// environment does not inject Bun globals even when the runner is Bun.
	if (typeof globalThis.Bun === "undefined") {
		(globalThis as Record<string, unknown>).Bun = {
			env: {} as Record<string, string | undefined>,
			serve: mockBunServeFn,
		};
	}

	const mockShellChain = { exitCode: 0, text: vi.fn().mockReturnValue("") };
	const mockShell = vi.fn().mockReturnValue({
		cwd: vi.fn().mockReturnThis(),
		quiet: vi.fn().mockReturnThis(),
		nothrow: vi.fn().mockReturnValue(Promise.resolve(mockShellChain)),
	});

	return {
		mockHonoApp,
		mockUpgradeWebSocket,
		mockBunServeFn,
		mockGetSessionState,
		mockHandleCommand,
		mockShellChain,
		mockShell,
	};
});

// ---------------------------------------------------------------------------
// Module mocks — hoisted by vitest before any static import is evaluated.
// ---------------------------------------------------------------------------

// server.ts uses import.meta.dir (Bun extension) at module evaluation time.
// vitest's transform does not preserve Bun's import.meta extensions, so
// import.meta.dir is undefined. Intercept path.join to substitute a safe
// placeholder, allowing the module to load without crashing.
vi.mock("node:path", async importOriginal => {
	const nodePath = await importOriginal<typeof import("node:path")>();
	const origJoin = nodePath.join.bind(nodePath);
	return {
		...nodePath,
		join: (...segments: string[]) => origJoin(...segments.map(s => (s as string | undefined) ?? "/vitest/mock")),
	};
});

// Hono must be constructed with `new Hono()`. The factory MUST be a regular
// function (not an arrow function) because arrow functions cannot be called
// with `new`. Returning mockHonoApp from the constructor makes `new Hono()`
// yield the shared app object that tests can inspect.
vi.mock("hono", () => ({
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	Hono: vi.fn(function (this: unknown): typeof mockHonoApp {
		return mockHonoApp;
	}),
}));

vi.mock("hono/bun", () => ({
	serveStatic: vi.fn(() => vi.fn()),
	upgradeWebSocket: mockUpgradeWebSocket,
	websocket: {},
}));

vi.mock("@oh-my-pi/pi-utils", () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

vi.mock("@oh-my-pi/pi-natives", () => ({
	fuzzyFind: vi.fn().mockResolvedValue({ matches: [] }),
}));

vi.mock("node:fs/promises", async importOriginal => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, readdir: vi.fn(), stat: vi.fn() };
});

// Provide a minimal stub for the `$` shell function; it is never called when
// ensureClientBuild returns early via the catch block.
vi.mock("bun", () => ({
	$: mockShell,
}));

vi.mock("../src/commandHandler", () => ({
	getSessionState: mockGetSessionState,
	handleCommand: mockHandleCommand,
}));

// ---------------------------------------------------------------------------
// Static imports come after all vi.mock() declarations.
// ---------------------------------------------------------------------------
import * as fsPromises from "node:fs/promises";
import { startRemoteServer } from "../src/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockWs() {
	return { send: vi.fn(), close: vi.fn() };
}

function makeSession() {
	let subscribeCallback: ((event: unknown) => void) | undefined;
	const unsubscribe = vi.fn();
	const session = {
		messages: [{ role: "user", content: "hello" }],
		subscribe: vi.fn().mockImplementation((cb: (event: unknown) => void) => {
			subscribeCallback = cb;
			return unsubscribe;
		}),
	};
	return {
		session,
		unsubscribe,
		emit: (event: unknown) => subscribeCallback?.(event),
	};
}

type WsHandlers = {
	onOpen: (event: unknown, ws: ReturnType<typeof makeMockWs>) => void;
	onMessage: (event: { data: string | ArrayBuffer }, ws: ReturnType<typeof makeMockWs>) => Promise<void>;
	onClose: (event: unknown, ws: ReturnType<typeof makeMockWs>) => void;
};

/**
 * Extract the WebSocket handler object from the Hono app mock.
 *
 * upgradeWebSocket is mocked as `(factory) => factory`, so app.get('/ws',
 * factory) registers the factory itself as the route handler. Calling
 * factory() yields { onOpen, onMessage, onClose }.
 */
function getWsHandlers(): WsHandlers {
	const call = mockHonoApp.get.mock.calls.find(([p]: [string]) => p === "/ws") as
		| [string, () => Record<string, unknown>]
		| undefined;
	if (!call) throw new Error("No /ws route registered on Hono app");
	return call[1]() as WsHandlers;
}

// ---------------------------------------------------------------------------
// Test setup — refresh per-test return value of Bun.serve so each test gets
// its own stop spy, and reset mock call records.
// ---------------------------------------------------------------------------

let mockBunServer: { port: number; stop: ReturnType<typeof vi.fn> };

beforeEach(() => {
	vi.clearAllMocks();

	// Give each test a fresh stop spy and update what Bun.serve returns.
	mockBunServer = { port: 3848, stop: vi.fn() };
	mockBunServeFn.mockReturnValue(mockBunServer);

	// Default: readdir throws so ensureClientBuild returns early (source dir
	// not found). Tests that need a different fs shape override this.
	vi.mocked(fsPromises.readdir).mockRejectedValue(new Error("ENOENT: no such file or directory"));

	mockShellChain.exitCode = 0;
	mockShell.mockReturnValue({
		cwd: vi.fn().mockReturnThis(),
		quiet: vi.fn().mockReturnThis(),
		nothrow: vi.fn().mockReturnValue(Promise.resolve(mockShellChain)),
	});

	// Restore default handleCommand resolution after any per-test overrides.
	mockHandleCommand.mockResolvedValue({
		type: "response",
		command: "ping",
		success: true,
	});
});

// ---------------------------------------------------------------------------
// startRemoteServer — exported API
// ---------------------------------------------------------------------------

describe("startRemoteServer", () => {
	it("returns an object with port, url, and stop function", async () => {
		const { session } = makeSession();
		const result = await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0], 3848);

		expect(result).toHaveProperty("port");
		expect(result).toHaveProperty("url");
		expect(typeof result.stop).toBe("function");
	});

	it("constructs url from the actual server port", async () => {
		const { session } = makeSession();
		const result = await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0], 3848);

		expect(result.url).toBe(`http://localhost:${result.port}`);
	});

	it("subscribes to session events", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		expect(session.subscribe).toHaveBeenCalledOnce();
	});

	it("registers a /ws route on the Hono app", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const paths = mockHonoApp.get.mock.calls.map(([p]: [string]) => p);
		expect(paths).toContain("/ws");
	});

	it("registers static-file middleware", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		expect(mockHonoApp.use).toHaveBeenCalledWith("*", expect.any(Function));
	});
});

// ---------------------------------------------------------------------------
// WebSocket — onOpen
// ---------------------------------------------------------------------------

describe("WebSocket onOpen", () => {
	it("sends initial state snapshot to the newly connected client", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		const ws = makeMockWs();
		onOpen({}, ws);

		const payloads = ws.send.mock.calls.map(([raw]: [string]) => JSON.parse(raw) as Record<string, unknown>);
		expect(payloads).toContainEqual(expect.objectContaining({ type: "state" }));
	});

	it("sends message history to the newly connected client", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		const ws = makeMockWs();
		onOpen({}, ws);

		const payloads = ws.send.mock.calls.map(([raw]: [string]) => JSON.parse(raw) as Record<string, unknown>);
		expect(payloads).toContainEqual(expect.objectContaining({ type: "messages" }));
	});

	it("invokes getSessionState with the session", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		onOpen({}, makeMockWs());

		expect(mockGetSessionState).toHaveBeenCalledWith(session);
	});
});

// ---------------------------------------------------------------------------
// WebSocket — onMessage
// ---------------------------------------------------------------------------

describe("WebSocket onMessage", () => {
	it("handles valid JSON command and sends the response", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onMessage } = getWsHandlers();
		const ws = makeMockWs();
		const command = { id: "1", type: "ping" };
		await onMessage({ data: JSON.stringify(command) }, ws);

		expect(mockHandleCommand).toHaveBeenCalledWith(session, command);
		expect(ws.send).toHaveBeenCalledOnce();
	});

	it("sends an error response when the JSON is invalid", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onMessage } = getWsHandlers();
		const ws = makeMockWs();
		await onMessage({ data: "not json{{" }, ws);

		const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as {
			success: boolean;
			error: string;
		};
		expect(sent.success).toBe(false);
		expect(sent.error).toBe("Invalid JSON");
	});

	it("sends an error response when handleCommand throws", async () => {
		mockHandleCommand.mockRejectedValueOnce(new Error("command failed"));

		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onMessage } = getWsHandlers();
		const ws = makeMockWs();
		await onMessage({ data: JSON.stringify({ id: "2", type: "abort" }) }, ws);

		const sent = JSON.parse(ws.send.mock.calls[0][0] as string) as {
			success: boolean;
			error: string;
		};
		expect(sent.success).toBe(false);
		expect(sent.error).toBe("command failed");
	});

	it("accepts ArrayBuffer message data and parses it as string", async () => {
		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onMessage } = getWsHandlers();
		const ws = makeMockWs();
		const command = { id: "3", type: "ping" };
		const buffer = Buffer.from(JSON.stringify(command));
		await onMessage({ data: buffer }, ws);

		expect(mockHandleCommand).toHaveBeenCalledWith(session, command);
	});
});

// ---------------------------------------------------------------------------
// WebSocket — onClose
// ---------------------------------------------------------------------------

describe("WebSocket onClose", () => {
	it("removes the client so it no longer receives broadcast events", async () => {
		const { session, emit } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen, onClose } = getWsHandlers();
		const ws = makeMockWs();
		onOpen({}, ws);
		onClose({}, ws);

		ws.send.mockClear();
		emit({ type: "update" });

		// After onClose the client must not receive any further messages.
		expect(ws.send).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Session event broadcast
// ---------------------------------------------------------------------------

describe("session event broadcast", () => {
	it("sends events to all connected clients", async () => {
		const { session, emit } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		const ws1 = makeMockWs();
		const ws2 = makeMockWs();
		onOpen({}, ws1);
		onOpen({}, ws2);

		// Clear setup calls (state/messages sent on open).
		ws1.send.mockClear();
		ws2.send.mockClear();

		const event = { type: "stream", data: "hello" };
		emit(event);

		expect(ws1.send).toHaveBeenCalledOnce();
		expect(ws2.send).toHaveBeenCalledOnce();
		expect(JSON.parse(ws1.send.mock.calls[0][0] as string)).toEqual(event);
	});

	it("removes a client that throws during broadcast and continues", async () => {
		const { session, emit } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		const faultyWs = makeMockWs();
		const healthyWs = makeMockWs();
		onOpen({}, faultyWs);
		onOpen({}, healthyWs);

		faultyWs.send.mockClear();
		healthyWs.send.mockClear();

		faultyWs.send.mockImplementationOnce(() => {
			throw new Error("connection reset");
		});

		const event = { type: "stream" };
		emit(event);

		// The healthy client must still receive the event.
		expect(healthyWs.send).toHaveBeenCalledOnce();
		// The faulty client is removed; subsequent broadcasts skip it.
		faultyWs.send.mockClear();
		healthyWs.send.mockClear();
		emit(event);
		expect(faultyWs.send).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

describe("stop", () => {
	it("calls the unsubscribe function returned by session.subscribe", async () => {
		const { session, unsubscribe } = makeSession();
		const result = await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		result.stop();

		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it("calls server.stop()", async () => {
		const { session } = makeSession();
		const result = await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		result.stop();

		expect(mockBunServer.stop).toHaveBeenCalledOnce();
	});

	it("closes all connected WebSocket clients", async () => {
		const { session } = makeSession();
		const result = await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		const ws1 = makeMockWs();
		const ws2 = makeMockWs();
		onOpen({}, ws1);
		onOpen({}, ws2);

		result.stop();

		expect(ws1.close).toHaveBeenCalledOnce();
		expect(ws2.close).toHaveBeenCalledOnce();
	});

	it("tolerates clients that throw during close", async () => {
		const { session } = makeSession();
		const result = await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		const ws = makeMockWs();
		ws.close.mockImplementationOnce(() => {
			throw new Error("already closed");
		});
		onOpen({}, ws);

		// stop() must not propagate the error.
		expect(() => result.stop()).not.toThrow();
	});

	it("clears the client set so no events are broadcast after stop", async () => {
		const { session, emit } = makeSession();
		const result = await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		const { onOpen } = getWsHandlers();
		const ws = makeMockWs();
		onOpen({}, ws);
		ws.send.mockClear();

		result.stop();
		emit({ type: "update" });

		expect(ws.send).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// ensureClientBuild — tested indirectly; covers the source-dir-not-found path
// ---------------------------------------------------------------------------

describe("ensureClientBuild — source directory absent", () => {
	it("does not throw when the source directory cannot be read", async () => {
		// readdir is mocked to throw (see beforeEach), simulating a missing
		// CLIENT_SRC_DIR. startRemoteServer must complete without error.
		const { session } = makeSession();
		await expect(
			startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]),
		).resolves.toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// ensureClientBuild — covers getLatestMtime body and build logic
// ---------------------------------------------------------------------------

describe("ensureClientBuild — getLatestMtime coverage", () => {
	it("covers getLatestMtime body when readdir succeeds with files and dirs", async () => {
		const fileEntry = {
			name: "app.ts",
			isDirectory: () => false,
			isFile: () => true,
		};
		const dirEntry = {
			name: "subdir",
			isDirectory: () => true,
			isFile: () => false,
		};
		// First call: CLIENT_SRC_DIR — returns file+dir; second call: subdir — empty
		vi.mocked(fsPromises.readdir)
			.mockResolvedValueOnce([fileEntry, dirEntry] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>)
			.mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>);

		vi.mocked(fsPromises.stat)
			// stat for app.ts (inside getLatestMtime)
			.mockResolvedValueOnce({ mtimeMs: 1000, isFile: () => true } as unknown as Awaited<
				ReturnType<typeof fsPromises.stat>
			>)
			// stat for indexPath (inside ensureClientBuild) — old mtime → shouldBuild=true
			.mockRejectedValueOnce(new Error("ENOENT"));

		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		// $ should have been called because shouldBuild=true
		expect(mockShell).toHaveBeenCalled();
	});

	it("skips the build when indexPath mtime is newer than source", async () => {
		const fileEntry = {
			name: "app.ts",
			isDirectory: () => false,
			isFile: () => true,
		};
		vi.mocked(fsPromises.readdir).mockResolvedValueOnce([fileEntry] as unknown as Awaited<
			ReturnType<typeof fsPromises.readdir>
		>);

		vi.mocked(fsPromises.stat)
			// stat for app.ts — mtimeMs=1000
			.mockResolvedValueOnce({ mtimeMs: 1000, isFile: () => true } as unknown as Awaited<
				ReturnType<typeof fsPromises.stat>
			>)
			// stat for indexPath — mtimeMs=2000 (newer) → shouldBuild=false
			.mockResolvedValueOnce({ mtimeMs: 2000, isFile: () => true } as unknown as Awaited<
				ReturnType<typeof fsPromises.stat>
			>);

		const { session } = makeSession();
		await startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0]);

		// $ should NOT have been called
		expect(mockShell).not.toHaveBeenCalled();
	});

	it("throws when vite build exits non-zero", async () => {
		const fileEntry = {
			name: "app.ts",
			isDirectory: () => false,
			isFile: () => true,
		};
		vi.mocked(fsPromises.readdir).mockResolvedValueOnce([fileEntry] as unknown as Awaited<
			ReturnType<typeof fsPromises.readdir>
		>);
		vi.mocked(fsPromises.stat)
			.mockResolvedValueOnce({ mtimeMs: 1000, isFile: () => true } as unknown as Awaited<
				ReturnType<typeof fsPromises.stat>
			>)
			.mockRejectedValueOnce(new Error("ENOENT"));

		// Make $ return exitCode=1
		mockShellChain.exitCode = 1;
		vi.mocked(mockShell).mockReturnValue({
			cwd: vi.fn().mockReturnThis(),
			quiet: vi.fn().mockReturnThis(),
			nothrow: vi.fn().mockReturnValue(Promise.resolve(mockShellChain)),
		});

		const { session } = makeSession();
		await expect(startRemoteServer(session as unknown as Parameters<typeof startRemoteServer>[0])).rejects.toThrow(
			"Failed to build remote client",
		);
	});
});
