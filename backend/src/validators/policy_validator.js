import { z } from "zod";

const text = (max) => z.string().trim().min(1, "Required").max(max);

export const publishSectionSchema = z.object({
  title: text(200),
  body: text(10000),
  baseVersion: z.number().int().positive(),
});

// afterKey: the section the new one goes after; null puts it at the top.
export const createSectionSchema = z.object({
  title: text(200),
  body: text(10000),
  afterKey: z.string().trim().min(1).max(80).nullable(),
});

export const publishTemplateSchema = z.object({
  quickActionLabel: z.string().trim().max(60).nullable().optional().transform((v) => (v ? v : null)),
  keywords: z
    .array(z.string().trim().toLowerCase().max(40))
    .max(30)
    .default([])
    .transform((list) => [...new Set(list.filter(Boolean))]),
  body: text(2000),
  baseVersion: z.number().int().positive(),
});
