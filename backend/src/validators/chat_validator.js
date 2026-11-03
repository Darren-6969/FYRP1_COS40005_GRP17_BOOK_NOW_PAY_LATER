import { z } from "zod";

const id = z.coerce.number().int().positive();

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("welcome") }),
  z.object({ type: z.literal("quick"), key: z.string().trim().min(1).max(60) }),
  z.object({ type: z.literal("guided"), value: z.string().trim().min(1).max(40) }),
]);

// The window sends either typed text or a button press (action).
// Length beyond the admin's limit is answered with a request to shorten,
// so only an absurd length is rejected here.
export const chatMessageSchema = z
  .object({
    conversationId: id.optional(),
    visitorToken: z.string().regex(/^[a-f0-9]{48}$/).optional().nullable(),
    listingId: id.nullable().optional(),
    text: z.string().max(4000).optional(),
    action: action.optional(),
  })
  .refine((b) => b.action || (b.text && b.text.trim()), { message: "Type a message or pick an option.", path: ["text"] });

export const chatFeedbackSchema = z.object({
  visitorToken: z.string().regex(/^[a-f0-9]{48}$/).optional().nullable(),
  feedback: z.enum(["UP", "DOWN"]).nullable(),
});
