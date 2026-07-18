import { z } from 'zod'
import type { Assistant, AssistantInput } from '../../preload/shared/types'

export const ProviderIdSchema = z.enum(['openai', 'anthropic'])

export const ChatWindowSizeSchema = z.enum(['small', 'medium', 'large'])

// Overlay window opacity. Floored at 0.5 so the chat stays legible — the UI
// exposes this as "transparency" (0–50%), i.e. 1 - opacity.
export const ChatWindowOpacitySchema = z.number().min(0.5).max(1)

// Constrained against the shared Assistant type so this validator and the
// renderer-facing type in preload/shared/types.ts can't silently drift.
export const AssistantSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  systemPrompt: z.string().max(20000),
  provider: ProviderIdSchema,
  model: z.string().min(1).max(200),
  shortcut: z.string(),
  prefillClipboard: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
}) satisfies z.ZodType<Assistant>

export const AssistantInputSchema = AssistantSchema.pick({
  name: true,
  systemPrompt: true,
  provider: true,
  model: true,
  shortcut: true,
  prefillClipboard: true
}) satisfies z.ZodType<AssistantInput>
