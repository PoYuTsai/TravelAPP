type ThaiRecorderAccessInput = {
  nodeEnv?: string
  recorderEnabled?: string
}

export function canUseThaiRecorder({
  nodeEnv = process.env.NODE_ENV,
  recorderEnabled = process.env.THAI_RECORDER_ENABLED,
}: ThaiRecorderAccessInput = {}) {
  return nodeEnv !== 'production' || recorderEnabled === 'true'
}
