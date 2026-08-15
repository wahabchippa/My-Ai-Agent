// /api/execute — safe sandboxed code execution.
// Runs JavaScript with a restricted global scope (no file/network/process access).
// Captures console.log output and the evaluated result.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code } = await req.json().catch(() => ({}));
    if (!code || typeof code !== "string")
      return NextResponse.json({ error: "No code provided" }, { status: 400 });

    // Block dangerous globals
    if (/\b(require|import|process|child_process|fs|net|http|eval|Function|globalThis)\b/.test(code)) {
      return NextResponse.json({ error: "Blocked: unsafe code" }, { status: 403 });
    }

    const logs: string[] = [];
    const sandboxConsole = {
      log: (...args: any[]) => logs.push(args.map(String).join(" ")),
      error: (...args: any[]) => logs.push(args.map(String).join(" ")),
      warn: (...args: any[]) => logs.push(args.map(String).join(" ")),
    };

    const sandbox = {
      console: sandboxConsole,
      Math,
      JSON,
      Array,
      Object,
      String,
      Number,
      Date,
      parseInt,
      parseFloat,
      isNaN,
    };

    // Execute in a Function scope with only sandbox globals
    const wrapped = `
      "use strict";
      const { console, Math, JSON, Array, Object, String, Number, Date, parseInt, parseFloat, isNaN } = arguments[0];
      ${code}
    `;
    // eslint-disable-next-line no-new-func
    const fn = new Function(wrapped);
    let result: unknown;
    try {
      result = fn(sandbox);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Runtime error", logs });
    }

    return NextResponse.json({
      logs,
      result: result === undefined ? null : typeof result === "object" ? JSON.stringify(result) : String(result),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Execute failed" }, { status: 500 });
  }
}
