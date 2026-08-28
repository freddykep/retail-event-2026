import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #062d47 0%, #006ec7 55%, #22aaba 100%)",
          borderRadius: 7,
        }}
      >
        <span
          style={{
            fontSize: 21,
            fontWeight: 800,
            fontStyle: "italic",
            color: "#ffffff",
            fontFamily: "sans-serif",
          }}
        >
          T<span style={{ color: "#37dcb1" }}>R</span>
        </span>
      </div>
    ),
    { ...size }
  );
}
