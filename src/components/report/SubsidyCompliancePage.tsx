/**
 * PM Surya Ghar Muft Bijli Yojana — Subsidy & Compliance — Page 7 of the PDF report.
 * Institutional compliance sheet detailing PM Surya Ghar calculation rules,
 * DISCOM technical interconnection norms, and mandatory statutory approvals.
 *
 * Rules: Flexbox only, JS StyleSheet objects, pure @react-pdf/renderer.
 */
import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { C, S, inrFmt, inrLakhs } from "./tokens";
import { FONTS } from "./fonts";
import { ReportFooter } from "./ReportFooter";
import type { ReportData } from "./types";

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.pageBg,
    fontFamily: FONTS.body,
    flexDirection: "column",
    padding: 0,
  },
  topAccent: {
    height: 4,
    backgroundColor: C.primary,
    width: "100%",
  },
  body: {
    flex: 1,
    paddingHorizontal: S.pageH,
    paddingVertical: S.pageV,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: S.gap3,
    marginBottom: S.gap3,
  },
  headerTitle: {
    color: C.heading,
    fontSize: S.lg,
    fontWeight: "bold",
    letterSpacing: -0.3,
  },
  headerMeta: {
    color: C.muted,
    fontSize: S.xs,
    fontFamily: FONTS.mono,
  },
  card: {
    backgroundColor: C.cardBg,
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap3,
    marginBottom: S.gap3,
  },
  cardTitle: {
    color: C.heading,
    fontSize: S.sm,
    fontWeight: "bold",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  twoCol: {
    flexDirection: "row",
    gap: S.gap3,
    marginBottom: S.gap3,
  },
  col: {
    flex: 1,
  },
  tierGrid: {
    flexDirection: "row",
    gap: S.gap2,
    marginTop: 4,
  },
  tierCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap2,
  },
  tierLabel: {
    color: C.muted,
    fontSize: 6.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tierVal: {
    color: C.heading,
    fontSize: S.md,
    fontWeight: "bold",
    marginTop: 2,
    marginBottom: 2,
  },
  tierSub: {
    color: C.muted,
    fontSize: 6.5,
  },
  subsidyTotalBox: {
    backgroundColor: "#F2FBF7",
    borderWidth: 1,
    borderColor: `${C.secondary}50`,
    borderRadius: S.r1,
    padding: S.gap2,
    marginTop: S.gap2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subsidyTotalTitle: {
    color: "#0B6645",
    fontSize: S.xs,
    fontWeight: "bold",
  },
  subsidyTotalVal: {
    color: "#0B6645",
    fontSize: S.md,
    fontWeight: "bold",
  },
  table: {
    flexDirection: "column",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tableLabel: {
    color: C.muted,
    fontSize: S.xs,
  },
  tableVal: {
    color: C.heading,
    fontSize: S.xs,
    fontWeight: "bold",
  },
  // Checklist Table
  checklistHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginBottom: 2,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  thItem: { flex: 2.2, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase" },
  thAuth: { flex: 1.8, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase" },
  thStatus: { flex: 0.9, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase", textAlign: "center" },
  thRef: { flex: 1.1, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase", textAlign: "right" },

  colItem: { flex: 2.2, color: C.heading, fontSize: S.xs, fontWeight: "bold" },
  colAuth: { flex: 1.8, color: C.muted, fontSize: 7.0 },
  colStatus: { flex: 0.9, alignItems: "center" },
  colRef: { flex: 1.1, color: C.muted, fontSize: 6.5, fontFamily: FONTS.mono, textAlign: "right" },

  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  statusEligible: {
    backgroundColor: "#E6F8F0",
    borderWidth: 0.5,
    borderColor: "#10B981",
  },
  statusRequired: {
    backgroundColor: "#FFF7ED",
    borderWidth: 0.5,
    borderColor: "#F97316",
  },
  statusExempt: {
    backgroundColor: "#F3F4F6",
    borderWidth: 0.5,
    borderColor: "#9CA3AF",
  },
  statusPending: {
    backgroundColor: "#EFF6FF",
    borderWidth: 0.5,
    borderColor: "#3B82F6",
  },
  statusText: {
    fontSize: 6.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ineligibleNotice: {
    backgroundColor: "#FEF2F2",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: "#F87171",
    padding: S.gap2,
    marginBottom: S.gap2,
  },
  ineligibleText: {
    color: "#DC2626",
    fontSize: S.xs,
    fontWeight: "bold",
  },
  complianceNotice: {
    backgroundColor: "#F9F9FB",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap2,
    flexDirection: "row",
    alignItems: "center",
    gap: S.gap3,
  },
  complianceNoticeText: {
    flex: 1,
    color: C.muted,
    fontSize: 6.5,
    lineHeight: 1.35,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: S.gap2,
  },
  footerText: {
    color: C.muted,
    fontSize: S.xs,
  },
  pageNum: {
    color: C.muted,
    fontSize: S.xs,
    fontFamily: FONTS.mono,
  },
});

export interface SubsidyCompliancePageProps {
  report?: ReportData;
  data?: ReportData;
}

export function SubsidyCompliancePage({ report, data }: SubsidyCompliancePageProps) {
  const r = report || data;
  if (!r) return null;
  const { subsidy, site, system } = r;

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        <View>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>PM Surya Ghar Muft Bijli Yojana — Subsidy & Compliance</Text>
              <Text style={styles.headerMeta}>Institutional Feasibility, Interconnection Norms & Statutory Clearances</Text>
            </View>
            <Text style={styles.headerMeta}>PAGE 7</Text>
          </View>

          {/* Section 1: PM Surya Ghar Subsidy Breakdown */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PM Surya Ghar: Muft Bijli Yojana (Central Financial Assistance)</Text>
            <Text style={{ fontSize: S.xs, color: C.muted, marginBottom: 5 }}>
              Direct Benefit Transfer (DBT) disbursed into beneficiary bank account following DISCOM net-meter inspection.
            </Text>

            {subsidy.ineligibleAbove10kW && (
              <View style={styles.ineligibleNotice}>
                <Text style={styles.ineligibleText}>
                  Not eligible — residential scheme capped at 10 kWp
                </Text>
              </View>
            )}

            <View style={styles.tierGrid}>
              <View style={styles.tierCard}>
                <Text style={styles.tierLabel}>Tier 1 (First 2 kWp)</Text>
                <Text style={styles.tierVal}>{inrLakhs(subsidy.tier1Amount)}</Text>
                <Text style={styles.tierSub}>₹30,000 per kW up to 2 kW</Text>
              </View>

              <View style={styles.tierCard}>
                <Text style={styles.tierLabel}>Tier 2 (3rd kWp)</Text>
                <Text style={styles.tierVal}>{inrLakhs(subsidy.tier2Amount)}</Text>
                <Text style={styles.tierSub}>₹18,000 for 2 kW to 3 kW</Text>
              </View>

              <View style={styles.tierCard}>
                <Text style={styles.tierLabel}>Capacity Above 3 kW</Text>
                <Text style={styles.tierVal}>₹0 Added</Text>
                <Text style={styles.tierSub}>Capped at ₹78,000 Maximum</Text>
              </View>

              <View style={styles.tierCard}>
                <Text style={styles.tierLabel}>Residential Ceiling</Text>
                <Text style={[styles.tierVal, { color: subsidy.ineligibleAbove10kW ? C.error : C.secondary }]}>
                  {subsidy.ineligibleAbove10kW ? "EXCEEDED" : "ELIGIBLE"}
                </Text>
                <Text style={styles.tierSub}>Capped at ₹78,000 for systems up to 10 kWp</Text>
              </View>
            </View>

            <View style={styles.subsidyTotalBox}>
              <View>
                <Text style={styles.subsidyTotalTitle}>Approved Direct Central Subsidy Credit</Text>
                <Text style={{ fontSize: 6.5, color: "#2D5A47", marginTop: 1 }}>
                  Applicable for {system.installedKw.toFixed(2)} kWp grid-connected residential installation in {site.state}
                </Text>
              </View>
              <Text style={styles.subsidyTotalVal}>₹{inrFmt(subsidy.amount)}</Text>
            </View>
          </View>

          {/* Section 2: DISCOM Interconnection Norms & State Policies */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>DISCOM Technical Interconnection</Text>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Jurisdictional State</Text>
                    <Text style={styles.tableVal}>{site.state}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Designated Utility</Text>
                    <Text style={styles.tableVal}>{subsidy.discomName}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Voltage Level</Text>
                    <Text style={styles.tableVal}>{subsidy.interconnectionVoltage}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Net Metering</Text>
                    <Text style={styles.tableVal}>Application required post-installation</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>State Renewable Policy Incentives</Text>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>State Subsidy Scheme</Text>
                    <Text style={styles.tableVal}>State subsidy: ₹0 (Phase 4 — state-specific schemes not yet modeled)</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Electricity Duty Waiver</Text>
                    <Text style={styles.tableVal}>100% Exemption (10 Years)</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Banking Settlement</Text>
                    <Text style={styles.tableVal}>Annual Net Energy Banking</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Anti-Islanding Protection</Text>
                    <Text style={styles.tableVal}>IEEE 1547 / IEC 62116 Compliant</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Section 3: Statutory Approvals Checklist Table */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Statutory Approvals & Compliance Checklist</Text>
            
            <View style={styles.checklistHeader}>
              <Text style={styles.thItem}>Item</Text>
              <Text style={styles.thAuth}>Authority</Text>
              <Text style={styles.thStatus}>Status</Text>
              <Text style={styles.thRef}>Reference</Text>
            </View>

            <View style={styles.table}>
              {(subsidy.complianceList || []).map((item, idx) => {
                const isEligible = item.status === "Eligible";
                const isRequired = item.status === "Required";
                const isExempt = item.status === "Exempt";

                const badgeStyle = isEligible ? styles.statusEligible
                  : isRequired ? styles.statusRequired
                  : isExempt ? styles.statusExempt
                  : styles.statusPending;

                const textCol = isEligible ? "#059669"
                  : isRequired ? "#D97706"
                  : isExempt ? "#4B5563"
                  : "#2563EB";

                return (
                  <View key={idx} style={styles.checklistRow}>
                    <Text style={styles.colItem}>{item.item}</Text>
                    <Text style={styles.colAuth}>{item.authority}</Text>
                    <View style={styles.colStatus}>
                      <View style={[styles.statusBadge, badgeStyle]}>
                        <Text style={[styles.statusText, { color: textCol }]}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.colRef}>{item.reference}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Section 4: National Solar Standards Banner */}
          <View style={styles.complianceNotice}>
            <Text style={{ fontSize: S.xs, fontWeight: "bold", color: C.heading }}>BIS & CEA MANDATE</Text>
            <Text style={styles.complianceNoticeText}>
              All photovoltaic modules supplied comply with IS 14286 / IEC 61215 and ALMM list specifications. Inverters conform to CEA Technical Standards for Connectivity (2019 Amendments) and IEC 61683.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={r} pageNumber={7} />
      </View>
    </Page>
  );
}

export default SubsidyCompliancePage;
