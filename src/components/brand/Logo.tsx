import Link from "next/link";

type LogoProps = {
  size?: number;
  className?: string;
  showWordmark?: boolean;
};

/** Minimal bucket + ball + speech mark — temporary brand mark */
export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M14 26c0-2 1.5-4 4-5l14-5 14 5c2.5 1 4 3 4 5v6c0 10-7 18-18 18S14 42 14 32v-6z"
        fill="#FF7A00"
      />
      <path
        d="M18 28h28v4c0 8-5.5 14-14 14s-14-6-14-14v-4z"
        fill="#FF9F43"
        opacity="0.9"
      />
      <circle cx="32" cy="22" r="9" fill="#F5F5F5" />
      <path
        d="M32 13.5c-1.2 1.8-1.8 3.5-1.8 5.2 0 1.4.4 2.6 1.1 3.6M32 13.5c1.2 1.8 1.8 3.5 1.8 5.2 0 1.4-.4 2.6-1.1 3.6M24.5 20.5h15M26 26.5c1.8 1.2 3.8 1.8 6 1.8s4.2-.6 6-1.8"
        stroke="#080808"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M46 38c6 1 10 5 10 10 0 0-4-1-7-1-2 3-5 5-9 5 2-3 3-7 6-14z"
        fill="#2A2A2A"
        stroke="#FF7A00"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function Logo({ size = 28, className = "", showWordmark = true }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 group ${className}`}
      aria-label="ΣΤΟΝ ΚΟΥΒΑ! Αρχική"
    >
      <BrandMark size={size} className="shrink-0 transition-transform group-hover:scale-105" />
      {showWordmark ? (
        <span className="font-[family-name:var(--font-display)] text-[1.05rem] sm:text-lg font-extrabold tracking-tight text-text">
          ΣΤΟΝ ΚΟΥΒΑ<span className="text-brand">!</span>
        </span>
      ) : null}
    </Link>
  );
}
