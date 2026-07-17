import { app } from 'electron'
import { join } from 'node:path'

export function userDataPath(...segments: string[]): string {
  return join(app.getPath('userData'), ...segments)
}
