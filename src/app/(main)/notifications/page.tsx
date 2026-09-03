import { getCurrentSession } from "@/lib/auth";
import Link from "next/link";
import { query } from "@/lib/db";

export default async function NotificationsPage() {
  const session = await getCurrentSession();
  if (!session) {
    return (
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          Notifications
        </h1>
        <p className="text-sm text-muted">
          <Link href="/login" className="text-brand-2">
            Σύνδεσου
          </Link>{" "}
          για να δεις ειδοποιήσεις.
        </p>
      </div>
    );
  }

  const result = await query<{
    id: string;
    title: string;
    body: string | null;
    is_read: boolean;
    created_at: Date;
  }>(
    `SELECT id, title, body, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [session.user.id],
  );

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Notifications
      </h1>
      {result.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          Ήσυχα εδώ. Καμία ειδοποίηση.
        </p>
      ) : (
        <ul className="space-y-2">
          {result.rows.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border border-border px-4 py-3 text-sm ${
                n.is_read ? "bg-surface text-muted" : "bg-surface-2"
              }`}
            >
              <p className="font-semibold">{n.title}</p>
              {n.body ? <p className="text-muted">{n.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
