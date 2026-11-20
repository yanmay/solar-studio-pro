/**
 * ReportFooter — Unified institutional footer component for all PDF pages.
 * Format: "Report #<id> · Generated <date> · Page X of 8"
 *
 * Rules: Flexbox only, JS StyleSheet objects, pure @react-pdf/renderer.
 */
import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { C, S, formatReportFooter } from "./tokens";
import { FONTS } from "./fonts";
import type { ReportData } from "./types";

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: S.gap2,
  },
  footerDark: {
    borderTopColor: "#262626",
  },
  footerText: {
    fontSize: S.xs,
    fontFamily: FONTS.mono,
  },
});

export interface ReportFooterProps {
  report: ReportData;
  pageNumber: number;
  dark?: boolean;
}

export function ReportFooter({ report, pageNumber, dark = false }: ReportFooterProps) {
  const textColor = dark ? "#737373" : C.muted;
  const footerString = formatReportFooter(report.reportId, report.generatedAt, pageNumber);

  return (
    <View style={[styles.footer, dark ? styles.footerDark : {}]}>
      <Text style={[styles.footerText, { color: textColor }]}>
        {footerString}
      </Text>
    </View>
  );
}

export default ReportFooter;
