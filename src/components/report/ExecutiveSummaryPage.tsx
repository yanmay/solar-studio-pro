/**
 * Executive Summary — Page 2 of the PDF report.
 * Clean, high-density white institutional sheet.
 *
 * Rules:
 * - Flexbox only, styles as JS objects, no Tailwind, no CSS grid
 * - White background, dark typography
 * - Key metrics grid: Installed kW, Annual kWh, Year 1 Saving, Payback, NPV, IRR, Subsidy
 * - Inline vector LineChart showing 25-year cumulative cashflow
 * - Subsidy eligibility note
 * - Page number "2"
 */
import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { C, S, inrFmt, inrLakhs } from "./tokens";
import { FONTS } from "./fonts";
import { LineChart } from "./charts";
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
    marginBottom: S.gap5,
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
  sectionTitle: {
    color: C.heading,
    fontSize: S.md,
    fontWeight: "bold",
    marginBottom: S.gap2,
    letterSpacing: -0.2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: S.gap2,
    marginBottom: S.gap5,
  },
  card: {
    backgroundColor: C.cardBg,
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap2,
    width: "23.5%", // 4 columns
    minHeight: 52,
    justifyContent: "center",
  },
  cardLabel: {
    color: C.muted,
    fontSize: S.xs,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  cardValue: {
    color: C.heading,
    fontSize: S.lg,
    fontWeight: "bold",
  },
  cardSub: {
    color: C.muted,
    fontSize: S.xs,
    marginTop: 2,
  },
  highlightCard: {
    backgroundColor: "#FFF8F2",
    borderColor: `${C.primary}40`,
  },
  highlightValue: {
    color: C.primary,
  },
  chartContainer: {
    backgroundColor: C.cardBg,
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap3,
    marginBottom: S.gap4,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: S.gap2,
  },
  chartTitle: {
    color: C.heading,
    fontSize: S.base,
    fontWeight: "bold",
  },
  chartSubtitle: {
    color: C.muted,
    fontSize: S.xs,
  },
  subsidyBox: {
    backgroundColor: "#F2FBF7",
    borderWidth: 1,
    borderColor: `${C.secondary}50`,
    borderRadius: S.r1,
    padding: S.gap3,
    marginBottom: S.gap4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subsidyLeft: {
    flex: 1,
    paddingRight: S.gap3,
  },
  subsidyHeading: {
    color: "#0B6645",
    fontSize: S.sm,
    fontWeight: "bold",
    marginBottom: 2,
  },
  subsidyDetail: {
    color: "#2D5A47",
    fontSize: S.xs,
    lineHeight: 1.3,
  },
  subsidyBadge: {
    backgroundColor: "#0B6645",
    paddingHorizontal: S.gap2,
    paddingVertical: 3,
    borderRadius: S.r1,
  },
  subsidyBadgeText: {
    color: "#FFFFFF",
    fontSize: S.xs,
    fontWeight: "bold",
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

interface ExecutiveSummaryPageProps {
  report: ReportData;
}

export function ExecutiveSummaryPage({ report }: ExecutiveSummaryPageProps) {
  const { site, system, financial, subsidy } = report;

  // Build chart points from cumulative cashflow (Year 0 through Year 25)
  const cashFlowData = (financial.cumulativeCashFlow || []).map((val, idx) => ({
    label: idx % 5 === 0 ? `Y${idx}` : "",
    value: Math.round(val),
  }));

  const subsidyText = subsidy.eligible
    ? `Eligible for ${inrLakhs(subsidy.amount)} direct subsidy under PM Surya Ghar: Muft Bijli Yojana for a ${system.installedKw.toFixed(1)} kWp system.`
    : system.installedKw > 10
      ? `System size (${system.installedKw.toFixed(1)} kWp) exceeds the 10 kWp PM Surya Ghar residential ceiling. Subsidy is ₹0.`
      : "Non-residential or unassisted installation category.";

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        {/* Top Header */}
        <View>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Executive Summary & Financial Prospectus</Text>
              <Text style={styles.headerMeta}>{site.address}</Text>
            </View>
            <Text style={styles.headerMeta}>REF: {report.reportId.toUpperCase()}</Text>
          </View>

          {/* Key Metrics Grid (7 Core Metrics + System Size) */}
          <Text style={styles.sectionTitle}>Key Feasibility Metrics</Text>
          <View style={styles.grid}>
            {/* 1. Installed Capacity */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Capacity</Text>
              <Text style={styles.cardValue}>{system.installedKw.toFixed(2)} kWp</Text>
              <Text style={styles.cardSub}>{system.panelCount} panels ({system.panelType})</Text>
            </View>

            {/* 2. Annual Generation */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Annual Yield</Text>
              <Text style={styles.cardValue}>{inrFmt(system.annualKwhYear1)} kWh</Text>
              <Text style={styles.cardSub}>Year 1 generation</Text>
            </View>

            {/* 3. Year 1 Savings */}
            <View style={[styles.card, styles.highlightCard]}>
              <Text style={styles.cardLabel}>Year 1 Savings</Text>
              <Text style={[styles.cardValue, styles.highlightValue]}>
                ₹{inrFmt(financial.year1SavingInr)}
              </Text>
              <Text style={styles.cardSub}>₹{financial.tariff.toFixed(1)}/kWh tariff</Text>
            </View>

            {/* 4. Payback Period */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Payback Period</Text>
              <Text style={styles.cardValue}>{financial.paybackPeriod.toFixed(1)} Years</Text>
              <Text style={styles.cardSub}>Breakeven Y{financial.breakEvenYear}</Text>
            </View>

            {/* 5. Net Present Value */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>25-Yr Net Present Value</Text>
              <Text style={styles.cardValue}>{inrLakhs(financial.npv)}</Text>
              <Text style={styles.cardSub}>{financial.discountRatePct}% discount rate</Text>
            </View>

            {/* 6. Internal Rate of Return */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Project IRR</Text>
              <Text style={styles.cardValue}>{financial.irr.toFixed(1)}%</Text>
              <Text style={styles.cardSub}>Institutional hurdle ~12%</Text>
            </View>

            {/* 7. Government Subsidy */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Central Subsidy</Text>
              <Text style={styles.cardValue}>
                {financial.subsidyInr > 0 ? inrLakhs(financial.subsidyInr) : "₹0"}
              </Text>
              <Text style={styles.cardSub}>PM Surya Ghar</Text>
            </View>

            {/* 8. Net Capital Investment */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Net Capex</Text>
              <Text style={styles.cardValue}>{inrLakhs(financial.netCapexInr)}</Text>
              <Text style={styles.cardSub}>Gross: {inrLakhs(financial.grossCapexInr)}</Text>
            </View>
          </View>

          {/* Subsidy Note Card */}
          <View style={styles.subsidyBox}>
            <View style={styles.subsidyLeft}>
              <Text style={styles.subsidyHeading}>PM Surya Ghar: Muft Bijli Yojana Status</Text>
              <Text style={styles.subsidyDetail}>{subsidyText}</Text>
            </View>
            <View style={styles.subsidyBadge}>
              <Text style={styles.subsidyBadgeText}>
                {subsidy.eligible ? "ELIGIBLE" : subsidy.cap10kWpApplied ? "EXCEEDS CAP" : "STANDARD"}
              </Text>
            </View>
          </View>

          {/* 25-Year Cumulative Cashflow Chart */}
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>25-Year Cumulative Cashflow Trajectory</Text>
                <Text style={styles.chartSubtitle}>
                  Includes degradation (0.5%/yr), tariff inflation ({financial.escalationPct}%/yr), and O&M costs
                </Text>
              </View>
              <Text style={[styles.chartSubtitle, { fontWeight: "bold", color: C.secondary }]}>
                Cumulative: {inrLakhs(financial.savings25yrInr)}
              </Text>
            </View>
            {cashFlowData.length > 0 && (
              <LineChart
                data={cashFlowData}
                width={500}
                height={150}
                color={C.chartLine}
                showArea={true}
                zeroLine={true}
              />
            )}
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={report} pageNumber={2} />
      </View>
    </Page>
  );
}
