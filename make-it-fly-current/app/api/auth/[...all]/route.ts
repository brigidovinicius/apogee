import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/members/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request));
