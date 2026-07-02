import type { Metadata } from "next";
import { resolveShare } from "@/lib/share";
import PublicHome from "@/components/PublicHome";

export const runtime = "nodejs";

// Secret links must not be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "We Were Here ♥",
};

export default async function SharePage({ params }: { params: { token: string } }) {
  const share = await resolveShare(params.token);

  if (!share) {
    return (
      <div className="ow-login">
        <div style={{ textAlign: "center", maxWidth: 360, padding: "0 20px" }}>
          <h1 style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--cream)" }}>
            We Were Here <span style={{ color: "var(--gold)" }}>♥</span>
          </h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            Link không tồn tại hoặc đã bị thu hồi.
          </p>
        </div>
      </div>
    );
  }

  return <PublicHome token={params.token} />;
}
