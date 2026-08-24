import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Altoke",
    short_name: "Altoke",
    description: "Gestión de proyectos y pizarra colaborativa, súper fácil de usar.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#2952CC",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
