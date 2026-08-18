// Server-to-server calls ke liye shared secret (e.g. agent → /api/execute).
// Production me `INTERNAL_API_SECRET` set karo; dev me default chalta hai.
export function internalSecret(): string {
  return (
    process.env.INTERNAL_API_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "nexora-dev-internal")
  );
}
