import { z } from 'zod'
import type { Assistant, AssistantInput } from '../../preload/shared/types'

export const ProviderIdSchema = z.enum(['openai', 'anthropic'])

export const ChatWindowSizeSchema = z.enum(['small', 'medium', 'large'])

// Overlay window opacity. Floored at 0.5 so the chat stays legible — the UI
// exposes this as "transparency" (0–50%), i.e. 1 - opacity.
export const ChatWindowOpacitySchema = z.number().min(0.5).max(1)

export const ThemeSchema = z.enum(['system', 'dark', 'light'])

// App-wide text zoom factor (Ctrl +/-/0). Kept in sync with the renderer's
// ZOOM_MIN/ZOOM_MAX; validated loosely and clamped so a stray value can't throw.
export const TextZoomSchema = z.number().min(0.8).max(2.5)

// Constrained against the shared Assistant type so this validator and the
// renderer-facing type in preload/shared/types.ts can't silently drift.
export const AssistantSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  systemPrompt: z.string().max(20000),
  provider: ProviderIdSchema,
  model: z.string().min(1).max(200),
  shortcut: z.string(),
  resetChatOnClose: z.boolean(),
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
  resetChatOnClose: true,
  prefillClipboard: true
}) satisfies z.ZodType<AssistantInput>
