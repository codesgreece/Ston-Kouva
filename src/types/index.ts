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
  | "upcoming"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "canceled"
  | "suspended"
  | "unknown";

export type MatchSummary = {
  id: string;
  slug: string | null;
  status: MatchStatus;
  minute: number | null;
  injuryTime: number | null;
  homeScore: number;
  awayScore: number;
  startTime: string | null;
  lastSyncedAt: string | null;
  competitionName: string | null;
  categoryName: string | null;
  isLive: boolean;
  isStale: boolean;
  homeTeam: {
    id: string;
    name: string;
    nameEl: string | null;
    flagEmoji: string | null;
    shortName: string | null;
    logoUrl: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    nameEl: string | null;
    flagEmoji: string | null;
    shortName: string | null;
    logoUrl: string | null;
  };
  room: {
    id: string;
    activeCount: number;
    memberCount: number;
  } | null;
  activityScore?: number;
};
