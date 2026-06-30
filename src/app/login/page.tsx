"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Đăng nhập thất bại");
    }
  }

  return (
    <div className="ow-login">
      <form onSubmit={submit}>
        <h1>We Were Here <span>♥</span></h1>
        <input placeholder="Tên đăng nhập" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
        <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="ow-err">{err}</div>}
        <button type="submit">Đăng nhập</button>
      </form>
    </div>
  );
}
