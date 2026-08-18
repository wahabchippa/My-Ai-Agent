// /api/execute — sandboxed code execution.
//
// ── SECURITY REWRITE (2026-08-18) ──────────────────────────────────
// PICHLA BUG (RCE): code `new Function()` se chalta tha aur "sandbox"
// sirf regex blocklist thi. String-splitting se blocklist bypass hoti
// thi:
//
//     ({}).constructor.constructor("return proc" + "ess.version")()
//     → "v20.20.2"  (Node process — live proof)
//
// Matlab koi bhi bina login ke env secrets/filesystem/network access
// kar sakta tha. AB:
//
//   1. AUTH GATE — sirf logged-in users, ya server ke andar se
//      (`x-internal-secret` header; agents apne code-verification ke
//      liye ye path use karte hain).
//   2. REAL SANDBOX — `node:vm` context me code chalta hai, jisme:
//        • contextCodeGeneration: { strings: false } → strings se
//          Function/eval banana band — constructor-escape isi se
//          kaam nahi karta (yehi `--disallow-code-generation-
//          from-strings` flag ka vm-equivalent hai)
//        • timeout 3s → infinite loop mar nahi sakta
//        • sandbox me sirf safe globals (console, Math, JSON, ...)
//      Blocklist ab sirf defense-in-depth hai, asli tahafuz nahi.
//
// ⚠ Honest note: vm perfect security boundary nahi hai; isay external
// untrusted production code ke liye use nahi karna chahiye. Is app ke
// use-case (agent ka apna likha hua chhota JS verify karna) ke liye
// ye reasonable hai — aur auth gate ke peeche hai.

import { NextResponse } from "next/server";
import vm from "node:vm";
import { getUser } from "@/lib/accessControl";
import { internalSecret } from "@/lib/internalSecret";

export const dynamic = "force-dynamic";

// Blocks: codegen restriction ke upar ek aur layer.
const BLOCKED =
  /\b(require|import|process|child_process|fs|net|http|https|dns|os|path|vm|worker_threads|globalThis|eval|Function|constructor|__proto__|prototype)\b/;

const CODE_MAX = 10_000;
const EXEC_TIMEOUT_MS = 3_000;

export async function POST(req: Request) {
  try {
    // ── AUTH GATE ──
    const user = await getUser(req).catch(() => null);
    const internal = req.headers.get("x-internal-secret") === internalSecret();
    if (!user && !internal) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const { code } = await req.json().catch(() => ({}));
    if (!code || typeof code !== "string")
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    if (code.length > CODE_MAX)
      return NextResponse.json({ error: "Code too long" }, { status: 400 });

    if (BLOCKED.test(code)) {
      return NextResponse.json({ error: "Blocked: unsafe code" }, { status: 403 });
    }

    const logs: string[] = [];
    const pushLog = (...args: unknown[]) => logs.push(args.map(String).join(" "));

    const sandbox: Record<string, unknown> = {
      console: {
        log: pushLog,
        error: pushLog,
        warn: pushLog,
        info: pushLog,
        debug: pushLog,
      },
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
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
    };

    // `return` top-level par kaam kare, is liye IIFE me wrap.
    const wrapped = `(function(){\n"use strict";\n${code}\n})()`;

    let result: unknown;
    try {
      result = vm.runInNewContext(wrapped, sandbox, {
        timeout: EXEC_TIMEOUT_MS,
        // ⭐ ASLI TAHAFUZ: context ke andar strings se code-generation
        // band. `({}).constructor.constructor("...")` ab throw karta hai.
        contextCodeGeneration: { strings: false, wasm: false },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Timeout ko insani zaban me
      const out = /Script execution timed out/i.test(msg)
        ? "Execution timed out (3s limit) — infinite loop?"
        : msg;
      return NextResponse.json({ error: out, logs });
    }

    return NextResponse.json({
      logs,
      result:
        result === undefined
          ? null
          : typeof result === "object"
            ? JSON.stringify(result)
            : String(result),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Execute failed" },
      { status: 500 }
    );
  }
}
