/** @type {import('next').NextConfig} */
const nextConfig = {
  // firebase-admin pulls in Node-only bits (gRPC native bindings, etc.) that
  // break if the build tries to bundle them — keep it as a plain require().
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
