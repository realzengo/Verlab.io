import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { chromium, type Browser, type Page } from "playwright-core";
import {
  PAGE_API_VERSION,
  type CodecProbe,
  type PageRenderInput,
  type PageRenderResult,
  type PageStage,
} from "./page-api";

// Drives headless Chrome for the worker. Chrome stays warm; each render gets
// a fresh page (no state or memory carried between jobs). The page reads its
// inputs and hands back the finished MP4 through a file server bound to
// 127.0.0.1, so tens of MB never cross the DevTools pipe as base64, and a
// render's files are only reachable through its own random lease token.

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
};

export interface BrowserOptions {
  /** The built page (dist/page). */
  pageDir: string;
  /** The app's public/fonts, which the font CSS asks for at /fonts/. */
  fontsDir: string;
  /** Chrome's binary; local runs can use `channel: "chrome"` instead. */
  executablePath?: string;
  channel?: string;
  /** Containers without user namespaces can't run Chrome's sandbox. */
  noSandbox?: boolean;
  /** More Chrome switches (e.g. --disable-gpu on machines without one). */
  extraArgs?: string[];
  log?: (event: string, fields: Record<string, unknown>) => void;
}

export interface RenderJobFiles {
  sourcePath: string;
  backgroundPath: string | null;
  outputPath: string;
}

interface Lease {
  inputs: Map<string, string>;
  output: string;
}

class FileServer {
  private server: http.Server | null = null;
  private leases = new Map<string, Lease>();
  origin = "";

  constructor(private readonly roots: { page: string; fonts: string }) {}

  async start() {
    this.server = http.createServer((request, response) => {
      this.handle(request, response).catch((error) => {
        if (!response.headersSent) response.statusCode = 500;
        response.end(String(error));
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    const { port } = this.server.address() as AddressInfo;
    this.origin = `http://127.0.0.1:${port}`;
  }

  lease(inputs: Record<string, string>, output: string) {
    const token = randomUUID();
    this.leases.set(token, { inputs: new Map(Object.entries(inputs)), output });
    const urls: Record<string, string> = {};
    for (const name of Object.keys(inputs)) urls[name] = `${this.origin}/in/${token}/${name}`;
    return { token, urls, outputUrl: `${this.origin}/out/${token}` };
  }

  release(token: string) {
    this.leases.delete(token);
  }

  async close() {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private async sendFile(response: http.ServerResponse, file: string) {
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("Content-Type", MIME[path.extname(file)] ?? "application/octet-stream");
    response.setHeader("Content-Length", String(info.size));
    await pipeline(createReadStream(file), response);
  }

  /** `rel` inside `root`, or null if it climbs out. */
  private inside(root: string, rel: string): string | null {
    const file = path.resolve(root, `.${path.posix.normalize(`/${decodeURIComponent(rel)}`)}`);
    return file.startsWith(path.resolve(root) + path.sep) ? file : null;
  }

  private async handle(request: http.IncomingMessage, response: http.ServerResponse) {
    const url = new URL(request.url ?? "/", this.origin);
    const [, area, ...rest] = url.pathname.split("/");

    if (request.method === "GET" && (area === "page" || area === "fonts")) {
      const file = this.inside(area === "page" ? this.roots.page : this.roots.fonts, rest.join("/"));
      if (file) return this.sendFile(response, file);
    }
    if (request.method === "GET" && area === "in") {
      const file = this.leases.get(rest[0] ?? "")?.inputs.get(rest[1] ?? "");
      if (file) return this.sendFile(response, file);
    }
    if (request.method === "PUT" && area === "out") {
      const lease = this.leases.get(rest[0] ?? "");
      if (lease) {
        await pipeline(request, createWriteStream(lease.output));
        response.statusCode = 204;
        response.end();
        return;
      }
    }
    response.statusCode = 404;
    response.end();
  }
}

export class RenderBrowser {
  private constructor(
    private readonly browser: Browser,
    private readonly files: FileServer,
    private readonly log: NonNullable<BrowserOptions["log"]>
  ) {}

  static async launch(options: BrowserOptions): Promise<RenderBrowser> {
    const files = new FileServer({ page: options.pageDir, fonts: options.fontsDir });
    await files.start();
    const browser = await chromium.launch({
      headless: true,
      channel: options.executablePath ? undefined : options.channel,
      executablePath: options.executablePath,
      args: [
        "--autoplay-policy=no-user-gesture-required",
        // Docker's /dev/shm is tiny; video frames would crash the renderer.
        "--disable-dev-shm-usage",
        ...(options.noSandbox ? ["--no-sandbox"] : []),
        ...(options.extraArgs ?? []),
      ],
    });
    return new RenderBrowser(browser, files, options.log ?? (() => {}));
  }

  get connected() {
    return this.browser.isConnected();
  }

  private async openPage(onProgress?: (stage: PageStage, progress: number) => void): Promise<Page> {
    const page = await this.browser.newPage();
    page.on("console", (message) => {
      const type = message.type();
      if (type === "error" || type === "warning") this.log("page.console", { type, text: message.text().slice(0, 500) });
    });
    page.on("pageerror", (error) => this.log("page.error", { message: error.message.slice(0, 500) }));
    if (onProgress) await page.exposeFunction("verlabProgress", onProgress);
    await page.goto(`${this.files.origin}/page/index.html`);
    await page.waitForFunction(() => Boolean(window.verlab), undefined, { timeout: 30_000 });
    const version = await page.evaluate(() => window.verlab!.version);
    if (version !== PAGE_API_VERSION) {
      await page.close();
      throw new Error(`Render page is version ${version}, the worker expects ${PAGE_API_VERSION}: rebuild it`);
    }
    return page;
  }

  async probe(): Promise<CodecProbe> {
    const page = await this.openPage();
    try {
      return await page.evaluate(() => window.verlab!.probe());
    } finally {
      await page.close();
    }
  }

  /**
   * Renders one clip: the page tracks faces (if asked), runs exportClip and
   * PUTs the MP4 to `files.outputPath`. Closing the page is how an abort or
   * the time limit stops it.
   */
  async render(
    input: Omit<PageRenderInput, "sourceUrl" | "backgroundUrl" | "outputUrl">,
    files: RenderJobFiles,
    {
      onProgress,
      signal,
      timeoutMs,
    }: { onProgress?: (stage: PageStage, progress: number) => void; signal?: AbortSignal; timeoutMs: number }
  ): Promise<PageRenderResult> {
    const inputs: Record<string, string> = { source: files.sourcePath };
    if (files.backgroundPath) inputs.background = files.backgroundPath;
    const lease = this.files.lease(inputs, files.outputPath);
    const page = await this.openPage(onProgress);
    let timer: NodeJS.Timeout | undefined;
    const stop = () => void page.close().catch(() => {});
    signal?.addEventListener("abort", stop, { once: true });
    try {
      const run = page.evaluate((job) => window.verlab!.render(job), {
        ...input,
        sourceUrl: lease.urls.source,
        backgroundUrl: lease.urls.background ?? null,
        outputUrl: lease.outputUrl,
      } satisfies PageRenderInput);
      const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          stop();
          reject(new Error(`Render took longer than ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
      });
      return await Promise.race([run, limit]);
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      this.files.release(lease.token);
      await page.close().catch(() => {});
    }
  }

  async close() {
    await this.browser.close().catch(() => {});
    await this.files.close();
  }
}
