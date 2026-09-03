"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BucketReaction } from "@/components/ui/Badges";

type Post = {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe?: boolean;
  bookmarkedByMe?: boolean;
  user: { username: string; displayName: string };
  matchId?: string | null;
};

export function CreatePostBox({ matchId }: { matchId?: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, matchId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Αποτυχία");
      return;
    }
    setContent("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={4000}
        rows={3}
        placeholder="Τι παίζει στον Κουβά;"
        className="w-full resize-none rounded-xl bg-surface-2 px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
      />
      <div className="mt-2 flex items-center justify-between">
        {error ? <p className="text-xs text-live">{error}</p> : <span />}
        <button
          type="submit"
          disabled={!content.trim()}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-[#1a0d00] disabled:opacity-50"
        >
          Δημοσίευση
        </button>
      </div>
    </form>
  );
}

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();

  async function like() {
    await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    router.refresh();
  }

  async function bucket() {
    await fetch(`/api/posts/${post.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction: "bucket" }),
    });
    router.refresh();
  }

  async function bookmark() {
    await fetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
    router.refresh();
  }

  return (
    <article className="animate-fade-up rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-sm font-bold text-brand">
          {post.user.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <Link
            href={`/profile/${post.user.username}`}
            className="text-sm font-semibold hover:text-brand-2"
          >
            @{post.user.username}
          </Link>
          <p className="text-xs text-muted">
            {new Date(post.createdAt).toLocaleString("el-GR")}
          </p>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <button type="button" onClick={like} className="hover:text-live">
          ❤️ {post.likeCount}
        </button>
        <span>💬 {post.commentCount}</span>
        <button type="button" onClick={bucket}>
          <BucketReaction />
        </button>
        <button type="button" onClick={bookmark} className="hover:text-brand-2">
          {post.bookmarkedByMe ? "🔖" : "🔖"} Bookmark
        </button>
      </div>
    </article>
  );
}
