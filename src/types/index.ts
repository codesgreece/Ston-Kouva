export type PublicUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  createdAt: string;
  lastSeenAt: string | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type DbUser = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: Date;
  updated_at: Date;
  last_seen_at: Date | null;
  is_verified: boolean;
  is_admin: boolean;
  is_moderator: boolean;
  is_banned: boolean;
};

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "interrupted";

export type MatchSummary = {
  id: string;
  status: MatchStatus;
  minute: number | null;
  homeScore: number;
  awayScore: number;
  startTime: string | null;
  lastSyncedAt: string | null;
  homeTeam: {
    id: string;
    name: string;
    nameEl: string | null;
    flagEmoji: string | null;
    shortName: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    nameEl: string | null;
    flagEmoji: string | null;
    shortName: string | null;
  };
  room: {
    id: string;
    activeCount: number;
    memberCount: number;
  } | null;
};
