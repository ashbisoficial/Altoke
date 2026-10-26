/** @type {import('next').NextConfig} */
const nextConfig = {
  // firebase-admin pulls in Node-only bits (gRPC native bindings, etc.) that
  // break if the build tries to bundle them — keep it as a plain require().
  serverExternalPackages: ["firebase-admin"],

  async headers() {
    return [
      {
        // The platform's default Cross-Origin-Opener-Policy (same-origin)
        // blocks Firebase Auth's signInWithPopup from checking when the
        // OAuth popup closes — the popup opens, completes, and closes, but
        // the main tab never finds out. same-origin-allow-popups keeps the
        // isolation but lets that check through.
        source: "/:path*",
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }],
      },
    ];
  },
};

export default nextConfig;
