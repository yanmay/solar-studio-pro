import unittest
import json
from solar_engine import calculate_solar_yield

class TestSolarEngine(unittest.TestCase):
    def test_inland_low_wind_scenario(self):
        # Delhi/Nagpur-like inland profile with low wind speeds
        data = {
            "latitude": 28.6139,
            "longitude": 77.2090,
            "tilt": 15.0,
            "azimuth": 180.0,
            "albedo": 0.2,
            "system_size_kwp": 5.0,
            "monthly_ghi": [4.5] * 12,
            "monthly_dhi": [1.5] * 12,
            "monthly_temp": [25.0] * 12,
            "monthly_wind_speed": [2.0] * 12, # mean = 2.0 -> basic_ws = 20.0 (Zone 1)
            "elevation_m": 218.0
        }
        results = calculate_solar_yield(data)
        
        self.assertEqual(results["wind_zone"], "Zone 1")
        self.assertEqual(results["wind_zone_label"], "Low")
        self.assertEqual(results["structural_factor"], 1.0)
        self.assertFalse(results["high_wind_warning"])
        
        # Check pressure calc at 218m elevation
        expected_pressure = 101325.0 * (1.0 - 2.25577e-5 * 218.0) ** 5.25588
        self.assertAlmostEqual(results["calculated_pressure_pa"], expected_pressure, places=2)
        self.assertEqual(len(results["monthly_yields_kwh"]), 12)

    def test_high_wind_coastal_scenario(self):
        # Coastal profile with high wind speeds in certain months
        # Let's exceed Zone 2 threshold (3.9 m/s) for 5 consecutive months
        monthly_wind = [2.5, 2.5, 2.5, 5.0, 5.0, 5.0, 5.0, 5.0, 2.5, 2.5, 2.5, 2.5]
        data = {
            "latitude": 19.8130, # Puri
            "longitude": 85.8312,
            "tilt": 15.0,
            "azimuth": 180.0,
            "albedo": 0.2,
            "system_size_kwp": 5.0,
            "monthly_ghi": [5.0] * 12,
            "monthly_dhi": [1.5] * 12,
            "monthly_temp": [27.0] * 12,
            "monthly_wind_speed": monthly_wind,
            "elevation_m": 0.0 # sea-level
        }
        
        # Mean wind = (2.5*7 + 5.0*5)/12 = (17.5 + 25.0)/12 = 42.5/12 = 3.54 m/s -> basic_ws = 35.4 m/s (Zone 2)
        # Zone 2 threshold = 3.9 m/s.
        # Exceeds threshold of 3.9 m/s in months index 3,4,5,6,7 (5 consecutive months with wind 5.0 > 3.9).
        results = calculate_solar_yield(data)
        
        self.assertEqual(results["wind_zone"], "Zone 2")
        self.assertEqual(results["wind_zone_label"], "Moderate")
        self.assertEqual(results["structural_factor"], 0.95)
        self.assertTrue(results["high_wind_warning"]) # Should be true because max_consec = 5 > 4
        self.assertEqual(results["calculated_pressure_pa"], 101325.0)

    def test_extreme_cyclone_zone(self):
        # Zone 5/6 scenario where basic_ws > 50 m/s
        data = {
            "latitude": 20.2520, # Paradip
            "longitude": 86.6661,
            "tilt": 15.0,
            "azimuth": 180.0,
            "albedo": 0.2,
            "system_size_kwp": 5.0,
            "monthly_ghi": [5.0] * 12,
            "monthly_dhi": [1.5] * 12,
            "monthly_temp": [27.0] * 12,
            "monthly_wind_speed": [5.5] * 12, # mean = 5.5 -> basic = 55.0 (> 50.0)
            "elevation_m": 5.0
        }
        results = calculate_solar_yield(data)
        
        self.assertEqual(results["wind_zone"], "Zone 5/6")
        self.assertEqual(results["wind_zone_label"], "Very High")
        self.assertEqual(results["structural_factor"], 0.75)
        self.assertTrue(results["high_wind_warning"]) # since wind speed (5.5) > threshold (5.0) for all 12 months

    def test_shading_degradation_impact(self):
        # Baseline (shading='none')
        base_data = {
            "latitude": 28.6139,
            "longitude": 77.2090,
            "tilt": 15.0,
            "azimuth": 180.0,
            "albedo": 0.2,
            "system_size_kwp": 5.0,
            "monthly_ghi": [4.5] * 12,
            "monthly_dhi": [1.5] * 12,
            "monthly_temp": [25.0] * 12,
            "monthly_wind_speed": [2.0] * 12,
            "elevation_m": 218.0,
            "shading": "none"
        }
        
        base_results = calculate_solar_yield(base_data)
        
        # Heavy shading (shading='heavy')
        heavy_data = base_data.copy()
        heavy_data["shading"] = "heavy"
        
        heavy_results = calculate_solar_yield(heavy_data)
        
        yield_reduction_pct = (base_results["annual_yield_kwh"] - heavy_results["annual_yield_kwh"]) / base_results["annual_yield_kwh"]
        
        # Heavy shading has S = 30%. The output yield reduction should be around 30% (e.g. 29% - 31%)
        self.assertAlmostEqual(yield_reduction_pct, 0.30, delta=0.015)
        self.assertEqual(heavy_results["horizon_shading_loss"], 0.30)

if __name__ == "__main__":
    unittest.main()
