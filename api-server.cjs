const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env and .env.local
function loadEnv() {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    const p = path.join(__dirname, file);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim();
            let val = trimmed.substring(idx + 1).trim();
            // strip quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

// --- Database & Cache Setup ---
let supabase;
let redis;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co' && supabaseKey !== 'your_service_role_key') {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[API SERVER] Connected to Supabase.');
  } catch (err) {
    console.error('[API SERVER] Failed to initialize Supabase client:', err);
  }
}

if (!supabase) {
  console.log('[API SERVER] Using in-memory Mock Supabase Client.');
  const inMemoryTables = {
    nasa_power_cache: [],
    analysis_sessions: [],
    solar_reports: [],
    payments: []
  };
  supabase = {
    from: (table) => {
      const dataList = inMemoryTables[table] || [];
      return {
        select: (columns = '*') => {
          return {
            eq: (col, val) => {
              return {
                single: async () => {
                  const found = dataList.find(row => row[col] === val);
                  return { data: found || null, error: found ? null : { message: 'Not found' } };
                },
                async then(resolve) {
                  const found = dataList.filter(row => row[col] === val);
                  resolve({ data: found, error: null });
                }
              };
            },
            async then(resolve) {
              resolve({ data: dataList, error: null });
            }
          };
        },
        insert: (rows) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          arr.forEach(row => {
            if (!row.id) row.id = crypto.randomUUID();
            if (!row.created_at) row.created_at = new Date().toISOString();
            dataList.push(row);
          });
          return {
            select: () => ({
              single: async () => ({ data: arr[0], error: null }),
              async then(resolve) { resolve({ data: arr, error: null }); }
            }),
            async then(resolve) {
              resolve({ data: arr, error: null });
            }
          };
        },
        update: (updates) => {
          return {
            eq: (col, val) => {
              return {
                async then(resolve) {
                  let updatedData = [];
                  dataList.forEach(row => {
                    if (row[col] === val) {
                      Object.assign(row, updates);
                      updatedData.push(row);
                    }
                  });
                  resolve({ data: updatedData, error: null });
                }
              };
            }
          };
        },
        upsert: (rows) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          arr.forEach(row => {
            const idx = dataList.findIndex(existing => {
              if (row.id && existing.id === row.id) return true;
              if (row.cache_key && existing.cache_key === row.cache_key) return true;
              if (row.session_id && existing.session_id === row.session_id) return true;
              if (row.site_id && existing.site_id === row.site_id) return true;
              return false;
            });
            if (idx !== -1) {
              dataList[idx] = { ...dataList[idx], ...row };
            } else {
              if (!row.id) row.id = crypto.randomUUID();
              dataList.push(row);
            }
          });
          return {
            async then(resolve) {
              resolve({ data: arr, error: null });
            }
          };
        }
      };
    }
  };
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken && redisUrl !== 'your_upstash_redis_rest_url_here') {
  try {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url: redisUrl, token: redisToken });
    console.log('[API SERVER] Connected to Upstash Redis.');
  } catch (err) {
    console.error('[API SERVER] Failed to initialize Redis client:', err);
  }
}

if (!redis) {
  console.log('[API SERVER] Using in-memory Mock Redis Client.');
  const inMemoryCache = new Map();
  redis = {
    get: async (key) => inMemoryCache.get(key) || null,
    set: async (key, value, options) => {
      inMemoryCache.set(key, value);
      if (options && options.ex) {
        setTimeout(() => inMemoryCache.delete(key), options.ex * 1000);
      }
      return 'OK';
    }
  };
}

const PORT = 5173;

// Helper to send JSON response
function sendJSON(res, data, status = 200, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    ...headers
  });
  res.end(JSON.stringify(data));
}

