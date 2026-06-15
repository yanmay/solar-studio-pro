import { track } from '@vercel/analytics'

export const trackAddressSearched = () => track('address_searched')

export const trackPolygonCompleted = (areaMq: number) => 
  track('polygon_completed', { area_m2: Math.round(areaMq) })

export const trackConfigStepCompleted = (step: 1 | 2 | 3) => 
  track('config_step_completed', { step })

export const trackResultsViewed = (systemKwp: number) => 
  track('results_viewed', { system_kwp: Math.round(systemKwp * 10) / 10 })

export const trackPaywallShown = () => track('paywall_shown')

export const trackPaymentInitiated = (plan: string) => 
  track('payment_initiated', { plan })

export const trackPaymentCompleted = (plan: string) => 
  track('payment_completed', { plan })

export const trackPdfDownloaded = () => track('pdf_downloaded')
