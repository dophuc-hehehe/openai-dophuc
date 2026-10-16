const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
const newId = () => crypto.randomUUID();
const toHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
const fromHex = hex => new Uint8Array((hex.match(/.{2}/g) || []).map(x => parseInt(x, 16)));
async function sha256(value) { return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }
async function passwordHash(password, saltHex) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(saltHex), iterations: 210000, hash: "SHA-256" }, material, 256);
  return toHex(bits);
}
function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : "";
}
function cookieHeader(value, maxAge) {
  return `dophuc_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
async function getUser(request, env) {
  const token = cookieValue(request, "dophuc_session");
  if (!token || !env.DB) return null;
  const sessionId = await sha256(token);
  const row = await env.DB.prepare("SELECT u.id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?").bind(sessionId, Math.floor(Date.now()/1000)).first();
  return row || null;
}
async function bodyJson(request) { try { return await request.json(); } catch { return null; } }
async function requireUser(request, env) {
  const user = await getUser(request, env);
  return user ? { user } : { response: json({ error: "Vui lòng đăng nhập để tiếp tục." }, 401) };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith("/api/") && !env.DB) return json({ error: "Chưa cấu hình D1. Kiểm tra binding DB trong wrangler.toml." }, 503);
    if (path === "/api/health" && request.method === "GET") return json({ ok: true, service: "dophuc-ai", ai: Boolean(env.AI), database: Boolean(env.DB) });
    if (path === "/api/auth/register" && request.method === "POST") {
      const body = await bodyJson(request);
      if (!body) return json({ error: "Dữ liệu JSON không hợp lệ." }, 400);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Hãy nhập email hợp lệ." }, 400);
      if (password.length < 10 || password.length > 128) return json({ error: "Mật khẩu phải có từ 10 đến 128 ký tự." }, 400);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = toHex(salt);
      const hash = await passwordHash(password, saltHex);
      const userId = newId();
      try {
        await env.DB.prepare("INSERT INTO users(id,email,password_hash,password_salt) VALUES(?,?,?,?)").bind(userId,email,hash,saltHex).run();
      } catch (e) {
        if (String(e).toLowerCase().includes("unique")) return json({ error: "Email này đã được đăng ký." }, 409);
        console.error("Register failed", e); return json({ error: "Không thể tạo tài khoản lúc này." }, 500);
      }
      const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
      await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(await sha256(token),userId,Math.floor(Date.now()/1000)+SESSION_SECONDS).run();
      return json({ user: { id: userId, email } }, 201, { "Set-Cookie": cookieHeader(token, SESSION_SECONDS) });
    }
    if (path === "/api/auth/login" && request.method === "POST") {
      const body = await bodyJson(request);
      if (!body) return json({ error: "Dữ liệu JSON không hợp lệ." }, 400);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const row = await env.DB.prepare("SELECT id,email,password_hash,password_salt FROM users WHERE email=?").bind(email).first();
      if (!row || password.length > 128 || await passwordHash(password, row.password_salt) !== row.password_hash) return json({ error: "Email hoặc mật khẩu không đúng." }, 401);
      const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
      await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(await sha256(token),row.id,Math.floor(Date.now()/1000)+SESSION_SECONDS).run();
      return json({ user: { id: row.id, email: row.email } }, 200, { "Set-Cookie": cookieHeader(token, SESSION_SECONDS) });
    }
    if (path === "/api/auth/logout" && request.method === "POST") {
      const token = cookieValue(request, "dophuc_session");
      if (token) await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(await sha256(token)).run();
      return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
    }
    if (path === "/api/auth/me" && request.method === "GET") {
      const user = await getUser(request, env);
      return user ? json({ user }) : json({ user: null }, 200, { "Set-Cookie": cookieHeader("", 0) });
    }
    if (path === "/api/conversations" && request.method === "GET") {
      const auth = await requireUser(request, env); if (!auth.user) return auth.response;
      const { user } = auth;
      const { results } = await env.DB.prepare("SELECT c.id,c.title,c.created_at,c.updated_at,(SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS message_count FROM conversations c WHERE c.user_id=? ORDER BY c.updated_at DESC LIMIT 200").bind(user.id).all();
      return json({ conversations: results || [] });
    }
    if (path === "/api/conversations" && request.method === "POST") {
      const auth = await requireUser(request, env); if (!auth.user) return auth.response;
      const body = await bodyJson(request) || {};
      const conversationId = newId();
      const title = String(body.title || "Cuộc trò chuyện mới").trim().slice(0,120) || "Cuộc trò chuyện mới";
      await env.DB.prepare("INSERT INTO conversations(id,user_id,title) VALUES(?,?,?)").bind(conversationId,auth.user.id,title).run();
      return json({ conversation: { id: conversationId, title } }, 201);
    }
    const conversationMatch = path.match(/^\/api\/conversations\/([a-f0-9-]+)(?:\/(messages))?$/i);
    if (conversationMatch && request.method === "GET") {
      const auth = await requireUser(request, env); if (!auth.user) return auth.response;
      const conversationId = conversationMatch[1];
      const conversation = await env.DB.prepare("SELECT id,title,created_at,updated_at FROM conversations WHERE id=? AND user_id=?").bind(conversationId,auth.user.id).first();
      if (!conversation) return json({ error: "Không tìm thấy cuộc trò chuyện." }, 404);
      const { results } = await env.DB.prepare("SELECT id,role,content,created_at FROM messages WHERE conversation_id=? AND user_id=? ORDER BY created_at ASC,id ASC").bind(conversationId,auth.user.id).all();
      return json({ conversation, messages: results || [] });
    }
    if (conversationMatch && request.method === "DELETE" && !conversationMatch[2]) {
      const auth = await requireUser(request, env); if (!auth.user) return auth.response;
      const result = await env.DB.prepare("DELETE FROM conversations WHERE id=? AND user_id=?").bind(conversationMatch[1],auth.user.id).run();
      if (!result.meta?.changes) return json({ error: "Không tìm thấy cuộc trò chuyện." }, 404);
      return json({ ok: true });
    }
    if (path === "/api/chat" && request.method === "POST") {
      const auth = await requireUser(request, env); if (!auth.user) return auth.response;
      if (!env.AI) return json({ error: "Chưa cấu hình Workers AI. Kiểm tra binding AI trong wrangler.toml." }, 503);
      const body = await bodyJson(request);
      if (!body) return json({ error: "Dữ liệu JSON không hợp lệ." }, 400);
      if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40) return json({ error: "Hãy gửi từ 1 đến 40 tin nhắn." }, 400);
      if (body.messages.some(m => !m || !["user","assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.trim())) return json({ error: "Định dạng tin nhắn không hợp lệ." }, 400);
      const conversationId = String(body.conversationId || "");
      if (!conversationId) return json({ error: "Thiếu mã cuộc trò chuyện." }, 400);
      const conversation = await env.DB.prepare("SELECT id,title FROM conversations WHERE id=? AND user_id=?").bind(conversationId,auth.user.id).first();
      if (!conversation) return json({ error: "Không tìm thấy cuộc trò chuyện của tài khoản này." }, 404);
      const messages = body.messages.map(m => ({ role:m.role, content:m.content.slice(0,12000) }));
      try {
        const result = await env.AI.run(MODEL, { messages: [
          { role: "system", content: "Bạn là Dophuc AI, một trợ lý hữu ích, thân thiện. Mặc định trả lời bằng tiếng Việt rõ ràng, tự nhiên; nếu người dùng yêu cầu ngôn ngữ khác thì làm theo. Với câu hỏi lập trình, đưa ví dụ chạy được và lưu ý bảo mật. Không bịa nguồn hoặc sự kiện; nói rõ khi không chắc chắn." },
          ...messages
        ], max_tokens: 1800 });
        const reply = result?.response ?? result?.choices?.[0]?.message?.content;
        if (typeof reply !== "string" || !reply.trim()) return json({ error: "Mô hình chưa trả về nội dung. Vui lòng thử lại." }, 502);
        const userMessages = messages.filter(m => m.role === "user");
        const lastUserMessage = userMessages[userMessages.length-1];
        if (!lastUserMessage) return json({ error: "Thiếu tin nhắn người dùng." }, 400);
        const now = new Date().toISOString();
        const batch = [
          env.DB.prepare("INSERT INTO messages(id,conversation_id,user_id,role,content,created_at) VALUES(?,?,?,?,?,?)").bind(newId(),conversationId,auth.user.id,"user",lastUserMessage.content,now),
          env.DB.prepare("INSERT INTO messages(id,conversation_id,user_id,role,content,created_at) VALUES(?,?,?,?,?,?)").bind(newId(),conversationId,auth.user.id,"assistant",reply,now),
          env.DB.prepare("UPDATE conversations SET updated_at=?, title=CASE WHEN title='Cuộc trò chuyện mới' THEN ? ELSE title END WHERE id=? AND user_id=?").bind(now,lastUserMessage.content.slice(0,80),conversationId,auth.user.id)
        ];
        await env.DB.batch(batch);
        return json({ reply, saved: true });
      } catch (error) {
        console.error("Chat failed", error);
        return json({ error: "Không gọi được mô hình AI hoặc không lưu được cuộc trò chuyện. Kiểm tra quyền Workers AI và D1." }, 502);
      }
    }
    if (path.startsWith("/api/")) return json({ error: "Không tìm thấy API." }, 404);
    return env.ASSETS.fetch(request);
  }
};
