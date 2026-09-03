import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Άνοιξε λογαριασμό
      </h1>
      <p className="mb-6 text-sm text-muted">3–20 χαρακτήρες, γράμματα, αριθμοί, _</p>
      <RegisterForm />
    </div>
  );
}
