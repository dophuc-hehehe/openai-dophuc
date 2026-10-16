const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "dophuc-ai", ai: Boolean(env.AI) });
    }
    if (url.pathname === "/api/chat" && request.method === "POST") {
      if (!env.AI) return json({ error: "Chưa cấu hình Workers AI. Kiểm tra binding AI trong wrangler.toml." }, 503);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Dữ liệu gửi lên không phải JSON hợp lệ." }, 400); }
      if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40) {
        return json({ error: "Hãy gửi từ 1 đến 40 tin nhắn." }, 400);
      }
      const messages = body.messages.map(m => {
        if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") throw new Error("invalid");
        return { role: m.role, content: m.content.slice(0, 12000) };
      });
      if (messages.some(m => !m.content.trim())) return json({ error: "Tin nhắn không được để trống." }, 400);
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: "system", content: "Bạn là Dophuc AI, một trợ lý hữu ích, thân thiện. Mặc định trả lời bằng tiếng Việt rõ ràng, tự nhiên; nếu người dùng yêu cầu ngôn ngữ khác thì làm theo. Với câu hỏi lập trình, đưa ví dụ chạy được và lưu ý bảo mật. Không bịa nguồn hoặc sự kiện; nói rõ khi không chắc chắn." },
            ...messages
          ],
          max_tokens: 1800
        });
        const reply = result?.response ?? result?.choices?.[0]?.message?.content;
        if (typeof reply !== "string" || !reply.trim()) return json({ error: "Mô hình chưa trả về nội dung. Vui lòng thử lại." }, 502);
        return json({ reply });
      } catch (error) {
        console.error("Workers AI request failed", error);
        return json({ error: "Không gọi được mô hình AI. Kiểm tra quyền Workers AI, tên mô hình và hạn mức tài khoản Cloudflare." }, 502);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Không tìm thấy API." }, 404);
    return env.ASSETS.fetch(request);
  }
};