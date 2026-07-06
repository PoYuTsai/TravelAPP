#!/usr/bin/env node

import { buildDoctorReport, formatDoctorReport } from './doctor.mjs'

async function main() {
  const report = await buildDoctorReport()
  console.log(formatDoctorReport(report))
  if (!report.ready) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
