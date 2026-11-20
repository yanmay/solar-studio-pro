/**
 * Cover page — Page 1 of the PDF report.
 * Dark brand background, logo text, address, generated date, key headline metric.
 *
 * Rules: Flexbox only, styles as JS objects, no Tailwind, no CSS grid.
 */
import React from "react";
import {
  Page, View, Text, Svg, Rect, Circle, Path,
  StyleSheet,
} from "@react-pdf/renderer";
import { C, S, inrLakhs } from "./tokens";
import { FONTS } from "./fonts";
import { ReportFooter } from "./ReportFooter";
import type { ReportData } from "./types";

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.dark,
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
    padding: S.pageH,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.gap2,
    marginBottom: S.gap8,
  },
  logoBox: {
    width: 32,
    height: 32,
    backgroundColor: C.primary,
    borderRadius: S.r2,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: C.onDark,
    fontSize: S.lg,
    fontWeight: "bold",
  },
  appName: {
    color: C.onDark,
    fontSize: S.lg,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  appSub: {
    color: C.onDarkMuted,
    fontSize: S.xs,
    letterSpacing: 1,
    marginTop: 1,
  },
  heroSection: {
    flexDirection: "column",
    gap: S.gap3,
  },
  badge: {
    backgroundColor: `${C.primary}22`,
    borderRadius: 20,
    paddingHorizontal: S.gap2,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: S.gap2,
  },
  badgeText: {
    color: C.primary,
    fontSize: S.xs,
    letterSpacing: 1.5,
    fontWeight: "bold",
  },
  heroTitle: {
    color: C.onDark,
    fontSize: S.h1,
    fontWeight: "bold",
    lineHeight: 1.2,
    maxWidth: 380,
  },
  heroHighlight: {
    color: C.primary,
  },
  address: {
    color: C.onDarkMuted,
    fontSize: S.base,
    marginTop: S.gap1,
    maxWidth: 340,
  },
  metricsRow: {
    flexDirection: "row",
    gap: S.gap4,
    marginTop: S.gap6,
    flexWrap: "wrap",
  },
  metricCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: S.r2,
    padding: S.gap3,
    minWidth: 100,
    flex: 1,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  metricLabel: {
    color: C.onDarkMuted,
    fontSize: S.xs,
    letterSpacing: 0.8,
    marginBottom: S.gap1,
  },
  metricValue: {
    color: C.onDark,
    fontSize: S.xl,
    fontWeight: "bold",
  },
  metricUnit: {
    color: C.secondary,
    fontSize: S.xs,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#1E1E1E",
    marginVertical: S.gap4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerLeft: {
    flexDirection: "column",
    gap: 2,
  },
  footerDate: {
    color: C.onDarkMuted,
    fontSize: S.xs,
  },
  footerNote: {
    color: "#444",
    fontSize: S.xs,
  },
  pageNum: {
    color: "#333",
    fontSize: S.xs,
  },
  accentBar: {
    width: 40,
    height: 3,
    backgroundColor: C.secondary,
    borderRadius: 2,
    marginBottom: S.gap2,
  },
});

interface CoverPageProps {
  report: ReportData;
}

export function CoverPage({ report }: CoverPageProps) {
  const { site, system, financial } = report;
  const dateStr = new Date(report.generatedAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <View>
            <Text style={styles.appName}>SolarScan AI</Text>
            <Text style={styles.appSub}>ROOFTOP SOLAR INTELLIGENCE</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SOLAR FEASIBILITY REPORT</Text>
          </View>
          <View style={styles.accentBar} />
          <Text style={styles.heroTitle}>
            Your roof can save{"\n"}
            <Text style={styles.heroHighlight}>{inrLakhs(financial.year1SavingInr)}</Text>
            {" "}every year.
          </Text>
          <Text style={styles.address}>{site.address}</Text>

          {/* Key metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>SYSTEM SIZE</Text>
              <Text style={styles.metricValue}>{system.installedKw.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>kWp installed</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>PAYBACK</Text>
              <Text style={styles.metricValue}>{financial.paybackPeriod.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>years to break-even</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>GOVT SUBSIDY</Text>
              <Text style={styles.metricValue}>
                {financial.subsidyInr > 0 ? inrLakhs(financial.subsidyInr) : "N/A"}
              </Text>
              <Text style={styles.metricUnit}>PM Surya Ghar</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>25-YR SAVINGS</Text>
              <Text style={styles.metricValue}>{inrLakhs(financial.savings25yrInr)}</Text>
              <Text style={styles.metricUnit}>cumulative</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={report} pageNumber={1} dark />
      </View>
    </Page>
  );
}
