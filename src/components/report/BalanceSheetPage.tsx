/**
 * 25-Year Detailed Cashflow Schedule (Balance Sheet) — Page 6 of the PDF report.
 * Institutional financial audit sheet displaying the full 25-year schedule of solar generation,
 * gross utility savings, cumulative module degradation, scheduled O&M, annual net cashflow,
 * and cumulative investment recovery position.
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
    paddingBottom: S.gap2,
    marginBottom: 6,
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
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  subHeaderText: {
    color: C.muted,
    fontSize: 7.5,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: S.r1,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#111115",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableHeaderCell: {
    color: "#FFFFFF",
    fontSize: 6.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2.2,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.divider,
  },
  tableRowEven: {
    backgroundColor: "#FBFBFC",
  },
  tableRowPayback: {
    backgroundColor: "#E8FAF2",
    borderLeftWidth: 2,
    borderLeftColor: C.secondary,
  },
  tableCell: {
    fontSize: 7,
    fontFamily: FONTS.mono,
    color: C.body,
  },
  tableCellBold: {
    fontSize: 7,
    fontWeight: "bold",
    fontFamily: FONTS.mono,
  },
  // Columns flex distribution
  colYr: { width: "8%", textAlign: "left" },
  colGen: { width: "16%", textAlign: "right" },
  colSav: { width: "17%", textAlign: "right" },
  colDeg: { width: "14%", textAlign: "right" },
  colOm: { width: "14%", textAlign: "right" },
  colNet: { width: "15%", textAlign: "right" },
  colCum: { width: "16%", textAlign: "right" },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: "#F3F3F5",
    borderTopWidth: 1.5,
    borderTopColor: C.heading,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 6,
    borderRadius: S.r1,
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryItem: {
    flexDirection: "column",
  },
  summaryLabel: {
    color: C.muted,
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryVal: {
    color: C.heading,
    fontSize: S.sm,
    fontWeight: "bold",
    marginTop: 1,
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

interface BalanceSheetPageProps {
  report?: ReportData;
  data?: ReportData;
}

export function BalanceSheetPage({ report, data }: BalanceSheetPageProps) {
  const actualReport = report || data;
  if (!actualReport) return null;
  const { financial } = actualReport;
  const rows = financial.cashFlowRows || [];

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        <View>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>25-Year Detailed Cashflow Schedule</Text>
              <Text style={styles.headerMeta}>Institutional Balance Sheet · Generation Degradation · Scheduled O&M</Text>
            </View>
            <Text style={styles.headerMeta}>PAGE 6</Text>
          </View>

          <View style={styles.subHeader}>
            <Text style={styles.subHeaderText}>
              Net Outlay: ₹{inrFmt(financial.netCapexInr)} · Initial Tariff: ₹{financial.tariff.toFixed(1)}/kWh · Tariff Escalation: {financial.escalationPct}%/yr · Degradation: 0.5%/yr
            </Text>
            <Text style={[styles.subHeaderText, { color: C.secondary, fontWeight: "bold" }]}>
              Payback Year: Y{financial.breakEvenYear}
            </Text>
          </View>

          {/* 25-Row Balance Sheet Table */}
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colYr]}>Year</Text>
              <Text style={[styles.tableHeaderCell, styles.colGen]}>Generation</Text>
              <Text style={[styles.tableHeaderCell, styles.colSav]}>Gross Savings</Text>
              <Text style={[styles.tableHeaderCell, styles.colDeg]}>Cum. Degradation</Text>
              <Text style={[styles.tableHeaderCell, styles.colOm]}>O&M Expense</Text>
              <Text style={[styles.tableHeaderCell, styles.colNet]}>Net Cashflow</Text>
              <Text style={[styles.tableHeaderCell, styles.colCum]}>Cumulative</Text>
            </View>

            {/* 25 Data Rows */}
            {rows.map((r, idx) => {
              const isEven = idx % 2 === 1;
              const isPaybackRow = r.year === financial.breakEvenYear;
              const isPositiveCum = r.cumulativeInr >= 0;

              return (
                <View
                  key={r.year}
                  style={[
                    styles.tableRow,
                    isEven ? styles.tableRowEven : {},
                    isPaybackRow ? styles.tableRowPayback : {},
                  ]}
                >
                  <Text style={[styles.tableCell, styles.colYr, { fontWeight: "bold" }]}>
                    Y{r.year}{isPaybackRow ? " ★" : ""}
                  </Text>
                  <Text style={[styles.tableCell, styles.colGen]}>{inrFmt(r.generationKwh)} kWh</Text>
                  <Text style={[styles.tableCell, styles.colSav]}>₹{inrFmt(r.grossSavingsInr)}</Text>
                  <Text style={[styles.tableCell, styles.colDeg]}>{r.cumulativeDegradationPct.toFixed(1)}%</Text>
                  <Text style={[styles.tableCell, styles.colOm]}>₹{inrFmt(r.omCostInr)}</Text>
                  <Text style={[styles.tableCellBold, styles.colNet, { color: C.heading }]}>
                    ₹{inrFmt(r.netCashflowInr)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellBold,
                      styles.colCum,
                      { color: isPositiveCum ? C.secondary : C.error },
                    ]}
                  >
                    {isPositiveCum ? `₹${inrFmt(r.cumulativeInr)}` : `-₹${inrFmt(Math.abs(r.cumulativeInr))}`}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Institutional KPI Summary Footer Row */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Internal Rate of Return (IRR)</Text>
              <Text style={[styles.summaryVal, { color: C.secondary }]}>{financial.irr.toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net Present Value ({financial.discountRatePct}%)</Text>
              <Text style={styles.summaryVal}>{inrLakhs(financial.npv)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Simple Payback Period</Text>
              <Text style={styles.summaryVal}>{financial.paybackPeriod.toFixed(1)} Years</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Discounted Payback Period</Text>
              <Text style={[styles.summaryVal, { color: C.primary }]}>{financial.discountedPaybackYears.toFixed(1)} Years</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total 25-Year Net Yield</Text>
              <Text style={[styles.summaryVal, { color: C.heading }]}>{inrLakhs(rows[24]?.cumulativeInr ?? 0)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={actualReport} pageNumber={6} />
      </View>
    </Page>
  );
}

export default BalanceSheetPage;
