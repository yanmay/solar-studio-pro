import { describe, it, expect } from 'vitest'
import {
  calcInstalledCapacity,
  calcAnnualEnergy,
  calcSystemCost,
  calcSubsidyInr,
  calcAnnualSavings,
  calcPaybackYears
} from '@/lib/solar-calc'
import { getDiscomRate } from '@/lib/discom-rates'
import { calcUsableArea } from '@/lib/solar-calc'

describe('Financial Model Consistency', () => {
  it('should calculate identical payback for 50m² Maharashtra roof', () => {
    // Inputs
    const areaM2 = 50
    const state = 'MH'
    const peakSunHours = 5.2
    
    // Calculate
    const usableArea = calcUsableArea(areaM2, 0, 0)
    const installedKw = calcInstalledCapacity(usableArea)
    const annualKwh = calcAnnualEnergy(installedKw, peakSunHours)
    const systemCost = calcSystemCost(installedKw)
    const subsidy = calcSubsidyInr(installedKw)
    const electricityRate = getDiscomRate(state) || 7.5
    const annualSavings = calcAnnualSavings(annualKwh, electricityRate)
    const paybackYears = calcPaybackYears(systemCost - subsidy, annualSavings)
    
    // Sanity checks
    expect(installedKw).toBeGreaterThan(0)
    expect(installedKw).toBeLessThanOrEqual(10) // 50m² can't exceed ~10kW
    expect(systemCost).toBeGreaterThan(100000)
    expect(systemCost).toBeLessThan(500000)
    expect(paybackYears).toBeGreaterThan(2)
    expect(paybackYears).toBeLessThan(10)
  })
  
  it('should have consistent tiered pricing across all system sizes', () => {
    const small = calcSystemCost(2)   // 2kW
    const medium = calcSystemCost(5)  // 5kW
    const large = calcSystemCost(12)  // 12kW
    
    expect(small).toBeLessThan(medium)
    expect(medium).toBeLessThan(large)
    // Per-watt cost should decrease for larger systems (economies of scale)
    expect(small / 2).toBeGreaterThan(medium / 5)
    expect(medium / 5).toBeGreaterThan(large / 12)
  })
})
