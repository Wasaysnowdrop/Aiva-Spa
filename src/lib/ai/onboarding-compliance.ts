import type { SetupAssistantSection } from "./setup-assistant-schema"

export type ComplianceRequestScope = {
  step: SetupAssistantSection
  submissionId: string
  messageId: string
  inputHash: string
}

export type ActiveComplianceScope = {
  currentStep: SetupAssistantSection
  latestSubmissionId: string | null
  latestInputHash: string | null
  mounted: boolean
}

export function isComplianceResultStale(
  request: ComplianceRequestScope,
  active: ActiveComplianceScope,
): boolean {
  return !active.mounted
    || request.step !== active.currentStep
    || request.submissionId !== active.latestSubmissionId
    || request.inputHash !== active.latestInputHash
}
