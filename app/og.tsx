import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AivaSpa — 24/7 AI Receptionist for Med Spas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Og() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0B0C0E 0%, #161719 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "80px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 600,
            height: 600,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(226,229,75,0.18) 0%, rgba(226,229,75,0) 60%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#E2E54B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              color: "#0B0C0E",
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 36, color: "#F7F8F8", fontWeight: 700 }}>
            AivaSpa
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "auto",
            marginBottom: "auto",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#F7F8F8",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            The 24/7 AI receptionist
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#E2E54B",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            for med spas.
          </div>

          <div
            style={{
              fontSize: 28,
              color: "#A1A1AA",
              marginTop: 32,
              maxWidth: 900,
              display: "flex",
            }}
          >
            Answers from your KB. Captures leads. Pages your team.
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
            {["Lead capture", "Calendar booking", "Webhooks + API"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 22px",
                    borderRadius: 9999,
                    background: "#161719",
                    border: "1px solid #2A2C32",
                    color: "#F7F8F8",
                    fontSize: 20,
                    fontWeight: 600,
                  }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 80,
            fontSize: 22,
            color: "#71717A",
            display: "flex",
          }}
        >
          aivaspa.online
        </div>
      </div>
    ),
    { ...size },
  );
}