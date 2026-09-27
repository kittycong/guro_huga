// 첫 관리자 계정 만들기. 관리자가 한 명도 없을 때만 동작하고, 한 명이라도 생기면 항상 거절한다.
// 로그인 화면의 '첫 관리자 만들기'에서 호출한다. 만든 계정은 첫 번째 직원(공용 데이터 employees[0])에 연결.
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_DOMAIN = "guro-huga.local";
const LOGIN_ID_RE = /^[a-z0-9._-]{3,30}$/;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST만 허용됩니다." });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const hasAdmin = async () => {
    const { count } = await admin.from("guro_huga_profiles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    return (count || 0) > 0;
  };

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    // status 확인은 본문 없이도 된다.
  }
  if (body.action === "status") return reply(200, { needsSetup: !(await hasAdmin()) });
  if (await hasAdmin()) return reply(403, { error: "이미 관리자가 있습니다. 관리자에게 계정을 받으세요." });

  const loginId = String(body.loginId || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!LOGIN_ID_RE.test(loginId)) return reply(400, { error: "아이디는 영문 소문자·숫자·._- 3~30자입니다." });
  if (password.length < 8) return reply(400, { error: "관리자 비밀번호는 8자 이상으로 정하세요." });

  const { data: stateRow } = await admin.from("guro_huga_state").select("data").eq("id", "main").maybeSingle();
  const empId = stateRow?.data?.employees?.[0]?.id;
  if (!empId) return reply(500, { error: "공용 데이터에 직원이 없습니다." });

  const { data: created, error } = await admin.auth.admin.createUser({
    email: `${loginId}@${EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { login_id: loginId }
  });
  if (error || !created.user) return reply(400, { error: error?.message || "계정 생성 실패" });
  // DB 트리거가 이미 연결했을 수 있으므로 없을 때만 넣는다.
  await admin.from("guro_huga_profiles").upsert({ user_id: created.user.id, login_id: loginId, emp_id: empId, role: "admin" }, { onConflict: "user_id" });
  return reply(200, { ok: true });
});
