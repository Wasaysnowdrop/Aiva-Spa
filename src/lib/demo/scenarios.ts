import type { ServiceCategory } from "@/lib/kb/service-categories"

export const DEMO_SCENARIO_IDS = [
  "medical-spa",
  "aesthetic-clinic",
  "laser-clinic",
  "cosmetic-dermatology",
] as const

export type DemoScenarioId = (typeof DEMO_SCENARIO_IDS)[number]

export type DemoScenario = {
  id: DemoScenarioId
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
  services: Array<{
    name: string
    category: ServiceCategory
    description: string
    duration: string
    pricingRule: string
  }>
  faqs: Array<{ question: string; answer: string; category: "General" | "Pricing" | "Booking" | "Safety" | "Hours" }>
}

const weekdays = (saturday = true) => [
  { day: "Mon", open: true, from: "09:00", to: "18:00" },
  { day: "Tue", open: true, from: "09:00", to: "18:00" },
  { day: "Wed", open: true, from: "09:00", to: "19:00" },
  { day: "Thu", open: true, from: "09:00", to: "19:00" },
  { day: "Fri", open: true, from: "09:00", to: "17:00" },
  { day: "Sat", open: saturday, from: "10:00", to: "15:00" },
  { day: "Sun", open: false, from: "09:00", to: "17:00" },
]

