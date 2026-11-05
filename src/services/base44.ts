import { createClient } from '@base44/sdk'

const appId = import.meta.env.VITE_BASE44_APP_ID

/**
 * Optional Base44 client for user-approved sync features.
 * Core extension behavior remains local-first and does not require credentials.
 */
export const base44 = appId
  ? createClient({
      appId,
      appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
      functionsVersion: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION,
    })
  : null

export const isBase44Configured = Boolean(base44)
