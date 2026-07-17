import { app } from 'electron'
import http from 'node:http'

const CHECK_INTERVAL_MS = 5000
const FAILURES_BEFORE_QUIT = 3

// Dev-only guard: if the terminal running `npm run dev` is Ctrl+C'd while
// the app is open, the Electron process can survive as an orphan holding
// the global hotkey and single-instance lock — but its UI is gone with the
// dev server, leaving a ghost window and blocking relaunches. Quit once the
// dev server stops answering.
export function startDevServerWatchdog(rendererUrl: string): void {
  let consecutiveFailures = 0

  setInterval(() => {
    const request = http.get(rendererUrl, { timeout: 2000 }, (res) => {
      res.resume()
      consecutiveFailures = 0
    })
    request.on('error', onFailure)
    request.on('timeout', () => {
      request.destroy()
      onFailure()
    })
  }, CHECK_INTERVAL_MS)

  function onFailure(): void {
    consecutiveFailures += 1
    if (consecutiveFailures >= FAILURES_BEFORE_QUIT) {
      console.log('Hotkey AI: dev server is gone — exiting to avoid a ghost instance.')
      app.quit()
    }
  }
}
