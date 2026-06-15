# -*- coding: utf-8 -*-
"""
Comprehensive SUNPOWER LINK webapp test script.
Server already running at http://localhost:8080
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright
import os, json, time

SCREENSHOTS = r"C:\Users\noobg\solar-studio-pro\test-results\screenshots"
os.makedirs(SCREENSHOTS, exist_ok=True)

issues = []

def log(msg):
    print(f"  [TEST] {msg}")

def issue(page_name, description):
    issues.append({"page": page_name, "issue": description})
    print(f"  [ISSUE] {page_name}: {description}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()

    # Collect console errors
    console_errors = []
    def setup_page(p):
        p.on("console", lambda msg: console_errors.append({"type": msg.type, "text": f"[{p.url}] Console: {msg.text}"}) if msg.type == "error" else None)
        p.on("pageerror", lambda err: console_errors.append({"type": "error", "text": f"[{p.url}] PageError: {err.message}"}))
        p.on("response", lambda res: console_errors.append({"type": "error", "text": f"404 Not Found: {res.url}"}) if res.status == 404 else None)

    setup_page(page)

    # ─────────────────────────────────────
    # 1. LANDING PAGE — Desktop
    # ─────────────────────────────────────
    log("=== LANDING PAGE (Desktop 1440px) ===")
    page.goto("http://localhost:8080/", wait_until="domcontentloaded")
    time.sleep(1)
    page.screenshot(path=f"{SCREENSHOTS}/01_landing_desktop.png", full_page=True)
    log("Screenshot saved: 01_landing_desktop")

    # Check hero section
    hero = page.locator("#hero")
    if not hero.is_visible():
        issue("Landing", "Hero section not visible")

    # Check primary CTA buttons render
    buttons = page.locator("button.btn-primary, a.btn-primary").all()
    log(f"btn-primary elements found: {len(buttons)}")
    if len(buttons) == 0:
        issue("Landing", "No .btn-primary buttons found — CSS class may not be applied")

    # Check nav bar
    nav = page.locator("nav").first
    if not nav.is_visible():
        issue("Landing", "Nav bar not visible")

    # Check features section
    features = page.locator("#features")
    page.evaluate("document.querySelector('#features')?.scrollIntoView()")
    time.sleep(0.5)
    page.screenshot(path=f"{SCREENSHOTS}/02_landing_features.png", full_page=False)
    log("Screenshot saved: 02_landing_features")

    # Check workflow section
    page.evaluate("document.querySelector('#workflow')?.scrollIntoView()")
    time.sleep(0.5)
    page.screenshot(path=f"{SCREENSHOTS}/03_landing_workflow.png", full_page=False)
    log("Screenshot saved: 03_landing_workflow")

    # Check pricing section
    page.evaluate("document.querySelector('#pricing')?.scrollIntoView()")
    time.sleep(0.5)
    page.screenshot(path=f"{SCREENSHOTS}/04_landing_pricing.png", full_page=False)
    log("Screenshot saved: 04_landing_pricing")

    # Check FAQ
    faq_buttons = page.locator("footer button").all()
    log(f"FAQ buttons found: {len(faq_buttons)}")
    if len(faq_buttons) > 0:
        faq_buttons[0].click()
        time.sleep(0.3)
        page.screenshot(path=f"{SCREENSHOTS}/05_landing_faq_open.png", full_page=False)
        log("Screenshot saved: 05_landing_faq_open")

    # ─────────────────────────────────────
    # 2. LANDING PAGE — Mobile
    # ─────────────────────────────────────
    log("=== LANDING PAGE (Mobile 390px) ===")
    mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
    mobile_page = mobile_ctx.new_page()
    setup_page(mobile_page)
    mobile_page.goto("http://localhost:8080/", wait_until="domcontentloaded")
    time.sleep(1)
    mobile_page.screenshot(path=f"{SCREENSHOTS}/06_landing_mobile.png", full_page=True)
    log("Screenshot saved: 06_landing_mobile")

    # Check mobile nav toggle
    menu_btn = mobile_page.locator("nav button").first
    if menu_btn.is_visible():
        menu_btn.click()
        time.sleep(0.3)
        mobile_page.screenshot(path=f"{SCREENSHOTS}/07_landing_mobile_menu.png")
        log("Screenshot saved: 07_landing_mobile_menu")
        # Check Launch Analyzer button in mobile menu
        mobile_cta = mobile_page.locator(".btn-primary").first
        if not mobile_cta.is_visible():
            issue("Landing Mobile", "Mobile menu Launch Analyzer button not visible or btn-primary not applied")
        menu_btn.click()  # close

    # Check sticky mobile CTA
    mobile_page.evaluate("window.scrollTo(0, 500)")
    time.sleep(0.3)
    sticky = mobile_page.locator("div.fixed.bottom-0")
    if not sticky.is_visible():
        issue("Landing Mobile", "Mobile sticky CTA not visible on scroll")
    else:
        log("Mobile sticky CTA visible ✓")
    
    mobile_page.screenshot(path=f"{SCREENSHOTS}/08_landing_mobile_scroll.png")
    log("Screenshot saved: 08_landing_mobile_scroll")
    mobile_ctx.close()

    # ─────────────────────────────────────
    # 3. MAP PAGE — Desktop
    # ─────────────────────────────────────
    log("=== MAP PAGE (Desktop) ===")
    page.goto("http://localhost:8080/map", wait_until="domcontentloaded")
    time.sleep(2)  # Globe animation needs time
    page.screenshot(path=f"{SCREENSHOTS}/09_map_globe.png")
    log("Screenshot saved: 09_map_globe")

    # Check globe hint
    globe_hint = page.locator(".animate-float-slow")
    if not globe_hint.is_visible():
        issue("Map", "Globe hint label not visible")
    else:
        log("Globe hint visible ✓")

    # Check search bar
    search_input = page.locator("#location-search")
    if not search_input.is_visible():
        issue("Map", "Search input not found by #location-search")
    else:
        log("Search bar visible ✓")
        # Type a search query
        search_input.fill("Mumbai, Maharashtra")
        time.sleep(0.5)
        page.screenshot(path=f"{SCREENSHOTS}/10_map_search_typed.png")
        log("Screenshot saved: 10_map_search_typed")

        # Check suggestions dropdown
        suggestions = page.locator("#search-suggestions")
        page.wait_for_timeout(1500)  # Wait for debounce
        if suggestions.is_visible():
            log("Autocomplete suggestions visible ✓")
            page.screenshot(path=f"{SCREENSHOTS}/11_map_suggestions.png")
            log("Screenshot saved: 11_map_suggestions")
            # Click first suggestion
            first_suggestion = page.locator("#search-suggestions button").first
            if first_suggestion.is_visible():
                first_suggestion.click()
                page.wait_for_timeout(3000)  # Wait for map fly-to
                log("Clicked first suggestion")
            else:
                # Press Enter to search
                search_input.press("Enter")
                page.wait_for_timeout(3000)
        else:
            # No suggestions — press Enter
            search_input.press("Enter")
            page.wait_for_timeout(3000)

    page.screenshot(path=f"{SCREENSHOTS}/12_map_after_search.png")
    log("Screenshot saved: 12_map_after_search")

    # Check sidebar appeared
    sidebar = page.locator("[aria-label='Rooftop Editor']")
    sidebar_card = page.locator(".md\\:w-\\[360px\\]")
    has_sidebar = page.locator("h3:has-text('Rooftop Editor')").is_visible()
    if not has_sidebar:
        issue("Map", "Sidebar 'Rooftop Editor' panel did not appear after search")
    else:
        log("Sidebar visible after search ✓")
        page.screenshot(path=f"{SCREENSHOTS}/13_map_sidebar.png")
        log("Screenshot saved: 13_map_sidebar")

    # Check zoom controls visible
    zoom_in = page.locator("button[aria-label='Zoom in']")
    zoom_out = page.locator("button[aria-label='Zoom out']")
    if zoom_in.is_visible():
        log("Zoom controls visible ✓")
        zoom_in.click()
        time.sleep(0.3)
        zoom_out.click()
    else:
        issue("Map", "Zoom controls not visible after globe dismisses")

    # ─────────────────────────────────────
    # 4. MAP PAGE — Mobile 
    # ─────────────────────────────────────
    log("=== MAP PAGE (Mobile) ===")
    mob_map = browser.new_context(viewport={"width": 390, "height": 844})
    mob_map_page = mob_map.new_page()
    setup_page(mob_map_page)
    mob_map_page.goto("http://localhost:8080/map", wait_until="domcontentloaded")
    time.sleep(2)
    mob_map_page.screenshot(path=f"{SCREENSHOTS}/14_map_mobile_globe.png")
    log("Screenshot saved: 14_map_mobile_globe")

    # Search on mobile
    search_mob = mob_map_page.locator("#location-search")
    if search_mob.is_visible():
        search_mob.fill("Delhi")
        mob_map_page.wait_for_timeout(1500)
        # Check suggestions dropdown
        suggestions_mob = mob_map_page.locator("#search-suggestions")
        if suggestions_mob.is_visible():
            log("Autocomplete suggestions visible on mobile ✓")
            first_suggestion = mob_map_page.locator("#search-suggestions button").first
            if first_suggestion.is_visible():
                first_suggestion.click()
                mob_map_page.wait_for_timeout(3000)
                log("Clicked first suggestion on mobile")
            else:
                search_mob.press("Enter")
                mob_map_page.wait_for_timeout(3000)
        else:
            search_mob.press("Enter")
            mob_map_page.wait_for_timeout(3000)
        
        mob_map_page.screenshot(path=f"{SCREENSHOTS}/15_map_mobile_after_search.png")
        log("Screenshot saved: 15_map_mobile_after_search")

        # Check mobile bottom sheet sidebar
        mob_sidebar = mob_map_page.locator("h3:has-text('Rooftop Editor')")
        if mob_sidebar.is_visible():
            log("Mobile sidebar (bottom sheet) visible ✓")
        else:
            issue("Map Mobile", "Sidebar bottom sheet not visible after search on mobile")
    mob_map.close()

    # ─────────────────────────────────────
    # 5. RESULTS PAGE
    # ─────────────────────────────────────
    log("=== RESULTS PAGE ===")
    # Inject mock data into sessionStorage to view results page
    mock_data = {
        "analysisId": "TEST-001",
        "irradianceSource": "NASA_POWER",
        "rooftop": {"drawnAreaM2": 85.5, "usableAreaM2": 64.1},
        "energy": {
            "peakSunHoursDaily": 5.2,
            "installedCapacityKw": 6.5,
            "dailyKwh": 28.8,
            "monthlyKwh": 875.0,
            "annualKwh": 10500.0
        },
        "financials": {
            "electricityRateInr": 8.5,
            "monthlySavingsInr": 7438,
            "annualSavingsInr": 89250,
            "savings25yrInr": 2231250
        },
        "environmental": {"co2AnnualKg": 8820, "treesEquivalent": 401},
        "monthlyIrradiance": {
            "JAN": 4.8, "FEB": 5.1, "MAR": 5.8, "APR": 6.2, "MAY": 6.5,
            "JUN": 5.0, "JUL": 4.2, "AUG": 4.5, "SEP": 5.3, "OCT": 5.6,
            "NOV": 5.0, "DEC": 4.7
        },
        "panelCount": 15,
        "panelType": "premium",
        "alignment": "south",
        "tiltDeg": 15,
        "orientation": "portrait",
        "walkways": True,
        "setbackM": 0.5,
        "location": {"lat": 19.076, "lng": 72.877, "label": "Mumbai, Maharashtra, India"}
    }
    results_page = browser.new_page()
    setup_page(results_page)
    results_page.goto("http://localhost:8080/", wait_until="domcontentloaded")
    results_page.evaluate(f"sessionStorage.setItem('sunpower-results', JSON.stringify({json.dumps(mock_data)}))")
    results_page.goto("http://localhost:8080/results", wait_until="domcontentloaded")
    time.sleep(1.5)
    results_page.screenshot(path=f"{SCREENSHOTS}/16_results_top.png")
    log("Screenshot saved: 16_results_top")

    # Check metric cards
    metric_cards = results_page.locator(".animate-slide-up").all()
    log(f"Animated metric cards: {len(metric_cards)}")
    if len(metric_cards) < 4:
        issue("Results", f"Expected 4 stagger-animated metric cards, found {len(metric_cards)}")

    # Check Download Report button is orange
    dl_btn = results_page.locator("button.btn-primary[aria-label='Download PDF report'], button.btn-primary:has-text('Download'), button:has-text('Download')")
    if dl_btn.count() > 0:
        log("Download Report button found ✓")
    else:
        issue("Results", "Download Report button not found")

    # Check Back to Map button
    back_btn = results_page.locator("button:has-text('Back to Map'), [aria-label='Go back to map']")
    if back_btn.count() > 0:
        log("Back to Map button found ✓")
    else:
        issue("Results", "Back to Map button not found")

    # Scroll to see charts
    results_page.evaluate("window.scrollTo(0, 500)")
    time.sleep(0.5)
    results_page.screenshot(path=f"{SCREENSHOTS}/17_results_charts.png")
    log("Screenshot saved: 17_results_charts")

    # Scroll to footer
    results_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(0.5)
    results_page.screenshot(path=f"{SCREENSHOTS}/18_results_footer.png")
    log("Screenshot saved: 18_results_footer")

    # Check footer buttons
    new_analysis_btn = results_page.locator("button.btn-primary:has-text('Analyze')")
    if new_analysis_btn.is_visible():
        log("'Analyze Another Rooftop' btn-primary visible ✓")
    else:
        issue("Results", "'Analyze Another Rooftop' btn-primary button not visible in footer")

    back_home_btn = results_page.locator("button:has-text('Back to Home'), a:has-text('Back to Home')")
    if back_home_btn.count() > 0:
        log("'Back to Home' footer button found ✓")
    else:
        issue("Results", "'Back to Home' button not found in Results footer")

    # Results Mobile
    log("=== RESULTS PAGE (Mobile) ===")
    mob_results = browser.new_context(viewport={"width": 390, "height": 844})
    mob_results_page = mob_results.new_page()
    setup_page(mob_results_page)
    mob_results_page.goto("http://localhost:8080/", wait_until="domcontentloaded")
    mob_results_page.evaluate(f"sessionStorage.setItem('sunpower-results', JSON.stringify({json.dumps(mock_data)}))")
    mob_results_page.goto("http://localhost:8080/results", wait_until="domcontentloaded")
    time.sleep(1.5)
    mob_results_page.screenshot(path=f"{SCREENSHOTS}/19_results_mobile_top.png")
    log("Screenshot saved: 19_results_mobile_top")

    # Check header buttons on mobile — should NOT be full-width stretched
    header_btns = mob_results_page.locator("header button, header [role='button']").all()
    log(f"Header buttons on mobile: {len(header_btns)}")
    for i, btn in enumerate(header_btns):
        box = btn.bounding_box()
        if box and box['width'] > 350:
            issue("Results Mobile", f"Header button #{i+1} is full-width ({box['width']}px) — should be auto-width")
        elif box:
            log(f"  Header button #{i+1} width: {box['width']:.0f}px ✓")
    
    mob_results_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(0.3)
    mob_results_page.screenshot(path=f"{SCREENSHOTS}/20_results_mobile_footer.png")
    log("Screenshot saved: 20_results_mobile_footer")
    mob_results.close()

    # ─────────────────────────────────────
    # 6. Console errors summary
    # ─────────────────────────────────────
    log(f"\n=== Console Errors: {len(console_errors)} ===")
    for err in console_errors[:10]:
        issue("Console", err['text'][:150])

    browser.close()

# ─────────────────────────────────────
# REPORT
# ─────────────────────────────────────
print("\n" + "="*60)
print(f"ISSUES FOUND: {len(issues)}")
print("="*60)
for i, iss in enumerate(issues, 1):
    print(f"  {i}. [{iss['page']}] {iss['issue']}")
if not issues:
    print("  ✓ No issues found!")

with open(r"C:\Users\noobg\solar-studio-pro\test-results\issues.json", "w") as f:
    json.dump(issues, f, indent=2)
print(f"\nScreenshots saved to: {SCREENSHOTS}")
print("Issues saved to: test-results/issues.json")
