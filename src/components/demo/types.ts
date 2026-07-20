export type PublicDemoScenario = {
  id: "medical-spa" | "aesthetic-clinic" | "laser-clinic" | "cosmetic-dermatology"
  label: string
  businessName: string
  shortDescription: string
  location: string
  timezone: string
  tone: string
  theme: string
  welcomeMessage: string
  consultationPolicy: string
  cancellationPolicy: string
  hours: Array<{ day: string; open: boolean; from: string; to: string }>
  services: Array<{ name: string; description: string; duration: string }>
  faqs: Array<{ question: string; answer: string; category: string }>
}

export type DemoMessage = {
  id: string
  role: "visitor" | "assistant"
  content: string
  source?: string
  createdAt: string
}

export type DemoLead = {
  id: string
  name: string
  email: string
  phone: string
  service: string
  preferredDate: string
  preferredTime: string
  notes: string
  consentGiven: boolean
  status: string
  assignedTo: string
  createdAt: string
  environment: "public_demo"
  isBillable: false
}

export type DemoSession = {
  id: string
  status: string
  messageCount: number
  maxMessages: number
  leadCreated: boolean
  salesLeadCreated: boolean
  completionPercentage: number
  currentStep: string
  expiresAt: string
}

