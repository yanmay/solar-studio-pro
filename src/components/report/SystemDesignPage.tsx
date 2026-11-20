/**
 * System Architecture & Technical Specifications — Page 4 of the PDF report.
 * Institutional engineering sheet covering SVG panel layout grid, electrical stringing,
 * equipment bill of materials, and loss derating budget.
 *
 * Rules: Flexbox only, JS StyleSheet objects, no Tailwind, pure @react-pdf/renderer.
 */
import React from "react";
import { Page, View, Text, StyleSheet, Svg, Rect, Line, G } from "@react-pdf/renderer";
import { C, S } from "./tokens";
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
    marginBottom: S.gap4,
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
  layoutCard: {
    backgroundColor: C.cardBg,
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap3,
    marginBottom: S.gap4,
  },
  cardTitle: {
    color: C.heading,
    fontSize: S.sm,
    fontWeight: "bold",
    marginBottom: S.gap1,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    color: C.muted,
    fontSize: S.xs,
    marginBottom: S.gap2,
  },
  svgContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D0D11",
    borderRadius: S.r1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#1E1E24",
  },
  twoCol: {
    flexDirection: "row",
    gap: S.gap3,
    marginBottom: S.gap4,
  },
  col: {
    flex: 1,
  },
  card: {
    backgroundColor: C.cardBg,
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap3,
  },
  table: {
    flexDirection: "column",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
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
    fontFamily: FONTS.mono,
  },
  specBox: {
    backgroundColor: "#F9F9FB",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap3,
  },
  specItem: {
    marginBottom: 6,
  },
  specLabel: {
    color: C.muted,
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  specValue: {
    color: C.heading,
    fontSize: S.xs,
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

interface SystemDesignPageProps {
  report: ReportData;
}

export function SystemDesignPage({ report }: SystemDesignPageProps) {
  const { system, site } = report;

  // Generate dynamic panel array grid (SVG)
  const totalPanels = system.panelCount;
  const columns = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(totalPanels * 1.5))));
  const rows = Math.ceil(totalPanels / columns);

  const panelW = 34;
  const panelH = 18;
  const gapX = 3;
  const gapY = 3;
  const totalSvgW = columns * (panelW + gapX) + 30;
  const totalSvgH = rows * (panelH + gapY) + 26;

  const panels = Array.from({ length: totalPanels }).map((_, idx) => {
    const r = Math.floor(idx / columns);
    const c = idx % columns;
    const x = 15 + c * (panelW + gapX);
    const y = 12 + r * (panelH + gapY);
    const stringNum = (idx % system.stringConfig.strings) + 1;
    return { idx, r, c, x, y, stringNum };
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        <View>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>System Architecture & Technical Specifications</Text>
              <Text style={styles.headerMeta}>CAD Array Layout · Electrical Stringing · Equipment BOM</Text>
            </View>
            <Text style={styles.headerMeta}>PAGE 4</Text>
          </View>

          {/* Section 1: Panel Layout Diagram (Pure Vector SVG) */}
          <View style={styles.layoutCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={styles.cardTitle}>Array Geometric Placement & String Routing</Text>
                <Text style={styles.cardSubtitle}>
                  {system.panelCount} × {system.panelWattage}Wp High-Efficiency Half-Cut Solar Modules ({system.installedKw.toFixed(2)} kWp Array)
                </Text>
              </View>
              <Text style={{ fontSize: S.xs, color: C.secondary, fontFamily: FONTS.mono }}>
                Orientation: {site.orientationLabel}
              </Text>
            </View>

            <View style={styles.svgContainer}>
              <Svg width={Math.min(500, totalSvgW)} height={Math.min(140, totalSvgH)}>
                {/* Outer roof perimeter boundary */}
                <Rect
                  x={4}
                  y={4}
                  width={Math.min(500, totalSvgW) - 8}
                  height={Math.min(140, totalSvgH) - 8}
                  fill="#121216"
                  stroke="#27272F"
                  strokeWidth={1}
                  rx={3}
                />

                {/* Array panels */}
                {panels.map((p) => {
                  const strokeCol = p.stringNum === 1 ? C.primary : C.secondary;
                  return (
                    <G key={p.idx}>
                      <Rect
                        x={p.x}
                        y={p.y}
                        width={panelW}
                        height={panelH}
                        fill="#1C2028"
                        stroke={strokeCol}
                        strokeWidth={0.8}
                        rx={1}
                      />
                      {/* Silicon wafer busbar lines */}
                      <Line
                        x1={p.x + panelW * 0.33}
                        y1={p.y + 1}
                        x2={p.x + panelW * 0.33}
                        y2={p.y + panelH - 1}
                        stroke="#2B3240"
                        strokeWidth={0.5}
                      />
                      <Line
                        x1={p.x + panelW * 0.66}
                        y1={p.y + 1}
                        x2={p.x + panelW * 0.66}
                        y2={p.y + panelH - 1}
                        stroke="#2B3240"
                        strokeWidth={0.5}
                      />
                    </G>
                  );
                })}
              </Svg>
            </View>
          </View>

          {/* Section 2: Electrical Architecture & Derating (Two Columns) */}
          <View style={styles.twoCol}>
            {/* Left: Electrical Configuration Table */}
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Electrical String Configuration</Text>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Array Configuration</Text>
                    <Text style={styles.tableVal}>{system.stringConfig.strings} MPPT String{system.stringConfig.strings > 1 ? "s" : ""}</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Panels Per String</Text>
                    <Text style={styles.tableVal}>{system.stringConfig.panelsPerString} Modules in Series</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Array Open-Circuit Voltage (Voc)</Text>
                    <Text style={styles.tableVal}>{system.stringConfig.vOcTotal} V DC (STC)</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Short-Circuit Current (Isc)</Text>
                    <Text style={styles.tableVal}>{system.stringConfig.iScTotal} A DC</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>DC to AC Loading Ratio</Text>
                    <Text style={styles.tableVal}>{system.dcAcRatio.toFixed(2)} : 1</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Grid Voltage Level</Text>
                    <Text style={styles.tableVal}>{system.inverterModel.includes("Three") ? "415V Three Phase" : "230V Single Phase"}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Right: Loss Derate Budget */}
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>System Performance Derating Budget</Text>
                <View style={styles.table}>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Cell Operating Temperature</Text>
                    <Text style={styles.tableVal}>-{system.derating.temperaturePct.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Soiling & Dust Accumulation</Text>
                    <Text style={styles.tableVal}>-{system.derating.soilingPct.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Module Manufacturing Mismatch</Text>
                    <Text style={styles.tableVal}>-{system.derating.mismatchPct.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>Inverter Conversion Inefficiencies</Text>
                    <Text style={styles.tableVal}>-{system.derating.inverterPct.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.tableRow}>
                    <Text style={styles.tableLabel}>DC / AC Ohmic Wiring Losses</Text>
                    <Text style={styles.tableVal}>-{system.derating.wiringPct.toFixed(1)}%</Text>
                  </View>
                  <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.tableLabel, { fontWeight: "bold", color: C.heading }]}>Total System Derate (PR ~86%)</Text>
                    <Text style={[styles.tableVal, { color: C.primary }]}>-{system.derating.totalSystemLossPct.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Section 3: Equipment Bill of Materials */}
          <View style={styles.specBox}>
            <Text style={styles.cardTitle}>Tier-1 Equipment Specifications & BOS Architecture</Text>
            <View style={{ flexDirection: "row", gap: S.gap3 }}>
              <View style={{ flex: 1.2 }}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Photovoltaic Modules</Text>
                  <Text style={styles.specValue}>{system.panelModel} ({system.panelWattage}Wp Monocrystalline PERC)</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Mounting Structure & Hardware</Text>
                  <Text style={styles.specValue}>{system.mountingType}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Power Conditioning Unit (Inverter)</Text>
                  <Text style={styles.specValue}>{system.inverterModel}</Text>
                </View>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>Balance of System & Switchgear</Text>
                  <Text style={styles.specValue}>{system.bosComponents}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={report} pageNumber={4} />
      </View>
    </Page>
  );
}

export default SystemDesignPage;
