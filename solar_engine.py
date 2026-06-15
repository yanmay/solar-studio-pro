import sys
import json
import numpy as np
import pandas as pd
import pvlib
from pvlib import irradiance, location, temperature

def calculate_solar_yield(data):
    lat = data.get('latitude', 20.5937)
    lng = data.get('longitude', 78.9629)
    tilt = data.get('tilt', 15.0)
    azimuth = data.get('azimuth', 180.0)
    albedo = data.get('albedo', 0.2)
    system_size_kw = data.get('system_size_kwp', 1.0)
    
    monthly_ghi = data.get('monthly_ghi')  # list of 12 values (kWh/m2/day)
    monthly_dhi = data.get('monthly_dhi')  # list of 12 values (kWh/m2/day)
    monthly_temp = data.get('monthly_temp')  # list of 12 values (degC)
    monthly_wind = data.get('monthly_wind_speed')  # list of 12 values (m/s)
    
    elevation = data.get('elevation_m', 0.0)
    if elevation is None:
        elevation = 0.0
    pressure = 101325.0 * (1.0 - 2.25577e-5 * elevation) ** 5.25588

    shading_type = data.get('shading', 'none')
    if shading_type == 'partial':
        shading_loss = 0.15
    elif shading_type == 'heavy':
        shading_loss = 0.30
    else:
        shading_loss = 0.0

    # Wind-zone logic (IS 875 Part 3)
    mean_ws = sum(monthly_wind) / 12.0
    basic_ws = mean_ws * 10.0
    
    if basic_ws < 33.0:
        wind_zone = "Zone 1"
        zone_label = "Low"
        structural_factor = 1.0
        zone_threshold = 3.3
    elif basic_ws < 39.0:
        wind_zone = "Zone 2"
        zone_label = "Moderate"
        structural_factor = 0.95
        zone_threshold = 3.9
    elif basic_ws < 44.0:
        wind_zone = "Zone 3"
        zone_label = "High"
        structural_factor = 0.90
        zone_threshold = 4.4
    elif basic_ws < 50.0:
        wind_zone = "Zone 4"
        zone_label = "Very High"
        structural_factor = 0.85
        zone_threshold = 4.7
    else:
        wind_zone = "Zone 5/6"
        zone_label = "Very High"
        structural_factor = 0.75
        zone_threshold = 5.0

    # Check if WS10M exceeds threshold for >4 consecutive months
    max_consec = 0
    current_consec = 0
    double_wind = monthly_wind + monthly_wind
    for ws in double_wind:
        if ws > zone_threshold:
            current_consec += 1
            if current_consec > max_consec:
                max_consec = current_consec
        else:
            current_consec = 0
            
    high_wind_warning = max_consec > 4

    loc = location.Location(lat, lng, altitude=elevation)
    
    months_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    monthly_yields_kwh = []
    cell_temps = []
    poa_globals = []

    # Iterate through each month
    for m_idx in range(12):
        days_in_month = months_days[m_idx]
        ghi_day = monthly_ghi[m_idx]
        dhi_day = monthly_dhi[m_idx]
        temp_air = monthly_temp[m_idx]
        wind_speed = monthly_wind[m_idx]
        
        # Create an hourly index for a representative day (the 15th) of the month
        tz = 'Asia/Kolkata'
        times = pd.date_range(
            start=f'2024-{m_idx+1:02d}-15 00:00:00', 
            end=f'2024-{m_idx+1:02d}-15 23:00:00', 
            freq='h', 
            tz=tz
        )
        
        solpos = loc.get_solarposition(times, pressure=pressure)
        zenith = solpos['zenith']
        
        # Distribute GHI/DHI using the clear sky profile
        clearsky = loc.get_clearsky(times, pressure=pressure)
        cs_ghi = clearsky['ghi']
        cs_dhi = clearsky['dhi']
        
        cs_ghi_sum = cs_ghi.sum()
        cs_dhi_sum = cs_dhi.sum()
        
        target_ghi_wh = ghi_day * 1000.0
        target_dhi_wh = dhi_day * 1000.0
        
        scale_ghi = target_ghi_wh / cs_ghi_sum if cs_ghi_sum > 0 else 0
        scale_dhi = target_dhi_wh / cs_dhi_sum if cs_dhi_sum > 0 else 0
        
        hourly_ghi = cs_ghi * scale_ghi
        hourly_dhi = cs_dhi * scale_dhi
        
        # Determine DNI
        cos_zenith = np.cos(np.radians(zenith))
        hourly_dni = []
        for g, d, cz in zip(hourly_ghi, hourly_dhi, cos_zenith):
            if cz > 0.05 and g > d:
                hourly_dni.append((g - d) / cz)
            else:
                hourly_dni.append(0.0)
        hourly_dni = pd.Series(hourly_dni, index=times)
        
        # Transpose GHI, DHI, DNI to Plane of Array (POA)
        poa = irradiance.get_total_irradiance(
            surface_tilt=tilt,
            surface_azimuth=azimuth,
            solar_zenith=zenith,
            solar_azimuth=solpos['azimuth'],
            dni=hourly_dni,
            ghi=hourly_ghi,
            dhi=hourly_dhi,
            albedo=albedo,
            model='isotropic'
        )
        
        # Apply shading as a yield adjustment folded into transposition components
        poa_direct = poa['poa_direct'] * (1.0 - shading_loss)
        poa_sky_diffuse = poa['poa_sky_diffuse'] * (1.0 - shading_loss)
        poa_ground_diffuse = poa['poa_ground_diffuse'] * (1.0 - shading_loss)
        poa_global = poa_direct + poa_sky_diffuse + poa_ground_diffuse
        
        # Calculate cell temperature using SAPM temperature model (close roof mount)
        temp_cell = temperature.sapm_cell(
            poa_global, temp_air, wind_speed, 
            a=-2.98, b=-0.0410, deltaT=1
        )
        
        # Temperature correction coefficient for output power (-0.35% per degC deviation from 25C)
        temp_coeff = -0.0035
        temp_diff = temp_cell - 25.0
        power_factor = 1.0 + temp_coeff * temp_diff
        
        # Calculated power output
        hourly_dc_power = system_size_kw * (poa_global / 1000.0) * power_factor
        hourly_dc_power = np.maximum(hourly_dc_power, 0)
        
        # Apply standard system losses (14% system losses, 97.5% inverter efficiency) and wind structural degradation
        inverter_eff = 0.975
        system_loss = 0.14
        monthly_kwh = hourly_dc_power.sum() * days_in_month * inverter_eff * (1.0 - system_loss) * structural_factor
        
        monthly_yields_kwh.append(float(round(monthly_kwh, 1)))
        cell_temps.append(float(round(temp_cell.mean(), 1)))
        poa_globals.append(float(round(poa_global.sum() * days_in_month / 1000.0, 1)))
        
    # Recalculated annual yield kwh
    annual_yield_kwh = float(round(sum(monthly_yields_kwh), 1))
    
    return {
        'monthly_yields_kwh': monthly_yields_kwh,
        'monthly_cell_temperatures': cell_temps,
        'monthly_poa_kwh_m2': poa_globals,
        'annual_yield_kwh': annual_yield_kwh,
        'wind_zone': wind_zone,
        'wind_zone_label': zone_label,
        'structural_factor': structural_factor,
        'high_wind_warning': high_wind_warning,
        'elevation_m': elevation,
        'calculated_pressure_pa': pressure,
        'horizon_shading_loss': shading_loss
    }

if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        results = calculate_solar_yield(input_data)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