const sharedFaqs: DemoScenario["faqs"] = [
  {
    question: "Do you offer free consultations?",
    answer: "Consultations are complimentary. A request is not confirmed until our team reviews it and contacts you with availability.",
    category: "Booking",
  },
  {
    question: "Can you tell me which treatment is right for me?",
    answer: "I can share general information about approved services, but only a licensed provider can assess suitability or recommend a treatment during a consultation.",
    category: "Safety",
  },
  {
    question: "How much do treatments cost?",
    answer: "Pricing varies by treatment and individual needs. A licensed provider confirms exact pricing during your consultation.",
    category: "Pricing",
  },
  {
    question: "What is your cancellation policy?",
    answer: "Please give at least 24 hours notice for changes. The team confirms any applicable fee when your appointment is booked.",
    category: "Booking",
  },
]

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenario> = {
  "medical-spa": {
    id: "medical-spa",
    label: "Medical Spa",
    businessName: "Glow Aesthetics",
    shortDescription: "Injectables, skin treatments, and thoughtful consultation care.",
    location: "Marina District, San Francisco",
    timezone: "America/Los_Angeles",
    tone: "Warm, professional, calm, and reassuring",
    theme: "#E2E54B",
    welcomeMessage: "Hi, welcome to Glow Aesthetics. How can I help you explore treatments or request a consultation today?",
    consultationPolicy: "Complimentary consultations are available by request and require team confirmation.",
    cancellationPolicy: "At least 24 hours notice is requested for changes or cancellations.",
    hours: weekdays(),
    services: [
      { name: "Botox Cosmetic", category: "Injectables", description: "A provider-led wrinkle-relaxing treatment consultation for expression lines.", duration: "30 minutes", pricingRule: "Exact units and pricing are confirmed by a licensed provider at consultation." },
      { name: "Dermal Fillers", category: "Injectables", description: "Consultation-led treatment designed to restore or enhance facial volume.", duration: "45 minutes", pricingRule: "Product choice, amount, and pricing are confirmed at consultation." },
      { name: "HydraFacial", category: "Facials", description: "A multi-step cleansing, exfoliation, and hydration facial.", duration: "50 minutes", pricingRule: "Pricing depends on the selected HydraFacial plan and is confirmed by the team." },
      { name: "Microneedling", category: "Skin Rejuvenation", description: "A provider-supervised skin rejuvenation treatment for texture concerns.", duration: "60 minutes", pricingRule: "Suitability and exact pricing are confirmed at consultation." },
      { name: "Chemical Peels", category: "Skin Rejuvenation", description: "Professional peel options selected according to skin goals and provider assessment.", duration: "45 minutes", pricingRule: "Peel type and price are confirmed after a skin consultation." },
      { name: "Laser Hair Removal", category: "Laser Treatments", description: "A consultation-led laser hair reduction program for approved treatment areas.", duration: "Varies by area", pricingRule: "Package pricing depends on treatment area and is confirmed by the team." },
      { name: "Acne Treatments", category: "Skin Rejuvenation", description: "Custom facial and skin-care options discussed after a provider assessment.", duration: "Varies", pricingRule: "The team confirms a treatment plan and price after consultation." },
      { name: "Skin Consultation", category: "Other", description: "A one-to-one review of skin goals with a qualified provider.", duration: "30 minutes", pricingRule: "Complimentary by request; confirmation is required." },
    ],
    faqs: sharedFaqs,
  },
  "aesthetic-clinic": {
    id: "aesthetic-clinic",
    label: "Aesthetic Clinic",
    businessName: "Luma Aesthetic Clinic",
    shortDescription: "Refined facial aesthetics with a consultation-first approach.",
    location: "Scottsdale, Arizona",
    timezone: "America/Phoenix",
    tone: "Polished, concise, welcoming, and discreet",
    theme: "#FF77E9",
    welcomeMessage: "Welcome to Luma. I can help with our aesthetic services or submit a consultation request. What would you like to explore?",
    consultationPolicy: "All injectable and advanced skin services begin with a provider consultation.",
    cancellationPolicy: "Changes require 24 hours notice; the clinic confirms any fee when booking.",
    hours: weekdays(false),
    services: [
      { name: "Wrinkle Relaxers", category: "Injectables", description: "Provider-administered treatment for selected expression lines.", duration: "30 minutes", pricingRule: "Pricing is based on the provider assessment and treatment plan." },
      { name: "Lip Enhancement Consultation", category: "Injectables", description: "A consultation to discuss proportion, goals, and suitable filler options.", duration: "30 minutes", pricingRule: "Product and pricing are confirmed only after assessment." },
      { name: "Biostimulator Consultation", category: "Injectables", description: "A provider conversation about collagen-supporting injectable options.", duration: "30 minutes", pricingRule: "Suitability and pricing require an in-person consultation." },
      { name: "Signature Facial", category: "Facials", description: "A tailored cleansing and hydration facial for routine skin maintenance.", duration: "60 minutes", pricingRule: "The team confirms current facial pricing." },
      { name: "RF Microneedling", category: "Skin Rejuvenation", description: "An advanced consultation-led treatment for texture and skin rejuvenation goals.", duration: "75 minutes", pricingRule: "Package recommendations and prices are confirmed at consultation." },
    ],
    faqs: [...sharedFaqs, { question: "Do you guarantee results?", answer: "No. Results vary, and the provider will explain realistic expectations, risks, and alternatives during consultation.", category: "Safety" }],
  },
  "laser-clinic": {
    id: "laser-clinic",
    label: "Laser Hair Removal Clinic",
    businessName: "Bareline Laser Studio",
    shortDescription: "Focused laser hair reduction with clear, careful guidance.",
    location: "Austin, Texas",
    timezone: "America/Chicago",
    tone: "Friendly, direct, informative, and inclusive",
    theme: "#22D3EE",
    welcomeMessage: "Hi, welcome to Bareline Laser Studio. Ask me about treatment areas, preparation, or requesting a consultation.",
    consultationPolicy: "A patch-test or consultation may be required before the first treatment; the team confirms next steps.",
    cancellationPolicy: "Please give 24 hours notice when changing an appointment.",
    hours: weekdays(),
    services: [
      { name: "Face Laser Hair Removal", category: "Laser Treatments", description: "Laser hair reduction for approved facial areas following a suitability review.", duration: "15-30 minutes", pricingRule: "Pricing depends on area and package; the team confirms it after consultation." },
      { name: "Underarm Laser Hair Removal", category: "Laser Treatments", description: "A short laser hair reduction session for the underarm area.", duration: "20 minutes", pricingRule: "Single-session and package pricing are confirmed by the team." },
      { name: "Bikini Laser Hair Removal", category: "Laser Treatments", description: "A consultation-led laser hair reduction option with selectable treatment areas.", duration: "20-35 minutes", pricingRule: "The selected area determines pricing; final details require consultation." },
      { name: "Full Legs Laser Hair Removal", category: "Laser Treatments", description: "Laser hair reduction for the full-leg area following a suitability review.", duration: "60 minutes", pricingRule: "Package pricing is confirmed after consultation." },
      { name: "Laser Consultation", category: "Laser Treatments", description: "A review of skin, hair, goals, preparation, and the recommended next step.", duration: "20 minutes", pricingRule: "Complimentary by request; confirmation is required." },
    ],
    faqs: [...sharedFaqs, { question: "How many sessions will I need?", answer: "The number of sessions varies by area, hair, skin, and response. The laser specialist can discuss a realistic plan during consultation.", category: "General" }],
  },
  "cosmetic-dermatology": {
    id: "cosmetic-dermatology",
    label: "Cosmetic Dermatology Clinic",
    businessName: "Northstar Cosmetic Dermatology",
    shortDescription: "Physician-led cosmetic dermatology and skin rejuvenation.",
    location: "Seattle, Washington",
    timezone: "America/Los_Angeles",
    tone: "Clinical, clear, empathetic, and never alarmist",
    theme: "#34D399",
    welcomeMessage: "Welcome to Northstar Cosmetic Dermatology. I can share general service information or help request a cosmetic consultation.",
    consultationPolicy: "Treatment suitability, diagnosis, and personalised recommendations require an appointment with a licensed clinician.",
    cancellationPolicy: "The clinic requests 48 hours notice for appointment changes.",
    hours: weekdays(false),
    services: [
      { name: "Cosmetic Skin Consultation", category: "Other", description: "A clinician-led discussion of cosmetic skin goals and available options.", duration: "40 minutes", pricingRule: "The clinic confirms consultation fees before the visit." },
      { name: "IPL Photofacial", category: "Laser Treatments", description: "A light-based cosmetic treatment considered after clinician assessment.", duration: "45 minutes", pricingRule: "Suitability, treatment area, and pricing are confirmed at consultation." },
      { name: "Fractional Laser Resurfacing", category: "Laser Treatments", description: "An advanced resurfacing option discussed after a clinical skin assessment.", duration: "Varies", pricingRule: "A clinician must confirm candidacy, plan, and exact pricing." },
      { name: "Medical-Grade Chemical Peel", category: "Skin Rejuvenation", description: "Clinician-selected peel options for cosmetic skin goals.", duration: "45 minutes", pricingRule: "Peel strength and pricing are confirmed after assessment." },
      { name: "Neuromodulator Consultation", category: "Injectables", description: "A cosmetic consultation about wrinkle-relaxing injectable options.", duration: "30 minutes", pricingRule: "Exact product, units, and pricing are confirmed by the clinician." },
    ],
    faqs: [...sharedFaqs, { question: "Can you diagnose my skin condition here?", answer: "No. This chat cannot diagnose or provide personalised medical advice. Please seek an appointment with a qualified clinician for diagnosis or urgent care when appropriate.", category: "Safety" }],
  },
}

export function isDemoScenarioId(value: unknown): value is DemoScenarioId {
  return typeof value === "string" && DEMO_SCENARIO_IDS.includes(value as DemoScenarioId)
}

export function getDemoScenario(value: unknown): DemoScenario {
  return DEMO_SCENARIOS[isDemoScenarioId(value) ? value : "medical-spa"]
}

export function publicScenario(scenario: DemoScenario) {
  return {
    id: scenario.id,
    label: scenario.label,
    businessName: scenario.businessName,
    shortDescription: scenario.shortDescription,
    location: scenario.location,
    timezone: scenario.timezone,
    tone: scenario.tone,
    theme: scenario.theme,
    welcomeMessage: scenario.welcomeMessage,
    consultationPolicy: scenario.consultationPolicy,
    cancellationPolicy: scenario.cancellationPolicy,
    hours: scenario.hours,
    services: scenario.services.map(({ name, description, duration }) => ({ name, description, duration })),
    faqs: scenario.faqs,
  }
}

