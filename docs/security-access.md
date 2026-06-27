# Solar Studio Pro: Security & Access Specification

This document provides a plain-English explanation of the security design and access controls built into Solar Studio Pro (SUNPOWER LINK). It is designed to help non-technical stakeholders understand how we protect user data, secure payments, and prevent unauthorized access.

---

## 1. Authentication Strategy

To balance security with user convenience, we use two different methods of authentication depending on the user's role:

1. **Homeowners (OTP / Magic-Link)**: Homeowners use a temporary One-Time Password (OTP) sent via SMS/Email or a direct "magic link" to log in. This passwordless method reduces login friction, maximizing the number of users who complete their solar scans and reach the paywall. Homeowners do not have to create or remember yet another password, leading to higher conversion rates.
2. **Installers & Admins (Email + Password or Google OAuth)**: Installers and system administrators access a Customer Relationship Management (CRM) panel where they manage quotes and customer contacts. Since they handle sensitive business information, they use standard credentials (email and password) or Google Single Sign-On (OAuth). This enforces higher accountability and provides secure, long-lived sessions for daily operational work.

---

## 2. Roles & Permissions Matrix

Our system enforces a strict role-based permission map. A user cannot perform any action unless their role permits it:

| Role | Who They Are | What They Can Do | What They Cannot Do |
| :--- | :--- | :--- | :--- |
| **Guest** | Anonymous visitor | Run free roof scans, view basic projections, see payment lock screen. | View full financial prospectus, access 3D AR viewer, submit leads, view other users' scans. |
| **Homeowner** | Logged-in homeowner | Run scans, unlock and view *their own* full reports, request installer quotes (submit leads). | View other homeowners' scans, view installer CRM, assign or purchase leads. |
| **Installer** | Solar panel installer / CRM user | View and manage leads assigned/purchased by their company, update lead statuses. | Access scans they haven't paid for, modify global tariff configurations, access admin controls. |
| **Admin** | Internal team member | Access all scans and leads, modify global settings and tariffs, manage installer approvals. | None (has full master access). |

---

## 3. Row-Level Security (RLS) & Data Isolation

To prevent users from viewing other people's sensitive information (e.g., a competitor viewing installer leads), the database restricts access at the row level:

* **Homeowner Isolation**: When a homeowner views their list of scans or lead requests, the database checks that the profile ID matches their login ID (`auth.uid() = user_id`). They cannot view or modify scans belonging to any other user.
* **Installer Isolation**: Installers can only view leads that have been assigned or sold to them. The database confirms this relationship by looking up lead assignments and blocking any query that requests a lead ID not assigned to their business profile.
* **Admin Master Access**: Admins are exempt from these restrictions, allowing them to oversee and troubleshoot the entire platform.

If database credentials are not active, this same isolation logic is mirrored in our server API code to guarantee data safety.

---

## 4. Payment Integrity (Fixing the SessionStorage Vulnerability)

### The Vulnerability
Previously, the system determined if a solar scan was unlocked by checking the browser's temporary storage (`sessionStorage`) or flags in the website address (URL). A technically savvy user could bypass our paywall and unlock the full prospectus for free simply by modifying these values in their browser console or typing `?unlocked=true` in the URL.

### The Fix
The unlocked state is now secured by a server-verified process:
1. **Server-Side Verification**: When a homeowner completes a payment through Razorpay, the transaction signature is sent to our backend. The server cryptographically verifies the payment signature using a private secret key (`RAZORPAY_KEY_SECRET`).
2. **Secure Records**: Once verified, the server records the unlock status in the database.
3. **Data Gating**: When a user requests report details, the backend checks the database or secure cookies. If the scan is not paid for, the server strips out all premium fields (25-year cumulative savings, NPV, IRR, ROI calculations, and panel layout configurations) before sending the data to the browser.
4. **No Spoofing**: Even if a user manually forces the interface to look "unlocked", the actual data is missing from the browser, making spoofing useless.

---

## 5. Input Validation & Error Handling

To prevent malicious or corrupted data from entering the database, all inputs are validated on the server using **Zod** (a schema validation library). 

### Validation Rules
* **Coordinates**: Latitude and longitude must be valid coordinates within Indian territorial borders.
* **Roof Area**: Must be a positive, non-zero number.
* **Polygon Geometry**: The drawn shape must have at least 3 vertices and must not cross or intersect itself (self-intersection).
* **GSTIN**: Installers must register with a valid 15-character Indian Goods and Services Tax Identification Number (GSTIN) conforming to government standards.

### User-Friendly Error Messages
We map internal errors to clear, friendly instructions for the user, while simultaneously sending technical debug logs to our error monitoring platform (**Sentry**):

* **API Timeout**: *"We are experiencing temporary connection delays. Please check your internet connection and try again."*
* **NASA POWER Climatology Failure**: *"Unable to fetch live solar irradiance data. Falling back to regional averages."*
* **Invalid Address**: *"We couldn't pinpoint this location. Please enter a more specific address or drop a pin manually on the map."*
* **Payment Failure/Cancel**: *"Your payment was not completed. If money was deducted, it will be refunded within 3-5 business days."*
* **Unauthorized Access**: *"You do not have permission to view this report. Please log in with the correct account."*

---

## 6. Edge Case Mitigations

We handle specific user actions and error scenarios to ensure a stable, bulletproof experience:

* **Empty Forms**: Forms are disabled during submission, and fields highlight with validation errors if inputs are missing.
* **Negative or Zero Roof Area**: Blocked at both map calculation and server levels.
* **Self-Intersecting Polygons**: Map drawing interface warns the user and refuses to calculate shapes where boundaries cross.
* **Slow Connection**: Loaders are displayed for every remote fetch, with an automated 10-second timeout that alerts the user instead of hanging indefinitely.
* **Expired Sessions**: If a login session expires, the app redirects to the OTP page, saving the user's progress in local state so they don't lose their scan coordinates.
* **Double-Submit Payments**: The checkout button is disabled as soon as it is clicked to prevent double charging.
* **Guessing URLs**: Accessing `/results` with a guessed site ID will return a "Report not found" or "Unauthorized access" screen, and no premium data will be downloaded from the server.
