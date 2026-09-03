import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo size={36} />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {children}
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-muted">
        Δεν είμαστε bookmaker. Προβλέψεις = κουβέντα, όχι χρηματικές συμβουλές.
      </p>
    </div>
  );
}