// Helper to parse cookies
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// Helper to parse request body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// --- Helper: Fetch and cache NASA POWER climatology data ---
async function fetchClimatology(lat, lng) {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const roundedLat = parseFloat(parsedLat.toFixed(1));
  const roundedLng = parseFloat(parsedLng.toFixed(1));
  const cacheKey = `nasa_power:${roundedLat.toFixed(1)}:${roundedLng.toFixed(1)}`;

  let cachedData = null;

  try {
    const val = await redis.get(cacheKey);
    if (val) {
      cachedData = typeof val === 'string' ? JSON.parse(val) : val;
    }
  } catch (err) {}

  if (!cachedData) {
    try {
      const { data: dbData } = await supabase
        .from('nasa_power_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single();
      if (dbData) {
        const isExpired = new Date(dbData.expires_at) <= new Date();
        if (!isExpired) {
          cachedData = {
            monthly_ghi: dbData.monthly_ghi,
            monthly_dhi: dbData.monthly_dhi,
            monthly_temperature: dbData.monthly_temperature,
            monthly_wind_speed_10m: dbData.monthly_wind_speed_10m,
            monthly_wind_speed_50m: dbData.monthly_wind_speed_50m,
            elevation_m: dbData.elevation_m
          };
          const remainingTtl = Math.max(0, Math.round((new Date(dbData.expires_at).getTime() - Date.now()) / 1000));
          if (remainingTtl > 0) {
            await redis.set(cacheKey, JSON.stringify(cachedData), { ex: remainingTtl });
          }
        }
      }
    } catch (err) {}
  }

  if (!cachedData) {
    const baseUrl = process.env.NASA_POWER_BASE_URL || 'https://power.larc.nasa.gov';
    const nasaUrl = `${baseUrl}/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DIFF,T2M,WS10M,WS50M&community=RE&longitude=${roundedLng}&latitude=${roundedLat}&format=JSON`;
    
    console.log(`[API SERVER] Cache Miss. Fetching climatology from NASA: ${nasaUrl}`);
    const response = await fetch(nasaUrl);
    if (!response.ok) throw new Error('NASA API response not ok');
    const data = await response.json();

    const params = data.properties?.parameter;
    if (!params || !params.ALLSKY_SFC_SW_DWN || !params.ALLSKY_SFC_SW_DIFF || !params.T2M || !params.WS10M || !params.WS50M) {
      throw new Error('Required meteorological parameters not found in NASA response');
    }

    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthly_ghi = months.map(m => params.ALLSKY_SFC_SW_DWN[m]);
    const monthly_dhi = months.map(m => params.ALLSKY_SFC_SW_DIFF[m]);
    const monthly_temperature = months.map(m => params.T2M[m]);
    const monthly_wind_speed_10m = months.map(m => params.WS10M[m]);
    const monthly_wind_speed_50m = months.map(m => params.WS50M[m]);
    const elevation_m = data.geometry?.coordinates?.[2] || 0.0;

    cachedData = {
      monthly_ghi,
      monthly_dhi,
      monthly_temperature,
      monthly_wind_speed_10m,
      monthly_wind_speed_50m,
      elevation_m
    };

    const ttlSeconds = 30 * 24 * 3600;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await supabase.from('nasa_power_cache').upsert({
      cache_key: cacheKey,
      latitude: roundedLat,
      longitude: roundedLng,
      monthly_ghi,
      monthly_dhi,
      monthly_temperature,
      monthly_wind_speed_10m,
      monthly_wind_speed_50m,
      elevation_m,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt
    });

    await redis.set(cacheKey, JSON.stringify(cachedData), { ex: ttlSeconds });
  }

  return cachedData;
}

// --- Helper: Calculate IS 875 wind-zone parameters ---
function calculateWindZone(monthlyWind) {
  if (!monthlyWind || monthlyWind.length !== 12) {
    return {
      windZone: "Zone 1",
      windZoneLabel: "Low",
      structuralFactor: 1.0,
      highWindWarning: false
    };
  }
  const sum = monthlyWind.reduce((a, b) => a + b, 0);
  const mean_ws = sum / 12.0;
  const basic_ws = mean_ws * 10.0;

  let windZone = "Zone 1";
  let windZoneLabel = "Low";
  let structuralFactor = 1.0;
  let zoneThreshold = 3.3;

  if (basic_ws < 33.0) {
    windZone = "Zone 1";
    windZoneLabel = "Low";
    structuralFactor = 1.0;
    zoneThreshold = 3.3;
  } else if (basic_ws < 39.0) {
    windZone = "Zone 2";
    windZoneLabel = "Moderate";
    structuralFactor = 0.95;
    zoneThreshold = 3.9;
  } else if (basic_ws < 44.0) {
    windZone = "Zone 3";
    windZoneLabel = "High";
    structuralFactor = 0.90;
    zoneThreshold = 4.4;
  } else if (basic_ws < 50.0) {
    windZone = "Zone 4";
    windZoneLabel = "Very High";
    structuralFactor = 0.85;
    zoneThreshold = 4.7;
  } else {
    windZone = "Zone 5/6";
    windZoneLabel = "Very High";
    structuralFactor = 0.75;
    zoneThreshold = 5.0;
  }

  // Check if exceeds threshold for >4 consecutive months (with wrap-around)
  let maxConsec = 0;
  let currentConsec = 0;
  const doubleWind = [...monthlyWind, ...monthlyWind];
  for (const ws of doubleWind) {
    if (ws > zoneThreshold) {
      currentConsec++;
      if (currentConsec > maxConsec) {
        maxConsec = currentConsec;
      }
    } else {
      currentConsec = 0;
    }
  }

  const highWindWarning = maxConsec > 4;

  return {
    windZone,
    windZoneLabel,
    structuralFactor,
    highWindWarning
  };
}

// --- Helper: Run Python solar_engine.py ---
function runSolarEngine(inputData) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const pythonProcess = spawn('python', [path.join(__dirname, 'solar_engine.py')]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python solar_engine.py exited with code ${code}. Error: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Failed to parse Python engine output: ${stdout}. Error: ${err.message}`));
      }
    });
    
    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();
  });
}

// --- Helper: Solve financial projections ---
function computeFinancials({ annualKwh, systemSizeKw, panelCount, panelWattage, tariffRate }) {
  const grossCost = panelCount * (panelWattage === 550 ? 22000 : 18000) + 35000;
  const totalGrossCapEx = grossCost;
  let subsidyInr = systemSizeKw <= 2 ? systemSizeKw * 30000 : systemSizeKw <= 3 ? 60000 + (systemSizeKw - 2) * 18000 : 78000;
  subsidyInr = Math.min(78000, Math.round(subsidyInr));
  const netCostInr = Math.max(0, totalGrossCapEx - subsidyInr);
  
  const escalation = 4.5;
  const discountRate = 8.5;
  const omCost = 1.0;
  
  const cashFlows = [-netCostInr];
  const cumulativeCashFlow = [-netCostInr];
  let cum = -netCostInr;
  
  for (let y = 1; y <= 25; y++) {
    const prod = annualKwh * Math.pow(0.995, y - 1);
    const rate = tariffRate * Math.pow(1 + escalation / 100, y - 1);
    const baseOm = 1500 + Math.max(0, systemSizeKw - 1) * 500;
    const om = baseOm * Math.pow(1 + omCost / 100, y - 1);
    const savings = prod * rate;
    const net = savings - om - (y === 10 ? 35000 : 0);
    cashFlows.push(net);
    cum += net;
    cumulativeCashFlow.push(cum);
  }
  
  const npv = cashFlows.reduce((s, v, i) => s + v / Math.pow(1 + discountRate / 100, i), 0);
  
  let irr = 0, low = -0.5, high = 2.0;
  const calcNpv = (r) => cashFlows.reduce((s, v, i) => s + v / Math.pow(1 + r, i), 0);
  if (calcNpv(low) > 0 && calcNpv(high) < 0) {
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      calcNpv(mid) > 0 ? low = mid : high = mid;
      irr = mid;
    }
  }
  
  let paybackPeriod = 25, breakEvenYr = 25;
  for (let y = 1; y <= 25; y++) {
    if (cumulativeCashFlow[y] >= 0) {
      breakEvenYr = y;
      paybackPeriod = (y - 1) + (-cumulativeCashFlow[y - 1] / cashFlows[y]);
      break;
    }
  }
  
  let dlc = netCostInr;
  let dep = 0;
  for (let y = 1; y <= 25; y++) {
    const prod = annualKwh * Math.pow(0.995, y - 1);
    dlc += (1500 + Math.max(0, systemSizeKw - 1) * 500) * Math.pow(1 + omCost / 100, y - 1) / Math.pow(1 + discountRate / 100, y);
    dep += prod / Math.pow(1 + discountRate / 100, y);
  }
  const lcoe = dep > 0 ? dlc / dep : 0;
  
  return {
    capex_estimate: totalGrossCapEx,
    pm_surya_subsidy: subsidyInr,
    lifetime_savings: cumulativeCashFlow[25] + netCostInr,
    npv,
    irr: irr * 100,
    payback_years: paybackPeriod,
    lcoe_per_kwh: lcoe,
    cashflow_projection: cumulativeCashFlow.map((v, i) => ({ year: i, cumulative: Math.round(v) }))
  };
}

// Export request handler for Vite middleware use
async function handleRequest(req, res, next) {
  const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Only handle paths starting with /api
  if (!pathname.startsWith('/api')) {
    if (typeof next === 'function') {
      return next();
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }

  console.log(`[API SERVER] ${req.method} ${pathname}`);

  // 1. GEOCODE PROXY
  if (pathname === '/api/geocode') {
    if (req.method !== 'GET') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const q = parsedUrl.searchParams.get('q');
    const lat = parsedUrl.searchParams.get('lat');
    const lng = parsedUrl.searchParams.get('lng');
    const limit = parsedUrl.searchParams.get('limit') || '1';

    if (!q && (!lat || !lng)) {
      return sendJSON(res, { error: 'Query q or lat/lng are required' }, 400);
    }

    // A. REVERSE GEOCODE
    if (lat && lng) {
      // 1. Google Reverse Geocode
      const apiKey = process.env.GOOGLE_GEOCODING_KEY;
      if (apiKey && apiKey !== 'your_google_geocoding_key_here') {
        try {
          const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${parseFloat(lat).toFixed(6)},${parseFloat(lng).toFixed(6)}&key=${apiKey}`;
          const response = await fetch(googleUrl);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const first = data.results[0];
              const stateComp = first.address_components?.find(c => c.types.includes('administrative_area_level_1'));
              return sendJSON(res, {
                display_name: first.formatted_address,
                address: {
                  state: stateComp ? stateComp.long_name : undefined
                }
              });
            }
          }
        } catch (e) {
          console.error('Google reverse geocode error:', e);
        }
      }

      // 2. Nominatim fallback
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parseFloat(lat).toFixed(6)}&lon=${parseFloat(lng).toFixed(6)}&accept-language=en`;
        const response = await fetch(nomUrl, {
          headers: { 'User-Agent': 'SunPowerLinkSolarApp/1.0' }
        });
        if (response.ok) {
          const data = await response.json();
          return sendJSON(res, data);
        }
      } catch (e) {
        console.error('Reverse geocode proxy error:', e);
      }
      return sendJSON(res, { error: 'Reverse geocode failed' }, 502);
    }

    // B. FORWARD GEOCODE
    const apiKey = process.env.GOOGLE_GEOCODING_KEY;
    if (apiKey && apiKey !== 'your_google_geocoding_key_here' && limit === '1') {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q.trim())}&key=${apiKey}`;
        const response = await fetch(googleUrl);
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const first = data.results[0];
          const stateComp = first.address_components?.find(c => c.types.includes('administrative_area_level_1'));
          return sendJSON(res, {
            lat: first.geometry.location.lat,
            lng: first.geometry.location.lng,
            formatted_address: first.formatted_address,
            place_id: first.place_id,
            state: stateComp ? stateComp.long_name : undefined
          });
        }
      } catch (e) {
        console.error('Google geocoding error:', e);
      }
    }

    // Nominatim forward geocoding (CORS-free server-side fetch)
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&addressdetails=1&limit=${limit}&accept-language=en`;
      const response = await fetch(nomUrl, {
        headers: { 'User-Agent': 'SunPowerLinkSolarApp/1.0' }
      });
      if (response.ok) {
        const data = await response.json();
        if (limit === '1') {
          if (data && data.length > 0) {
            const first = data[0];
            return sendJSON(res, {
              lat: parseFloat(first.lat),
              lng: parseFloat(first.lon),
              formatted_address: first.display_name,
              place_id: String(first.place_id),
              state: first.address?.state
            });
          }
          return sendJSON(res, { error: 'Address not found' }, 404);
        } else {
          // Return raw array for list suggestions
          return sendJSON(res, data);
        }
      }
      return sendJSON(res, { error: 'Address not found' }, 404);
    } catch (err) {
      return sendJSON(res, { error: 'Geocoding service unavailable' }, 502);
    }
  }


  // 2. SOLAR DATA PROXY
  if (pathname === '/api/solar-data') {
    if (req.method !== 'GET') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const lat = parsedUrl.searchParams.get('lat');
    const lng = parsedUrl.searchParams.get('lng');
    if (!lat || !lng) return sendJSON(res, { error: 'lat and lng are required' }, 400);

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const roundedLat = parseFloat(parsedLat.toFixed(1));
    const roundedLng = parseFloat(parsedLng.toFixed(1));
    const cacheKey = `nasa_power:${roundedLat.toFixed(1)}:${roundedLng.toFixed(1)}`;

    let cachedData = null;

    // 1. Try Upstash Redis hot cache
    try {
      const val = await redis.get(cacheKey);
      if (val) {
        cachedData = typeof val === 'string' ? JSON.parse(val) : val;
        console.log(`[API SERVER] Redis Cache Hit for ${cacheKey}`);
      }
    } catch (err) {
      console.error('[API SERVER] Redis read error:', err);
    }

    // 2. Try Postgres cold cache via Supabase
    if (!cachedData) {
      try {
        const { data: dbData, error } = await supabase
          .from('nasa_power_cache')
          .select('*')
          .eq('cache_key', cacheKey)
          .single();
        if (dbData && !error) {
          const isExpired = new Date(dbData.expires_at) <= new Date();
          if (!isExpired) {
            cachedData = {
              monthly_ghi: dbData.monthly_ghi,
              monthly_dhi: dbData.monthly_dhi,
              monthly_temperature: dbData.monthly_temperature,
              monthly_wind_speed_10m: dbData.monthly_wind_speed_10m,
              monthly_wind_speed_50m: dbData.monthly_wind_speed_50m,
              elevation_m: dbData.elevation_m
            };
            console.log(`[API SERVER] Postgres Cache Hit for ${cacheKey}`);
            
            // Re-populate Redis cache with remaining TTL
            const remainingTtl = Math.max(0, Math.round((new Date(dbData.expires_at).getTime() - Date.now()) / 1000));
            if (remainingTtl > 0) {
              await redis.set(cacheKey, JSON.stringify(cachedData), { ex: remainingTtl });
            }
          } else {
            console.log(`[API SERVER] Postgres Cache Record Expired for ${cacheKey}`);
          }
        }
      } catch (err) {
        console.error('[API SERVER] Postgres read error:', err);
      }
    }

    // 3. Fetch from NASA POWER API on Miss
    if (!cachedData) {
      const baseUrl = process.env.NASA_POWER_BASE_URL || 'https://power.larc.nasa.gov';
      const nasaUrl = `${baseUrl}/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DIFF,T2M,WS10M,WS50M&community=RE&longitude=${roundedLng}&latitude=${roundedLat}&format=JSON`;
      try {
        console.log(`[API SERVER] Cache Miss. Fetching from NASA: ${nasaUrl}`);
        const response = await fetch(nasaUrl);
        if (!response.ok) throw new Error('NASA API response not ok');
        const data = await response.json();

        const params = data.properties?.parameter;
        if (!params || !params.ALLSKY_SFC_SW_DWN || !params.ALLSKY_SFC_SW_DIFF || !params.T2M || !params.WS10M || !params.WS50M) {
          throw new Error('Required meteorological parameters not found in NASA response');
        }

        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const monthly_ghi = months.map(m => params.ALLSKY_SFC_SW_DWN[m]);
        const monthly_dhi = months.map(m => params.ALLSKY_SFC_SW_DIFF[m]);
        const monthly_temperature = months.map(m => params.T2M[m]);
        const monthly_wind_speed_10m = months.map(m => params.WS10M[m]);
        const monthly_wind_speed_50m = months.map(m => params.WS50M[m]);
        const elevation_m = data.geometry?.coordinates?.[2] || 0.0;

        cachedData = {
          monthly_ghi,
          monthly_dhi,
          monthly_temperature,
          monthly_wind_speed_10m,
          monthly_wind_speed_50m,
          elevation_m
        };

        // Write to persistent Postgres store and Upstash Redis cache (30-day TTL)
        const ttlSeconds = 30 * 24 * 3600;
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        await supabase.from('nasa_power_cache').upsert({
          cache_key: cacheKey,
          latitude: roundedLat,
          longitude: roundedLng,
          monthly_ghi,
          monthly_dhi,
          monthly_temperature,
          monthly_wind_speed_10m,
          monthly_wind_speed_50m,
          elevation_m,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt
        });

        await redis.set(cacheKey, JSON.stringify(cachedData), { ex: ttlSeconds });
      } catch (err) {
        console.error('[API SERVER] NASA fetch error, using fallbacks:', err);
        cachedData = {
          monthly_ghi: [4.8, 5.1, 5.8, 6.2, 6.5, 5.0, 4.2, 4.5, 5.3, 5.6, 5.0, 4.7],
          monthly_dhi: [1.5, 1.6, 1.8, 2.0, 2.2, 2.1, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4],
          monthly_temperature: [22.0, 24.5, 28.0, 31.5, 33.0, 31.0, 28.5, 28.0, 28.5, 27.5, 25.0, 22.0],
          monthly_wind_speed_10m: [2.5, 2.7, 3.0, 3.2, 3.5, 3.8, 3.6, 3.3, 2.9, 2.4, 2.2, 2.3],
          monthly_wind_speed_50m: [3.5, 3.8, 4.2, 4.5, 4.9, 5.3, 5.0, 4.6, 4.1, 3.4, 3.1, 3.2],
          elevation_m: 150.0
        };
      }
    }

    return sendJSON(res, {
      ...cachedData,
      lat: roundedLat,
      lng: roundedLng
    }, 200, { 'Cache-Control': 'public, max-age=2592000' });
  }

  // 3. CREATE ORDER
  if (pathname === '/api/payment/create-order') {
    if (req.method !== 'POST') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const body = await parseBody(req);
    const plan = body.plan;
    if (plan !== 'pay_per_scan' && plan !== 'pro_monthly') {
      return sendJSON(res, { error: 'Invalid plan' }, 400);
    }

    const amount = plan === 'pay_per_scan' ? 14900 : 99900;
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkeyid';
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Check if real Razorpay is set up
    if (keySecret && keySecret !== 'your_razorpay_secret_here') {
      try {
        const Razorpay = require('razorpay');
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const order = await rzp.orders.create({
          amount,
          currency: 'INR',
          receipt: 'scan_' + Date.now(),
          notes: { plan, scanId: body.scanId || '' }
        });
        return sendJSON(res, {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId
        });
      } catch (err) {
        console.error('Razorpay order creation failed, falling back to mock:', err);
      }
    }

    // Mock Order ID for testing/demo
    return sendJSON(res, {
      orderId: 'order_mock_' + Math.random().toString(36).substr(2, 9),
      amount,
      currency: 'INR',
      keyId
    });
  }

  // 4. VERIFY PAYMENT
  if (pathname === '/api/payment/verify') {
    if (req.method !== 'POST') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const body = await parseBody(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, scanId } = body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let isValid = false;

    if (razorpay_order_id.startsWith('order_mock_')) {
      // Mock order verification: always succeed unless designated mock fail
      isValid = razorpay_payment_id !== 'pay_fail_123';
    } else if (keySecret && keySecret !== 'your_razorpay_secret_here') {
      try {
        const text = razorpay_order_id + '|' + razorpay_payment_id;
        const expected = crypto.createHmac('sha256', keySecret).update(text).digest('hex');
        isValid = expected === razorpay_signature;
      } catch (err) {
        console.error('Signature verification error:', err);
      }
    } else {
      // Fallback mock success
      isValid = true;
    }

    if (!isValid) {
      return sendJSON(res, { error: 'Invalid payment signature' }, 400);
    }

    const sId = scanId || 'default';
    // Set cookie headers
    const cookieVal = `scan_unlocked_${sId}=true; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieVal,
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'Set-Cookie'
    });
    res.end(JSON.stringify({ verified: true, paymentId: razorpay_payment_id }));
    return;
  }

  // 5. RESTORE PAYMENT ACCESS
  if (pathname === '/api/payment/restore') {
    if (req.method !== 'POST') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const body = await parseBody(req);
    const paymentId = body.paymentId;

    if (!paymentId || !paymentId.startsWith('pay_') || paymentId.length < 14) {
      return sendJSON(res, { error: 'Invalid payment ID' }, 400);
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    let isCaptured = false;
    let scanId = 'default';

    if (paymentId.startsWith('pay_mock_')) {
      isCaptured = true;
    } else if (keyId && keySecret && keySecret !== 'your_razorpay_secret_here') {
      try {
        const auth = 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64');
        const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': auth }
        });
        if (response.ok) {
          const pData = await response.json();
          isCaptured = pData.status === 'captured';
          scanId = pData.notes?.scanId || 'default';
        }
      } catch (err) {
        console.error('Payment restore lookup failed:', err);
      }
    } else {
      isCaptured = true;
    }

    if (!isCaptured) {
      return sendJSON(res, { error: 'Payment not found or not completed' }, 404);
    }

    const cookieVal = `scan_unlocked_${scanId}=true; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieVal,
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'Set-Cookie'
    });
    res.end(JSON.stringify({ restored: true, paymentId }));
    return;
  }

  // 6. CHECK PAYMENT COOKIE STATUS
  if (pathname === '/api/payment/status') {
    if (req.method !== 'GET') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const scanId = parsedUrl.searchParams.get('scanId') || 'default';
    const cookies = parseCookies(req.headers.cookie);
    
    const isUnlocked = cookies[`scan_unlocked_${scanId}`] === 'true';
    return sendJSON(res, { unlocked: isUnlocked });
  }

  // 7. LEADS FORM SUBMIT
  if (pathname === '/api/leads') {
    if (req.method !== 'POST') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const body = await parseBody(req);
    const { name, phone, city } = body;
    if (!name || !phone) return sendJSON(res, { error: 'Name and Phone are required' }, 400);

    return sendJSON(res, { success: true });
  }

  // 8. MARKET INSIGHTS
  if (pathname === '/api/market-insights') {
    if (req.method !== 'GET') return sendJSON(res, { error: 'Method not allowed' }, 405);
    return sendJSON(res, {
      nationalStats: {
        cumulativeCapacityGw: 18.5,
        avgCostPerKw: 48500,
        avgPaybackYears: 4.1,
        yoyGrowthPct: 28
      },
      yearlyGrowth: [
        { year: 2018, capacityGw: 3.2, installations: 45000 },
        { year: 2019, capacityGw: 4.8, installations: 72000 },
        { year: 2020, capacityGw: 6.1, installations: 98000 },
        { year: 2021, capacityGw: 8.3, installations: 135000 },
        { year: 2022, capacityGw: 10.4, installations: 178000 },
        { year: 2023, capacityGw: 12.8, installations: 230000 },
        { year: 2024, capacityGw: 15.2, installations: 295000 },
        { year: 2025, capacityGw: 18.5, installations: 380000 },
        { year: 2026, capacityGw: 22.0, installations: 475000 }
      ],
      stateRankings: [
        { state: "Gujarat", capacityMw: 3850, projectsCount: 85000, avgYield: 1620 },
        { state: "Maharashtra", capacityMw: 2980, projectsCount: 68000, avgYield: 1550 },
        { state: "Karnataka", capacityMw: 2150, projectsCount: 42000, avgYield: 1580 },
        { state: "Rajasthan", capacityMw: 1820, projectsCount: 35000, avgYield: 1680 },
        { state: "Tamil Nadu", capacityMw: 1650, projectsCount: 31000, avgYield: 1520 },
        { state: "Uttar Pradesh", capacityMw: 1420, projectsCount: 29000, avgYield: 1480 },
        { state: "Telangana", capacityMw: 950, projectsCount: 22000, avgYield: 1560 },
        { state: "Haryana", capacityMw: 820, projectsCount: 17000, avgYield: 1490 },
        { state: "Delhi", capacityMw: 650, projectsCount: 18000, avgYield: 1500 },
        { state: "Kerala", capacityMw: 540, projectsCount: 12000, avgYield: 1450 }
      ],
      sectorSplit: [
        { name: "Commercial & Industrial (C&I)", percentage: 58, capacityMw: 10730 },
        { name: "Residential", percentage: 27, capacityMw: 4995 },
        { name: "Government & Institutional", percentage: 15, capacityMw: 2775 }
      ],
      costTrends: [
        { size: "1 - 3 kW", pricePerKwMin: 50000, pricePerKwMax: 65000 },
        { size: "3 - 10 kW", pricePerKwMin: 45000, pricePerKwMax: 55000 },
        { size: "10 - 50 kW", pricePerKwMin: 42000, pricePerKwMax: 48000 },
        { size: "> 50 kW", pricePerKwMin: 38000, pricePerKwMax: 42000 }
      ]
    }, 200, { 'Cache-Control': 'public, max-age=3600' });
  }

  // 9. POLICY TRACKER
  if (pathname === '/api/policy-tracker') {
    if (req.method !== 'GET') return sendJSON(res, { error: 'Method not allowed' }, 405);
    return sendJSON(res, {
      states: [
        {
          state: "Gujarat",
          netMeteringLimitKw: 10,
          grossMeteringThresholdKw: 10,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000 for residential.",
          stateSubsidy: "Surya Gujarat Subsidy adds up to ₹20,000 for up to 3kW installations.",
          exportTariff: "₹2.25",
          processingTime: "15-20 days",
          discoms: ["PGVCL", "DGVCL", "MGVCL", "UGVCL", "Torrent Power"],
          policySummary: "Gujarat is the national leader in residential solar due to simplified single-window clearance, high solar irradiance, and the state-level Surya Gujarat booster subsidy. Grid feasibility checks are automated via DISCOM portals.",
          easeScore: 95,
          officialPortal: "https://suryagujarat.guvnl.com"
        },
        {
          state: "Maharashtra",
          netMeteringLimitKw: 500,
          grossMeteringThresholdKw: 500,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000.",
          stateSubsidy: "No direct additional subsidy, but state offers 100% waiver of electricity duty for 5 years.",
          exportTariff: "₹2.90",
          processingTime: "30-45 days",
          discoms: ["MSEDCL (Mahadiscom)", "Tata Power", "Adani Electricity", "BEST"],
          policySummary: "Maharashtra allows net metering up to 100% of sanctioned load (max 500kW). Approvals run through Mahadiscom portal. Grid connection processes can experience administrative delays but DISCOM feed-in rates are favorable.",
          easeScore: 75,
          officialPortal: "https://www.mahadiscom.in/solar"
        },
        {
          state: "Delhi",
          netMeteringLimitKw: 10,
          grossMeteringThresholdKw: 10,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000.",
          stateSubsidy: "Delhi Solar Policy 2024 offers an additional Generation-Based Incentive (GBI) of ₹3.00/kWh for 3 years.",
          exportTariff: "₹3.50",
          processingTime: "20-30 days",
          discoms: ["BSES Rajdhani", "BSES Yamuna", "Tata Power DDL"],
          policySummary: "Delhi's Solar Policy offers a generation-based incentive (GBI) paid directly to homeowners' bank accounts. In addition, residential solar installations are completely exempted from municipal taxes and conversion charges.",
          easeScore: 88,
          officialPortal: "https://solar.delhi.gov.in"
        },
        {
          state: "Karnataka",
          netMeteringLimitKw: 10,
          grossMeteringThresholdKw: 50,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000.",
          stateSubsidy: "Zero state-level subsidy, but solar equipment is exempted from entry tax and local sales taxes.",
          exportTariff: "₹2.70",
          processingTime: "25-35 days",
          discoms: ["BESCOM", "CESC", "GESCOM", "HESCOM", "MESCOM"],
          policySummary: "Karnataka's KERC permits net metering for residential installations up to 10 kW. Above 10 kW, systems are transitioned to gross metering. The state has an active digital application process via individual DISCOM portals.",
          easeScore: 80,
          officialPortal: "https://bescom.karnataka.gov.in"
        },
        {
          state: "Uttar Pradesh",
          netMeteringLimitKw: 10,
          grossMeteringThresholdKw: 10,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000.",
          stateSubsidy: "UP State Subsidy provides ₹15,000/kW up to a maximum capping of ₹30,000 per residential consumer.",
          exportTariff: "₹2.50",
          processingTime: "20-30 days",
          discoms: ["PVVNL", "MVVNL", "DVVNL", "PuVVNL", "KESCO"],
          policySummary: "UP Solar Policy offers a very generous state subsidy booster. Residential systems get up to ₹30,000 extra, combining with central funds to cover up to ₹1,08,000. Process is fully integrated with UPNEDA.",
          easeScore: 82,
          officialPortal: "https://upneda.org.in"
        },
        {
          state: "Tamil Nadu",
          netMeteringLimitKw: 10,
          grossMeteringThresholdKw: 10,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000.",
          stateSubsidy: "State feed-in premium added on top of standard energy offsets under Net Feed-in Scheme.",
          exportTariff: "₹3.10",
          processingTime: "35-50 days",
          discoms: ["TANGEDCO"],
          policySummary: "Tamil Nadu operates under a Net Feed-in consumer model where exported energy is valued at a flat TNERC rate. Solar installations require safety inspections by local DISCOM officials before final grid commissioning.",
          easeScore: 70,
          officialPortal: "https://www.tangedco.gov.in"
        },
        {
          state: "Telangana",
          netMeteringLimitKw: 10,
          grossMeteringThresholdKw: 100,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000.",
          stateSubsidy: "No additional state subsidy, but fast-track single window clearance through TS-iPASS.",
          exportTariff: "₹3.20",
          processingTime: "15-25 days",
          discoms: ["TSSPDCL", "TSNPDCL"],
          policySummary: "Telangana has streamlined administrative grid clearances using its TS-iPASS single-window system. Residential consumers benefit from high solar yields, relatively low installation charges, and favorable feed-in tariffs.",
          easeScore: 85,
          officialPortal: "https://www.tsredco.telangana.gov.in"
        },
        {
          state: "Rajasthan",
          netMeteringLimitKw: 50,
          grossMeteringThresholdKw: 50,
          nationalSubsidy: "Eligible for standard PM-Surya Ghar subsidy up to ₹78,000.",
          stateSubsidy: "Subsidies under PM-Surya Ghar scheme with additional stamp duty exemptions for solar lands.",
          exportTariff: "₹2.80",
          processingTime: "25-35 days",
          discoms: ["JVVNL (Jaipur)", "AVVNL (Ajmer)", "JdVVNL (Jodhpur)"],
          policySummary: "As India's highest solar yield state, Rajasthan has massive utility-scale capacity. Residential rooftop is growing, supported by simplified net metering guidelines up to 50kW. Subsidies are administered under central guidelines.",
          easeScore: 78,
          officialPortal: "https://energy.rajasthan.gov.in/rrecl"
        }
      ]
    }, 200, { 'Cache-Control': 'public, max-age=3600' });
  }

  // 10. MAP SESSION TOKEN PROXY
  if (pathname === '/api/map-session') {
    if (req.method !== 'GET' && req.method !== 'POST') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const defaultSession = "JOJQJH0ZFj6JoA54JpDewgrjE8U=";
    const apiKey = process.env.GOOGLE_GEOCODING_KEY;
    if (apiKey && apiKey !== 'your_google_geocoding_key_here') {
      try {
        const googleUrl = `https://tile.googleapis.com/v1/createSession?key=${apiKey}`;
        const response = await fetch(googleUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mapType: "hybrid",
            language: "en-US",
            region: "IN",
            scale: "scaleFactor2x",
            highDpi: true,
          })
        });
        if (response.ok) {
          const data = await response.json();
          return sendJSON(res, { session: data.session || defaultSession });
        }
      } catch (err) {
        console.error('Failed to create map tile session via server:', err);
      }
    }
    return sendJSON(res, { session: defaultSession });
  }

  // 11. RAZORPAY WEBHOOK VERIFICATION
  if (pathname === '/api/payment/webhook') {
    if (req.method !== 'POST') return sendJSON(res, { error: 'Method not allowed' }, 405);
    
    try {
      const rawBody = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => { resolve(data); });
      });
      
      const signature = req.headers['x-razorpay-signature'];
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      let isValid = false;
      
      if (webhookSecret && signature) {
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        isValid = expectedSignature === signature;
      } else {
        // Fallback for testing/mock calls in dev environment
        isValid = true;
      }
      
      if (!isValid) {
        return sendJSON(res, { error: 'Invalid webhook signature' }, 400);
      }
      
      const payload = JSON.parse(rawBody);
      const event = payload.event;
      console.log(`[API SERVER] Received Razorpay Webhook Event: ${event}`);
      
      if (event === 'order.paid' || event === 'payment.captured') {
        const paymentEntity = payload.payload?.payment?.entity;
        const orderEntity = payload.payload?.order?.entity;
        const scanId = (paymentEntity?.notes?.scanId) || (orderEntity?.notes?.scanId) || 'default';
        const amount = (paymentEntity?.amount) || (orderEntity?.amount) || 0;
        const orderId = (paymentEntity?.order_id) || (orderEntity?.id) || '';
        const paymentId = (paymentEntity?.id) || '';
        
        // Update session in DB
        let sessionId = null;
        try {
          const { data: updatedSessions } = await supabase
            .from('analysis_sessions')
            .update({ is_full_unlocked: true })
            .eq('site_id', scanId);
          if (updatedSessions && updatedSessions.length > 0) {
            sessionId = updatedSessions[0].id;
          }
        } catch (err) {
          console.error('Failed to update session status on webhook:', err);
        }
        
        console.log(`[API SERVER] Unlocked report for scanId: ${scanId}`);
        
        // Log transaction in payments table
        try {
          await supabase.from('payments').insert({
            session_id: sessionId,
            amount_paise: amount,
            currency: 'INR',
            payment_type: 'report_unlock',
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature || 'webhook',
            status: 'success',
            confirmed_at: new Date().toISOString()
          });
        } catch (err) {
          console.error('Failed to log payment transaction on webhook:', err);
        }
      }
      
      return sendJSON(res, { received: true });
    } catch (err) {
      console.error('[API SERVER] Webhook error:', err);
      return sendJSON(res, { error: 'Webhook processing failed', details: err.message }, 500);
    }
  }

  // 12. GATED REPORT DATA
  if (pathname === '/api/report') {
    if (req.method !== 'GET') return sendJSON(res, { error: 'Method not allowed' }, 405);
    const siteId = parsedUrl.searchParams.get('siteId') || 'default';
    const scanParam = parsedUrl.searchParams.get('scan');
    
    let session = null;
    let report = null;
    
    // Attempt DB Lookup
    try {
      const { data: dbSession } = await supabase
        .from('analysis_sessions')
        .select('*')
        .eq('site_id', siteId)
        .single();
      if (dbSession) {
        session = dbSession;
        const { data: dbReport } = await supabase
          .from('solar_reports')
          .select('*')
          .eq('session_id', session.id)
          .single();
        report = dbReport;
      }
    } catch (err) {
      console.error('Error querying database for report:', err);
    }
    
    // If not in database but scan context is provided, run pvlib engine and store report
    if ((!session || !report) && scanParam) {
      try {
        console.log(`[API SERVER] Cache/DB miss for siteId: ${siteId}. Generating report...`);
        const decoded = JSON.parse(Buffer.from(decodeURIComponent(scanParam), 'base64').toString('utf-8'));
        const { scanInput, panelConfig, tariff: td } = decoded;
        
        // Fetch weather cache profile
        const weather = await fetchClimatology(scanInput.lat, scanInput.lng);
        
        // Spawns Python pvlib model for cell temperature corrections
        const engineInput = {
          latitude: scanInput.lat,
          longitude: scanInput.lng,
          tilt: panelConfig.tiltAngle,
          azimuth: panelConfig.rowAlignment === 'geographical_south' ? 180.0 : 180.0,
          albedo: 0.2,
          system_size_kwp: panelConfig.panelCount > 0 ? (panelConfig.panelCount * panelConfig.panelWattage / 1000) : 1.0,
          monthly_ghi: weather.monthly_ghi,
          monthly_dhi: weather.monthly_dhi,
          monthly_temp: weather.monthly_temperature,
          monthly_wind_speed: weather.monthly_wind_speed_10m,
          elevation_m: weather.elevation_m,
          shading: panelConfig.shading || 'none'
        };
        
        const engineResult = await runSolarEngine(engineInput);
        
        let suitabilityScore = 85;
        if (engineResult.high_wind_warning) {
          suitabilityScore -= 15;
        }
        
        // Financial projection model
        const finResult = computeFinancials({
          annualKwh: engineResult.annual_yield_kwh,
          systemSizeKw: engineInput.system_size_kwp,
          panelCount: panelConfig.panelCount || 15,
          panelWattage: panelConfig.panelWattage || 450,
          tariffRate: td.tariffPerKwh || 7.0
        });
        
        // Check if report has already been unlocked via cookies
        const cookies = parseCookies(req.headers.cookie);
        const isCookieUnlocked = cookies[`scan_unlocked_${siteId}`] === 'true' || cookies[`scan_unlocked_default`] === 'true';
        
        // Insert record into analysis_sessions table
        const { data: newSession } = await supabase
          .from('analysis_sessions')
          .insert({
            site_id: siteId,
            address: scanInput.address || 'Unknown Address',
            latitude: scanInput.lat,
            longitude: scanInput.lng,
            structure_tilt: panelConfig.tiltAngle,
            boundary_setback: panelConfig.setbackM,
            maintenance_walkways: panelConfig.walkwayM > 0,
            panel_wattage: panelConfig.panelWattage,
            panel_alignment: panelConfig.rowAlignment === 'geographical_south' ? 'south' : 'roof',
            panel_orientation: panelConfig.orientation === 'landscape' ? 'landscape' : 'portrait',
            status: 'ready',
            is_preview_unlocked: true,
            is_full_unlocked: isCookieUnlocked,
            expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            shading: panelConfig.shading || 'none'
          })
          .select()
          .single();
          
        if (newSession) {
          session = newSession;
          
          // Insert record into solar_reports table
          const { data: newReport } = await supabase
            .from('solar_reports')
            .insert({
              session_id: session.id,
              total_roof_area_sqm: scanInput.roofAreaM2,
              usable_roof_area_sqm: scanInput.roofAreaM2 * 0.75,
              panel_count: panelConfig.panelCount || 15,
              system_size_kwp: engineInput.system_size_kwp,
              annual_ghi_kwh_m2_day: weather.monthly_ghi.reduce((a, b) => a + b, 0) / 12,
              annual_production_kwh: engineResult.annual_yield_kwh,
              lcoe_per_kwh: finResult.lcoe_per_kwh,
              irr: finResult.irr,
              roe: 12.5,
              npv: finResult.npv,
              payback_years: finResult.payback_years,
              lifetime_savings: finResult.lifetime_savings,
              utility_cost_25yr: finResult.lifetime_savings * 1.5,
              capex_estimate: finResult.capex_estimate,
              pm_surya_subsidy: finResult.pm_surya_subsidy,
              suitability_score: suitabilityScore,
              investment_grade: finResult.irr > 15 ? 'A+' : 'A',
              cashflow_projection: finResult.cashflow_projection,
              panel_layout: {},
              horizon_shading_loss: engineResult.horizon_shading_loss,
              sky_view_factor: 0.95 * (1 - (engineResult.horizon_shading_loss || 0.0))
            })
            .select()
            .single();
          report = newReport;
        }
      } catch (err) {
        console.error('Failed to dynamically compute and save report:', err);
        return sendJSON(res, { error: 'Failed to compute and save report', details: err.message }, 500);
      }
    }
    
    if (!session || !report) {
      return sendJSON(res, { error: 'Report not found' }, 404);
    }
    
    // Check unlock state
    const cookies = parseCookies(req.headers.cookie);
    const isCookieUnlocked = cookies[`scan_unlocked_${siteId}`] === 'true' || cookies[`scan_unlocked_default`] === 'true';
    const unlocked = session.is_full_unlocked || isCookieUnlocked;

    // Retrieve tariff rate from scanParam if provided, else default to 7.5
    let tariffRate = 7.5;
    if (scanParam) {
      try {
        const decoded = JSON.parse(Buffer.from(decodeURIComponent(scanParam), 'base64').toString('utf-8'));
        if (decoded.tariff && decoded.tariff.tariffPerKwh) {
          tariffRate = decoded.tariff.tariffPerKwh;
        }
      } catch (e) {}
    }

    // Retrieve monthly irradiance and wind parameters from weather climatology
    const monthlyIrradiance = {};
    let windZone = 'Zone 1';
    let windZoneLabel = 'Low';
    let highWindWarning = false;
    let structuralFactor = 1.0;
    try {
      const weather = await fetchClimatology(session.latitude, session.longitude);
      if (weather) {
        if (weather.monthly_wind_speed_10m) {
          const windCalc = calculateWindZone(weather.monthly_wind_speed_10m);
          windZone = windCalc.windZone;
          windZoneLabel = windCalc.windZoneLabel;
          highWindWarning = windCalc.highWindWarning;
          structuralFactor = windCalc.structuralFactor;
        }
        if (weather.monthly_ghi) {
          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          months.forEach((m, idx) => {
            monthlyIrradiance[m] = weather.monthly_ghi[idx];
          });
        }
      }
    } catch (e) {
      console.error('Failed to resolve weather for monthlyIrradiance & wind calculation:', e);
    }

    let suitabilityScore = report.suitability_score || 85;
    if (highWindWarning && suitabilityScore === 85) {
      suitabilityScore -= 15;
    }
    
    let shadingLoss = report.horizon_shading_loss;
    if (shadingLoss === null || shadingLoss === undefined) {
      if (session.shading === 'partial') shadingLoss = 0.15;
      else if (session.shading === 'heavy') shadingLoss = 0.30;
      else shadingLoss = 0.0;
    }

    // Construct response payload
    const responsePayload = {
      analysisId: session.site_id,
      rooftop: {
        drawnAreaM2: report.total_roof_area_sqm,
        usableAreaM2: report.usable_roof_area_sqm,
      },
      energy: {
        installedCapacityKw: report.system_size_kwp,
        peakSunHoursDaily: report.annual_ghi_kwh_m2_day,
        dailyKwh: Math.round((report.annual_production_kwh / 365) * 10) / 10,
        monthlyKwh: Math.round((report.annual_production_kwh / 12) * 10) / 10,
        annualKwh: report.annual_production_kwh,
      },
      financials: {
        electricityRateInr: tariffRate,
        monthlySavingsInr: Math.round((report.lifetime_savings || 0) / 25 / 12),
        annualSavingsInr: Math.round((report.lifetime_savings || 0) / 25),
        savings25yrInr: report.lifetime_savings,
      },
      environmental: {
        co2AnnualKg: Math.round(report.annual_production_kwh * 0.82),
        co2_25yrKg: Math.round(report.annual_production_kwh * 0.82 * 25),
        treesEquivalent: Math.round(report.annual_production_kwh * 0.82 * 25 / (21.77 * 25)),
      },
      generatedAt: report.generated_at,
      irradianceSource: 'NASA POWER Climatology',
      panelCount: report.panel_count,
      panelType: session.panel_wattage === 550 ? 'premium' : 'compact',
      alignment: session.panel_alignment,
      tiltDeg: session.structure_tilt,
      orientation: session.panel_orientation,
      walkways: session.maintenance_walkways,
      setbackM: session.boundary_setback,
      monthlyIrradiance: monthlyIrradiance,
      unlocked: unlocked,
      windZone: windZone,
      windZoneLabel: windZoneLabel,
      highWindWarning: highWindWarning,
      structuralFactor: structuralFactor,
      suitabilityScore: suitabilityScore,
      horizonShadingLoss: shadingLoss,
      skyViewFactor: 0.95 * (1 - shadingLoss)
    };
    
    if (!unlocked) {
      // Column Gating: Strip paid fields
      responsePayload.financials.savings25yrInr = 0;
      responsePayload.financials.monthlySavingsInr = 0;
      responsePayload.financials.annualSavingsInr = 0;
    } else {
      // Add detailed financial metrics
      responsePayload.lcoe_per_kwh = report.lcoe_per_kwh;
      responsePayload.irr = report.irr;
      responsePayload.roe = report.roe;
      responsePayload.npv = report.npv;
      responsePayload.payback_years = report.payback_years;
      responsePayload.lifetime_savings = report.lifetime_savings;
      responsePayload.utility_cost_25yr = report.utility_cost_25yr;
      responsePayload.capex_estimate = report.capex_estimate;
      responsePayload.pm_surya_subsidy = report.pm_surya_subsidy;
      responsePayload.investment_grade = report.investment_grade;
      responsePayload.cashflow_projection = report.cashflow_projection;
      responsePayload.panel_layout = report.panel_layout;
    }
    
    return sendJSON(res, responsePayload);
  }

  // Catch all
  sendJSON(res, { error: 'Not found' }, 404);
}

module.exports = { handleRequest };

if (require.main === module) {
  const server = http.createServer((req, res) => handleRequest(req, res));
  server.listen(PORT, () => {
    console.log(`[API SERVER] Running at http://localhost:${PORT}`);
  });
}
