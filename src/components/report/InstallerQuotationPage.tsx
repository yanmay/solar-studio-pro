/**
 * Itemized Quotation & Implementation Roadmap — Page 8 of the PDF report.
 * Commercial EPC quotation, payment milestones, equipment warranties,
 * project commissioning schedule, and installer credential block.
 *
 * Rules: Flexbox only, JS StyleSheet objects, pure @react-pdf/renderer.
 */
import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { C, S, inrFmt } from "./tokens";
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
  placeholderBanner: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: S.r1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: S.gap3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderBannerText: {
    color: "#B45309",
    fontSize: 7.5,
    fontWeight: "bold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
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
  // Itemized Quote Table
  quoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginBottom: 2,
  },
  quoteRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  thCategory: { flex: 1.1, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase" },
  thItem: { flex: 2.5, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase" },
  thQty: { flex: 0.9, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase" },
  thRate: { flex: 1.0, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase", textAlign: "right" },
  thAmount: { flex: 1.1, color: C.muted, fontSize: 6.5, fontWeight: "bold", textTransform: "uppercase", textAlign: "right" },

  colCategory: { flex: 1.1, color: C.heading, fontSize: 7.0, fontWeight: "bold" },
  colItem: { flex: 2.5, color: C.heading, fontSize: 7.0 },
  colQty: { flex: 0.9, color: C.muted, fontSize: 6.5 },
  colRate: { flex: 1.0, color: C.muted, fontSize: 7.0, fontFamily: FONTS.mono, textAlign: "right" },
  colAmount: { flex: 1.1, color: C.heading, fontSize: 7.0, fontFamily: FONTS.mono, fontWeight: "bold", textAlign: "right" },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.5,
    paddingHorizontal: 6,
  },
  summaryLabel: {
    color: C.muted,
    fontSize: S.xs,
  },
  summaryVal: {
    color: C.heading,
    fontSize: S.xs,
    fontFamily: FONTS.mono,
    fontWeight: "bold",
  },
  netPayableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F2FBF7",
    borderTopWidth: 1,
    borderTopColor: `${C.secondary}60`,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginTop: 2,
  },
  netPayableLabel: {
    color: "#0B6645",
    fontSize: S.xs,
    fontWeight: "bold",
  },
  netPayableVal: {
    color: "#0B6645",
    fontSize: S.sm,
    fontFamily: FONTS.mono,
    fontWeight: "bold",
  },

  // Two column layout for Milestones & Warranties
  twoCol: {
    flexDirection: "row",
    gap: S.gap3,
    marginBottom: S.gap3,
  },
  col: {
    flex: 1,
  },
  miniTableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  miniTableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },

  // Milestones columns
  msStage: { flex: 2.0, color: C.heading, fontSize: 6.5, fontWeight: "bold" },
  msPct: { flex: 0.5, color: C.primary, fontSize: 6.5, fontFamily: FONTS.mono, fontWeight: "bold", textAlign: "center" },
  msAmt: { flex: 1.1, color: C.heading, fontSize: 6.5, fontFamily: FONTS.mono, fontWeight: "bold", textAlign: "right" },
  msTrigger: { color: C.muted, fontSize: 5.5, marginTop: 1 },

  // Warranties columns
  warItem: { flex: 1.2, color: C.heading, fontSize: 6.5, fontWeight: "bold" },
  warDur: { flex: 1.0, color: "#0B6645", fontSize: 6.5, fontWeight: "bold" },
  warCov: { flex: 2.0, color: C.muted, fontSize: 6.0 },

  // Timeline Step Cards
  timelineStrip: {
    flexDirection: "row",
    gap: S.gap2,
    marginTop: 3,
  },
  stepCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: 6,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  stepBadge: {
    backgroundColor: `${C.primary}15`,
    color: C.primary,
    fontSize: 6.5,
    fontWeight: "bold",
    fontFamily: FONTS.mono,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  stepDuration: {
    color: C.muted,
    fontSize: 6.0,
    fontFamily: FONTS.mono,
  },
  stepTitle: {
    color: C.heading,
    fontSize: 6.8,
    fontWeight: "bold",
    marginBottom: 2,
  },
  stepDesc: {
    color: C.muted,
    fontSize: 5.8,
    lineHeight: 1.3,
  },

  // Contact Block
  contactBlock: {
    backgroundColor: "#F9F9FB",
    borderRadius: S.r1,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.gap2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  installerName: {
    color: C.heading,
    fontSize: S.xs,
    fontWeight: "bold",
  },
  installerSub: {
    color: C.muted,
    fontSize: 6.5,
    marginTop: 1,
  },
  contactDetails: {
    alignItems: "flex-end",
  },
  contactText: {
    color: C.heading,
    fontSize: 6.8,
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

export interface InstallerQuotationPageProps {
  report?: ReportData;
  data?: ReportData;
}

export function InstallerQuotationPage({ report, data }: InstallerQuotationPageProps) {
  const r = report || data;
  if (!r) return null;
  const { quotation } = r;
  const installer = quotation.installerInfo;

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.topAccent} />

      <View style={styles.body}>
        <View>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Itemized Quotation & Implementation Roadmap</Text>
              <Text style={styles.headerMeta}>EPC Commercial Estimate, Milestone Schedule & Warranty Provisions</Text>
            </View>
            <Text style={styles.headerMeta}>PAGE 8</Text>
          </View>

          {/* Conditional Placeholder Banner */}
          {installer.isPlaceholder && (
            <View style={styles.placeholderBanner}>
              <Text style={styles.placeholderBannerText}>
                SAMPLE QUOTATION — Replace with your installer's quote before signing
              </Text>
            </View>
          )}

          {/* Section 1: Itemized Quote Table */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bill of Materials & Concessional Composite Pricing</Text>

            <View style={styles.quoteHeader}>
              <Text style={styles.thCategory}>Category</Text>
              <Text style={styles.thItem}>Equipment / Service Description</Text>
              <Text style={styles.thQty}>Quantity</Text>
              <Text style={styles.thRate}>Rate (₹)</Text>
              <Text style={styles.thAmount}>Amount (₹)</Text>
            </View>

            {(quotation.lineItems || []).map((item, idx) => (
              <View key={idx} style={styles.quoteRow}>
                <Text style={styles.colCategory}>{item.category}</Text>
                <Text style={styles.colItem}>{item.item}</Text>
                <Text style={styles.colQty}>{item.qty}</Text>
                <Text style={styles.colRate}>{inrFmt(item.rateInr)}</Text>
                <Text style={styles.colAmount}>{inrFmt(item.amountInr)}</Text>
              </View>
            ))}

            {/* Quote Totals */}
            <View style={{ marginTop: 4, paddingTop: 3, borderTopWidth: 0.5, borderTopColor: C.border }}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Gross Turn-Key Capex (All-inclusive)</Text>
                <Text style={styles.summaryVal}>₹{inrFmt(quotation.grossTotalInr)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: "#0B6645" }]}>Less: PM Surya Ghar Central Financial Assistance</Text>
                <Text style={[styles.summaryVal, { color: "#0B6645" }]}>-₹{inrFmt(quotation.subsidyDeductionInr)}</Text>
              </View>
              <View style={styles.netPayableRow}>
                <Text style={styles.netPayableLabel}>Net Customer Outlay (Payable)</Text>
                <Text style={styles.netPayableVal}>₹{inrFmt(quotation.netPayableInr)}</Text>
              </View>
            </View>
          </View>

          {/* Section 2: Payment Milestones & Warranties (Two Column) */}
          <View style={styles.twoCol}>
            {/* Left: Payment Milestones */}
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Project Payment Milestones</Text>
                <View style={styles.miniTableHeader}>
                  <Text style={{ flex: 2.0, color: C.muted, fontSize: 6.0, fontWeight: "bold" }}>STAGE & TRIGGER</Text>
                  <Text style={{ flex: 0.5, color: C.muted, fontSize: 6.0, fontWeight: "bold", textAlign: "center" }}>%</Text>
                  <Text style={{ flex: 1.1, color: C.muted, fontSize: 6.0, fontWeight: "bold", textAlign: "right" }}>AMOUNT</Text>
                </View>
                {(quotation.milestones || []).map((ms, idx) => (
                  <View key={idx} style={styles.miniTableRow}>
                    <View style={{ flex: 2.0 }}>
                      <Text style={styles.msStage}>{ms.stage}</Text>
                      <Text style={styles.msTrigger}>{ms.trigger}</Text>
                    </View>
                    <Text style={styles.msPct}>{ms.percentage}%</Text>
                    <Text style={styles.msAmt}>₹{inrFmt(ms.amountInr)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Right: Warranties */}
            <View style={styles.col}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Comprehensive Equipment Warranties</Text>
                <View style={styles.miniTableHeader}>
                  <Text style={{ flex: 1.2, color: C.muted, fontSize: 6.0, fontWeight: "bold" }}>COMPONENT</Text>
                  <Text style={{ flex: 1.0, color: C.muted, fontSize: 6.0, fontWeight: "bold" }}>DURATION</Text>
                  <Text style={{ flex: 2.0, color: C.muted, fontSize: 6.0, fontWeight: "bold" }}>TERMS</Text>
                </View>
                {(quotation.warranties || []).map((war, idx) => (
                  <View key={idx} style={styles.miniTableRow}>
                    <Text style={styles.warItem}>{war.item}</Text>
                    <Text style={styles.warDur}>{war.duration}</Text>
                    <Text style={styles.warCov}>{war.coverage}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Section 3: Next Steps Timeline */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Implementation Roadmap (Turn-Key Timeline)</Text>
            <View style={styles.timelineStrip}>
              {(quotation.nextSteps || []).map((step, idx) => (
                <View key={idx} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepBadge}>{step.stepNumber}</Text>
                    <Text style={styles.stepDuration}>{step.duration}</Text>
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.description}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Section 4: Certified Installer Contact Block */}
          <View style={styles.contactBlock}>
            <View>
              <Text style={styles.installerName}>{installer.name}</Text>
              {installer.isPlaceholder && (
                <Text style={[styles.installerSub, { color: C.primary, fontWeight: "bold" }]}>
                  SolarScan Partner Network (sample)
                </Text>
              )}
              <Text style={styles.installerSub}>{installer.certifications}</Text>
            </View>
            <View style={styles.contactDetails}>
              <Text style={styles.contactText}>Ph: {installer.contactPhone}</Text>
              <Text style={styles.contactText}>Email: {installer.contactEmail}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <ReportFooter report={r} pageNumber={8} />
      </View>
    </Page>
  );
}

export default InstallerQuotationPage;
