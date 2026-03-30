export const APP_VERSION = 'v0.1.0'

const buildSource =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_REF ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  ''

export const APP_BUILD_ID = buildSource ? buildSource.slice(0, 7) : 'local'
export const APP_BUILD_LABEL = `${APP_VERSION} · ${APP_BUILD_ID}`
