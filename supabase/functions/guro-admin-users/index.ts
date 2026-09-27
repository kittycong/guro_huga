// 관리자 전용 직원 계정 관리: 아이디/비밀번호 계정 생성, 비밀번호 초기화, 권한 변경, 삭제.
// 아이디는 내부적으로 `${아이디}@guro-huga.local` 이메일로 저장한다(메일은 보내지 않음).
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

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = await admin.auth.getUser(token);
  const caller = userData?.user;
  if (!caller) return reply(401, { error: "로그인이 필요합니다." });
  const { data: me } = await admin.from("guro_huga_profiles").select("role").eq("user_id", caller.id).maybeSingle();
  if (me?.role !== "admin") return reply(403, { error: "관리자만 사용할 수 있습니다." });

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "요청 형식이 올바르지 않습니다." });
  }

  const adminCount = async () => {
    const { count } = await admin.from("guro_huga_profiles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    return count || 0;
  };

  switch (body.action) {
    case "list": {
      const { data, error } = await admin.from("guro_huga_profiles").select("user_id, login_id, emp_id, role, created_at").order("created_at");
      if (error) return reply(500, { error: error.message });
      return reply(200, { accounts: data });
    }
    case "create": {
      const loginId = String(body.loginId || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = body.role === "admin" ? "admin" : "staff";
      if (!LOGIN_ID_RE.test(loginId)) return reply(400, { error: "아이디는 영문 소문자·숫자·._- 3~30자입니다." });
      if (password.length < 6) return reply(400, { error: "비밀번호는 6자 이상이어야 합니다." });
      if (!body.empId) return reply(400, { error: "연결할 직원을 선택하세요." });
      const { data: existing } = await admin.from("guro_huga_profiles").select("login_id").eq("emp_id", body.empId).maybeSingle();
      if (existing) return reply(409, { error: `이 직원은 이미 '${existing.login_id}' 계정이 있습니다.` });
      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${loginId}@${EMAIL_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { login_id: loginId }
      });
      if (error || !created.user) {
        const msg = /already|registered|exists/i.test(error?.message || "") ? "이미 쓰는 아이디입니다." : (error?.message || "계정 생성 실패");
        return reply(400, { error: msg });
      }
      const { error: profileError } = await admin.from("guro_huga_profiles")
        .insert({ user_id: created.user.id, login_id: loginId, emp_id: body.empId, role });
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return reply(500, { error: profileError.message });
      }
      return reply(200, { ok: true });
    }
    case "reset": {
      const password = String(body.password || "");
      if (password.length < 6) return reply(400, { error: "비밀번호는 6자 이상이어야 합니다." });
      const { error } = await admin.auth.admin.updateUserById(body.userId, { password });
      if (error) return reply(400, { error: error.message });
      return reply(200, { ok: true });
    }
    case "role": {
      const role = body.role === "admin" ? "admin" : "staff";
      if (role === "staff" && body.userId === caller.id) return reply(400, { error: "본인의 관리자 권한은 해제할 수 없습니다." });
      const { error } = await admin.from("guro_huga_profiles").update({ role }).eq("user_id", body.userId);
      if (error) return reply(400, { error: error.message });
      return reply(200, { ok: true });
    }
    case "delete": {
      if (body.userId === caller.id) return reply(400, { error: "본인 계정은 삭제할 수 없습니다." });
      const { data: target } = await admin.from("guro_huga_profiles").select("role").eq("user_id", body.userId).maybeSingle();
      if (target?.role === "admin" && (await adminCount()) <= 1) return reply(400, { error: "마지막 관리자는 삭제할 수 없습니다." });
      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) return reply(400, { error: error.message });
      return reply(200, { ok: true });
    }
    default:
      return reply(400, { error: "알 수 없는 요청입니다." });
  }
});
