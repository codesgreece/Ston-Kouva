import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Καλώς στον Κουβά
      </h1>
      <p className="mb-6 text-sm text-muted">Συνδέσου και μπες στη συζήτηση.</p>
      <LoginForm />
    </div>
  );
}
