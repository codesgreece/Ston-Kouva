import { z } from "zod";

const teamSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  shortName: z.string().optional(),
  slug: z.string().optional(),
});

const statusSchema = z
  .object({
    code: z.number().optional(),
    type: z.string().optional(),
    description: z.string().optional(),
  })
  .optional();

export const sofaScoreEventSchema = z.object({
  id: z.number(),
  slug: z.string().optional(),
  startTimestamp: z.number().optional(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  status: statusSchema,
  homeScore: z.record(z.string(), z.unknown()).optional(),
  awayScore: z.record(z.string(), z.unknown()).optional(),
  score: z
    .object({
      current: z
        .object({
          home: z.number().optional(),
          away: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  time: z
    .object({
      minute: z.number().optional(),
      injury: z.number().optional(),
      played: z.number().optional(),
      currentPeriodStartTimestamp: z.number().optional(),
    })
    .optional(),
  tournament: z
    .object({
      name: z.string().optional(),
      slug: z.string().optional(),
      uniqueTournament: z
        .object({
          id: z.number(),
          name: z.string().optional(),
          slug: z.string().optional(),
          category: z
            .object({
              name: z.string().optional(),
              slug: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      category: z
        .object({
          name: z.string().optional(),
          slug: z.string().optional(),
        })
        .optional(),
      season: z
        .object({
          id: z.number().optional(),
          name: z.string().optional(),
        })
        .optional(),
      roundInfo: z
        .object({
          round: z.number().optional(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  venue: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
});

export const sofaScoreEventsResponseSchema = z.object({
  events: z.array(z.unknown()).default([]),
});

export const sofaScoreEventDetailSchema = z.object({
  event: sofaScoreEventSchema.optional(),
});

export type ValidatedSofaScoreEvent = z.infer<typeof sofaScoreEventSchema>;
