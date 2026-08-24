import Link from "next/link";
import {
  LayoutGrid,
  ListTodo,
  CalendarDays,
  PenSquare,
  Users,
  Bell,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/layout/Logo";

const BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-soft transition-all hover:bg-accent/90 hover:-translate-y-px";

const ACCENT_COLORS = [
  { bg: "bg-accent/10", text: "text-accent" },
  { bg: "bg-accent2/10", text: "text-accent2" },
  { bg: "bg-accent3/10", text: "text-accent3" },
  { bg: "bg-status-done/10", text: "text-status-done" },
];

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Tablero Kanban",
    text: "Organiza el trabajo en columnas (Por hacer, En curso, Hecho…) y arrastra las tarjetas a medida que avanzan. De un vistazo ves en qué está cada cosa.",
  },
  {
    icon: ListTodo,
    title: "Backlog y Sprints",
    text: "Guarda todo lo pendiente en una lista y agrúpalo en Sprints (bloques de tiempo cortos), como en Jira, sin complicarte.",
  },
  {
    icon: CalendarDays,
    title: "Calendario",
    text: "Mira en un calendario las fechas de entrega de cada tarea y cuándo empieza y termina cada Sprint, todo en un solo lugar.",
  },
  {
    icon: PenSquare,
    title: "Mural colaborativo",
    text: "Una pizarra infinita para dibujar, pegar notas de colores y organizar ideas en vivo con tu equipo, como Mural o Miro — y convertir cualquier nota en una tarea real con un clic.",
  },
  {
    icon: CheckCircle2,
    title: "Pruebas de calidad",
    text: "Escribe los pasos para comprobar que algo funciona, ejecútalos y lleva el control de qué se probó y qué falló.",
  },
  {
    icon: Users,
    title: "Invita a tu equipo",
    text: "Suma personas a tus proyectos por correo o compartiendo un enlace. Cada quien ve solo lo que le corresponde.",
  },
  {
    icon: Bell,
    title: "Notificaciones",
    text: "Te avisamos dentro de la app cuando te asignan algo, comentan tu tarea o te invitan a un proyecto — sin saturar tu correo.",
  },
  {
    icon: Sparkles,
    title: "Tareas grandes en pasos chicos",
    text: "Divide una tarea grande (Épica) en subtareas más manejables para repartir el trabajo entre distintas personas o equipos.",
  },
];

const STEPS = [
  { n: "1", title: "Crea tu cuenta", text: "Gratis, con tu correo. No hace falta tarjeta." },
  { n: "2", title: "Crea un proyecto", text: "Ponle nombre y listo — Altoke arma el flujo de trabajo por ti." },
  { n: "3", title: "Invita a tu equipo", text: "Por correo o con un enlace, para que todos vean lo mismo." },
  { n: "4", title: "Organiza el trabajo", text: "Tablero, backlog, calendario o mural — el que más te acomode." },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className={BUTTON_CLASSES}>
              Ir a mi panel
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink/70 hover:text-ink"
              >
                Iniciar sesión
              </Link>
              <Link href="/signup" className={BUTTON_CLASSES}>
                Crear cuenta gratis
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent2/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-accent3/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-40 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-10 text-center sm:pt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink/60">
            <Sparkles size={13} className="text-accent2" />
            100% gratis, sin trucos
          </span>
          <h1 className="mt-5 text-balance font-heading text-4xl font-semibold leading-tight sm:text-5xl">
            Organiza tus proyectos sin complicarte
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-ink/60 sm:text-lg">
            Altoke es una herramienta para planificar y hacer seguimiento de proyectos en equipo —
            con tablero, backlog, calendario y una pizarra colaborativa. Pensada para que cualquiera
            la use, aunque nunca haya usado algo así antes.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href={user ? "/dashboard" : "/signup"} className={`${BUTTON_CLASSES} px-6 py-3 text-base`}>
              {user ? "Ir a mi panel" : "Crear cuenta gratis"}
              <ArrowRight size={16} />
            </Link>
            {!user && (
              <Link
                href="/login"
                className="rounded-lg border border-border bg-surface px-6 py-3 text-base font-medium hover:bg-bg"
              >
                Ya tengo cuenta
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="text-center font-heading text-2xl font-semibold">¿Cómo se usa?</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
            return (
              <div
                key={step.n}
                className="shadow-soft-hover rounded-xl border border-border bg-surface p-5"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-heading text-sm font-semibold ${color.bg} ${color.text}`}
                >
                  {step.n}
                </span>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-ink/60">{step.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <h2 className="text-center font-heading text-2xl font-semibold">Qué puedes hacer</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-ink/60">
          Todo lo que necesita un equipo para organizarse, explicado en criollo — nada de jerga.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
            return (
              <div
                key={feature.title}
                className="shadow-soft-hover rounded-xl border border-border bg-surface p-5"
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color.bg}`}>
                  <feature.icon size={20} className={color.text} />
                </span>
                <h3 className="mt-3 font-medium">{feature.title}</h3>
                <p className="mt-1 text-sm text-ink/60">{feature.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent2/10 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-14 text-center">
          <h2 className="font-heading text-2xl font-semibold">Empieza en menos de un minuto</h2>
          <p className="max-w-md text-sm text-ink/60">
            No necesitas saber de gestión de proyectos ni haber usado herramientas como esta antes.
          </p>
          <Link href={user ? "/dashboard" : "/signup"} className={`${BUTTON_CLASSES} px-6 py-3 text-base`}>
            {user ? "Ir a mi panel" : "Crear cuenta gratis"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="px-4 py-6 text-center text-xs text-ink/40">
        Altoke — organiza tus proyectos sin complicarte.
      </footer>
    </main>
  );
}
