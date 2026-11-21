/**
 * PDFReport — Root Document component for @react-pdf/renderer.
 * Complete 8-Page Institutional Rooftop Solar Feasibility & Financial Assessment Prospectus.
 */
import React from "react";
import { Document } from "@react-pdf/renderer";
import "./fonts";
import { CoverPage } from "./CoverPage";
import { ExecutiveSummaryPage } from "./ExecutiveSummaryPage";
import { SiteAnalysisPage } from "./SiteAnalysisPage";
import { SystemDesignPage } from "./SystemDesignPage";
import { FinancialAnalysisPage } from "./FinancialAnalysisPage";
import { BalanceSheetPage } from "./BalanceSheetPage";
import { SubsidyCompliancePage } from "./SubsidyCompliancePage";
import { InstallerQuotationPage } from "./InstallerQuotationPage";
import type { ReportData } from "./types";

export interface PDFReportProps {
  report: ReportData;
}

export function PDFReport({ report }: PDFReportProps) {
  const address = report.site?.address ?? "Site";
  const state = report.site?.state ?? "India";

  return (
    <Document
      title={`Solar Feasibility Report — ${address}`}
      author="SolarScan AI"
      subject="Rooftop Solar Feasibility & Financial Assessment Prospectus"
      keywords={`solar, feasibility, PM Surya Ghar, ${state}`}
      creator="SolarScan AI"
      producer="SolarScan AI"
      language="en-IN"
    >
      <CoverPage report={report} />
      <ExecutiveSummaryPage report={report} />
      <SiteAnalysisPage report={report} />
      <SystemDesignPage report={report} />
      <FinancialAnalysisPage report={report} />
      <BalanceSheetPage report={report} />
      <SubsidyCompliancePage report={report} />
      <InstallerQuotationPage report={report} />
    </Document>
  );
}

export default PDFReport;
