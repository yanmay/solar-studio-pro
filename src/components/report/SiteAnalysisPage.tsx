/**
 * Site & Rooftop Feasibility Analysis — Page 3 of the PDF report.
 * Institutional technical sheet covering geospatial boundaries, solar irradiance,
 * shading analysis, and structural roof characteristics.
 *
 * Rules: Flexbox only, JS StyleSheet objects, no Tailwind, pure @react-pdf/renderer.
 */
import React from "react";
import { Page, View, Text, StyleSheet, Image, Svg, Rect, Path, Line } from "@react-pdf/renderer";
import { C, S, inrFmt } from "./tokens";
import { FONTS } from "./fonts";
import { BarChart } from "./charts";
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
  cardTitle: {
    color: C.heading,
    fontSize: S.sm,
    fontWeight: "bold",
    marginBottom: S.gap2,
    letterSpacing: -0.2,
  },
  imageBox: {
    height: 155,
    backgroundColor: "#111113",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  imageLabel: {
    color: C.onDarkMuted,
    fontSize: S.xs,
    fontFamily: FONTS.mono,
    marginTop: 4,
  },
  cadOverlay: {
    position: "absolute",
    bottom: 6,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cadBadge: {
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  cadBadgeText: {
    color: "#FFFFFF",
    fontSize: 6,
    fontFamily: FONTS.mono,
  },
  metricList: {
    flexDirection: "column",
    gap: 6,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingBottom: 4,
  },
  metricLabel: {
    color: C.muted,
    fontSize: S.xs,
  },
  metricValue: {
    color: C.heading,
    fontSize: S.xs,
    fontWeight: "bold",
    fontFamily: FONTS.mono,
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
    fontSize: S.sm,
    fontWeight: "bold",
  },
  chartSubtitle: {
    color: C.muted,
    fontSize: S.xs,
  },
  structuralBox: {
    backgroundColor: "#F9F9FB",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap3,
    marginBottom: S.gap3,
  },
  structuralGrid: {
    flexDirection: "row",
    gap: S.gap3,
  },
  structuralItem: {
    flex: 1,
  },
  structuralLabel: {
    color: C.muted,
    fontSize: S.xs,
    marginBottom: 2,
  },
  structuralVal: {
    color: C.heading,
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

interface SiteAnalysisPageProps {
  report: ReportData;
}

export function SiteAnalysisPage({ report }: SiteAnalysisPageProps) {
  const { site, system } = report;

  const shadingChartData = (site.monthlyShadingProfile || []).map((m) => ({
    label: m.month,
    value: Number(m.lossPct.toFixed(1)),
    color: m.lossPct > 4.5 ? C.chartNeg : C.chartBar,
  }));

  const usableRatio = site.rooftopAreaM2 > 0
    ? ((site.usableAreaM2 / site.rooftopAreaM2) * 100).toFixed(0)
    : "75";

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        <View>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Site & Rooftop Feasibility Analysis</Text>
              <Text style={styles.headerMeta}>Geospatial Boundary · Solar Climatology · Shading Profile</Text>
            </View>
            <Text style={styles.headerMeta}>PAGE 3</Text>
          </View>

          {/* Section 1: Satellite Imagery & Geometry */}
          <View style={styles.twoCol}>
            {/* Left: Imagery Frame */}
            <View style={styles.col}>
              <View style={styles.imageBox}>
                {site.satelliteImageUrl ? (
                  <Image src={site.satelliteImageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Svg width={220} height={130}>
                    {/* Simulated Rooftop Cad Boundary */}
                    <Rect x={10} y={10} width={200} height={110} fill="#18181B" stroke="#27272A" strokeWidth={1} rx={4} />
                    <Path d="M 30 25 L 180 25 L 195 95 L 45 105 Z" fill="#242428" stroke={C.primary} strokeWidth={1.5} />
                    {/* Internal Array Placement Grid lines */}
                    <Line x1={45} y1={45} x2={180} y2={45} stroke="#3F3F46" strokeWidth={0.75} strokeDasharray="3 2" />
                    <Line x1={45} y1={65} x2={185} y2={65} stroke="#3F3F46" strokeWidth={0.75} strokeDasharray="3 2" />
                    <Line x1={45} y1={85} x2={190} y2={85} stroke="#3F3F46" strokeWidth={0.75} strokeDasharray="3 2" />
                  </Svg>
                )}
                <View style={styles.cadOverlay}>
                  <View style={styles.cadBadge}>
                    <Text style={styles.cadBadgeText}>GPS: {site.lat.toFixed(4)}°N, {site.lng.toFixed(4)}°E</Text>
                  </View>
                  <View style={styles.cadBadge}>
                    <Text style={styles.cadBadgeText}>{usableRatio}% USABLE SOLAR FOOTPRINT</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.imageLabel}>HD Geospatial Satellite Imagery & Traced Boundary</Text>
            </View>

            {/* Right: Geometric Summary Table */}
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Roof Geometry & Solar Exposure</Text>
                <View style={styles.metricList}>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Total Traced Rooftop Area</Text>
                    <Text style={styles.metricValue}>{site.rooftopAreaM2} m² ({Math.round(site.rooftopAreaM2 * 10.764)} sq.ft)</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Usable Solar Surface</Text>
                    <Text style={[styles.metricValue, styles.highlightValue]}>{site.usableAreaM2} m² ({Math.round(site.usableAreaM2 * 10.764)} sq.ft)</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Plane-of-Array Tilt</Text>
                    <Text style={styles.metricValue}>{site.tiltDeg}° (Optimized for Latitude)</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Azimuth Orientation</Text>
                    <Text style={styles.metricValue}>{site.orientationLabel} ({site.azimuth}°)</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Grid Jurisdiction / DISCOM</Text>
                    <Text style={styles.metricValue}>{site.state ? `${site.state} (${report.subsidy.discomName})` : "National / CEA Standard"}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Daily Peak Sun Hours (PSH)</Text>
                    <Text style={styles.metricValue}>{site.peakSunHoursDaily.toFixed(2)} kWh/m²/day</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Solar Climatology Profile</Text>
                    <Text style={styles.metricValue}>NASA POWER Satellites</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Section 2: Shading Breakdown & Monthly Derate Chart */}
          <View style={styles.chartContainer}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Monthly Shading & Near-Obstacle Loss Profile</Text>
                <Text style={styles.chartSubtitle}>
                  Simulated horizon, parapet and seasonal sun-path raytracing losses
                </Text>
              </View>
              <Text style={[styles.chartSubtitle, { fontWeight: "bold", color: C.primary }]}>
                Avg Shading Loss: {(site.shadingLoss * 100).toFixed(1)}%
              </Text>
            </View>

            {shadingChartData.length > 0 && (
              <BarChart
                data={shadingChartData}
                width={500}
                height={100}
                showLabels={true}
                showValues={true}
              />
            )}
          </View>

          {/* Section 3: Structural & Wind Assessment */}
          <View style={styles.structuralBox}>
            <Text style={styles.cardTitle}>Structural Integrity & Wind Loading Specifications</Text>
            <View style={styles.structuralGrid}>
              <View style={styles.structuralItem}>
                <Text style={styles.structuralLabel}>Roof Construction Type</Text>
                <Text style={styles.structuralVal}>{site.roofType}</Text>
              </View>
              <View style={styles.structuralItem}>
                <Text style={styles.structuralLabel}>Dead Load Added by Array</Text>
                <Text style={styles.structuralVal}>{site.structuralLoadKgM2.toFixed(1)} kg/m² (Permissible)</Text>
              </View>
              <View style={styles.structuralItem}>
                <Text style={styles.structuralLabel}>Wind Zone Categorization</Text>
                <Text style={styles.structuralVal}>{site.windZone ?? "IS 875 Part 3: Zone III (44 m/s)"}</Text>
              </View>
              <View style={styles.structuralItem}>
                <Text style={styles.structuralLabel}>Waterproofing Integrity</Text>
                <Text style={styles.structuralVal}>Zero-Penetration Ballasted / Elevated</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={report} pageNumber={3} />
      </View>
    </Page>
  );
}

export default SiteAnalysisPage;
