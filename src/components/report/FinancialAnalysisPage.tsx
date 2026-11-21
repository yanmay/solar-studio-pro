/**
 * Financial Visualizations & Sensitivity Analysis — Page 5 of the PDF report.
 * Institutional financial overview rendering all 4 vector SVG charts:
 * 1. Annual Savings Trajectory (BarChart)
 * 2. 25-Year Cumulative Cashflow (LineChart)
 * 3. Capex to Net Outlay Waterfall (WaterfallChart)
 * 4. Capital Expenditure Allocation (DonutChart with Legend)
 *
 * Rules: Flexbox only, JS StyleSheet objects, pure @react-pdf/renderer.
 */
import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { C, S, inrLakhs, inrFmt } from "./tokens";
import { FONTS } from "./fonts";
import { BarChart, LineChart, WaterfallChart, DonutChart } from "./charts";
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
  metricsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: S.gap3,
  },
  metricCard: {
    flex: 1,
    backgroundColor: C.cardBg,
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  metricLabel: {
    color: C.muted,
    fontSize: 6.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    color: C.heading,
    fontSize: S.md,
    fontWeight: "bold",
  },
  chartGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: S.gap3,
    marginBottom: S.gap2,
  },
  chartCard: {
    width: "48.8%",
    backgroundColor: C.cardBg,
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap2,
  },
  chartTitle: {
    color: C.heading,
    fontSize: S.xs,
    fontWeight: "bold",
    marginBottom: 2,
  },
  chartSubtitle: {
    color: C.muted,
    fontSize: 6.5,
    marginBottom: 6,
  },
  donutWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendWrap: {
    flex: 1,
    paddingLeft: 8,
    flexDirection: "column",
    gap: 3,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendLabel: {
    color: C.body,
    fontSize: 6.5,
    flex: 1,
  },
  legendAmount: {
    color: C.heading,
    fontSize: 6.5,
    fontWeight: "bold",
    fontFamily: FONTS.mono,
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

interface FinancialAnalysisPageProps {
  report?: ReportData;
  data?: ReportData;
}

export function FinancialAnalysisPage({ report, data }: FinancialAnalysisPageProps) {
  const actualReport = report || data;
  if (!actualReport) return null;
  const { financial, subsidy } = actualReport;
  const { costBreakdown } = financial;

  // Chart 1: Annual Savings Y1-Y25 sampled or milestone bars
  const savingsBarData = (financial.yearlySavings || []).map((val, idx) => ({
    label: (idx + 1) % 5 === 0 || idx === 0 ? `Y${idx + 1}` : "",
    value: Math.round(val),
    color: C.primary,
  }));

  // Chart 2: Cumulative Cashflow trajectory
  const cashflowLineData = (financial.cumulativeCashFlow || []).map((val, idx) => ({
    label: idx % 5 === 0 ? `Y${idx}` : "",
    value: Math.round(val),
  }));

  // Chart 3: Waterfall capex -> subsidy -> net -> y1 savings
  const waterfallData = [
    { label: "Gross Capex", value: -financial.grossCapexInr },
    { label: "Central Subsidy", value: financial.subsidyInr },
    { label: "Net Outlay", value: -financial.netCapexInr, isTotal: true },
    { label: "Year 1 Savings", value: financial.year1SavingInr },
  ];

  // Chart 4: Capital Expenditure Allocation Donut
  const donutData = [
    { label: "Solar Modules", value: costBreakdown.panelsInr, color: "#FF6600" },
    { label: "Inverter", value: costBreakdown.inverterInr, color: "#FFAA00" },
    { label: "Mounting & BOS", value: costBreakdown.mountingBosInr, color: "#2BD4A0" },
    { label: "EPC Labor", value: costBreakdown.laborInstallInr, color: "#3B82F6" },
    { label: "GST (13.8%)", value: costBreakdown.gstInr, color: "#A855F7" },
  ];

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        <View>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Financial Visualizations & Sensitivity Analysis</Text>
              <Text style={styles.headerMeta}>Capital Outlay · Payback Curve · Cashflow Projections</Text>
            </View>
            <Text style={styles.headerMeta}>PAGE 5</Text>
          </View>

          {/* Key Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Project IRR</Text>
              <Text style={[styles.metricVal, { color: C.secondary }]}>{financial.irr.toFixed(1)}%</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>25-Yr Net Present Value</Text>
              <Text style={styles.metricVal}>{inrLakhs(financial.npv)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Simple Payback</Text>
              <Text style={styles.metricVal}>{financial.paybackPeriod.toFixed(1)} Yrs</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Discounted Payback</Text>
              <Text style={[styles.metricVal, { color: C.primary }]}>{financial.discountedPaybackYears.toFixed(1)} Yrs</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Levelized Energy Cost</Text>
              <Text style={styles.metricVal}>₹{financial.lcoe.toFixed(2)}/kWh</Text>
            </View>
          </View>

          {/* 2x2 Vector SVG Chart Grid */}
          <View style={styles.chartGrid}>
            {/* Chart 1: Annual Savings Trajectory */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Annual Utility Bill Savings (Y1–Y25)</Text>
              <Text style={styles.chartSubtitle}>
                Includes {financial.escalationPct}%/yr tariff escalation & 0.5%/yr degradation
              </Text>
              <BarChart
                data={savingsBarData}
                width={232}
                height={115}
                showLabels={true}
                showValues={false}
              />
            </View>

            {/* Chart 2: Cumulative Cashflow */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>25-Year Cumulative Cashflow Curve</Text>
              <Text style={styles.chartSubtitle}>
                Starts at -Net Capex, breakeven in Year {financial.breakEvenYear}
              </Text>
              <LineChart
                data={cashflowLineData}
                width={232}
                height={115}
                color={C.chartLine}
                showArea={true}
                zeroLine={true}
              />
            </View>

            {/* Chart 3: Capex Waterfall */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Capital Outlay & Subsidy Waterfall</Text>
              <Text style={styles.chartSubtitle}>
                Gross Capex → PM Surya Subsidy → Net Investment Outlay
              </Text>
              <WaterfallChart
                data={waterfallData}
                width={232}
                height={115}
              />
            </View>

            {/* Chart 4: Cost Allocation Donut */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>System Cost Breakdown (₹{inrFmt(financial.grossCapexInr)})</Text>
              <Text style={styles.chartSubtitle}>
                Pre-GST hardware & EPC services with 13.8% composite GST
              </Text>
              <View style={styles.donutWrap}>
                <DonutChart data={donutData} size={95} thickness={24} />
                <View style={styles.legendWrap}>
                  {donutData.map((d, i) => (
                    <View key={i} style={styles.legendItem}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                        <Text style={styles.legendLabel}>{d.label}</Text>
                      </View>
                      <Text style={styles.legendAmount}>{inrLakhs(d.value)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={actualReport} pageNumber={5} />
      </View>
    </Page>
  );
}

export default FinancialAnalysisPage;
