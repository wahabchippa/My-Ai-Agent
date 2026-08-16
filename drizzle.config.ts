// Drizzle config.
//
// Pehle ye drizzle.config.json thi, jis me url likha tha: "process.env.DATABASE_URL"
// — JSON me variable expand nahi hota, wo LITERAL string ban jati thi. Is liye
// drizzle-kit chup chaap "Pulling schema..." par ruk jata tha aur kabhi push
// nahi hota. Yehi wajah hai ke memories table purani shakl me rah gayi.
//
// TS config me env var asal me parhi jati hai.

import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL set nahi hai — db:push chalane se pehle set karein.");

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
} satisfies Config;
