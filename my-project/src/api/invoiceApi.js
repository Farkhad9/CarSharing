import { apiDownload, apiOpenPdf, apiRequest } from "./apiClient";

export const invoiceApi = {
  getMyInvoices: () => apiRequest("/api/invoices/my"),
  getAdminInvoices: () => apiRequest("/api/admin/invoices"),
  getAdminPricingBreakdown: (invoiceId) => apiRequest(`/api/admin/invoices/${invoiceId}/pricing-breakdown`),
  downloadMyReceipt: (invoiceId, invoiceNumber = "receipt") =>
    apiDownload(`/api/invoices/${invoiceId}/pdf`, `${invoiceNumber}.pdf`),
  downloadAdminReceipt: (invoiceId, invoiceNumber = "receipt") =>
    apiDownload(`/api/admin/invoices/${invoiceId}/pdf`, `${invoiceNumber}.pdf`),
  openMyReceipt: (invoiceId) => apiOpenPdf(`/api/invoices/${invoiceId}/pdf`),
  openAdminReceipt: (invoiceId) => apiOpenPdf(`/api/admin/invoices/${invoiceId}/pdf`),
};
