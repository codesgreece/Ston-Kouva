"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FollowButton({
  username,
  initiallyFollowing = false,
}: {
  username: string;
  initiallyFollowing?: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${username}/follow`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setFollowing(Boolean(data.following));
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={toggle}
      className={`rounded-xl px-4 py-2 text-sm font-bold ${
        following
          ? "border border-border text-muted"
          : "bg-brand text-[#1a0d00]"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
