import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { API_URL, apiRequest, getAccessToken } from "./apiClient";

export const SUPPORT_TICKET_CATEGORIES = {
  General: 1,
  VehicleAccess: 2,
  Billing: 3,
  VehicleCondition: 4,
  TripCompletion: 5,
  Account: 6,
};

export const SUPPORT_TICKET_PRIORITIES = {
  Low: 1,
  Normal: 2,
  High: 3,
  Urgent: 4,
};

export const SUPPORT_TICKET_STATUSES = {
  Open: 1,
  WaitingForStaff: 2,
  WaitingForRider: 3,
  EscalatedToAdmin: 4,
  Resolved: 5,
  Closed: 6,
};

export const SUPPORT_MESSAGE_SENDER_TYPES = {
  Rider: 1,
  Staff: 2,
  Admin: 3,
  SuperAdmin: 4,
  System: 5,
};

export const SUPPORT_REALTIME_EVENTS = {
  SupportTicketUpdated: "SupportTicketUpdated",
  SupportQueueChanged: "SupportQueueChanged",
  SupportTicketEscalated: "SupportTicketEscalated",
};

export const supportApi = {
  getMyTickets: () => apiRequest("/api/support/tickets/my"),
  createTicket: (payload) => apiRequest("/api/support/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  getTicket: (id) => apiRequest(`/api/support/tickets/${id}`),
  sendMessage: (id, payload) => apiRequest(`/api/support/tickets/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  closeTicket: (id) => apiRequest(`/api/support/tickets/${id}/close`, { method: "POST" }),
  reopenTicket: (id) => apiRequest(`/api/support/tickets/${id}/reopen`, { method: "POST" }),
};

export const staffSupportApi = {
  getTickets: () => apiRequest("/api/staff/support/tickets"),
  assignToMe: (id) => apiRequest(`/api/staff/support/tickets/${id}/assign-me`, { method: "POST" }),
  escalateToAdmin: (id) => apiRequest(`/api/staff/support/tickets/${id}/escalate`, { method: "POST" }),
  sendMessage: supportApi.sendMessage,
  closeTicket: supportApi.closeTicket,
  reopenTicket: supportApi.reopenTicket,
};

export const adminSupportApi = {
  getTickets: () => apiRequest("/api/admin/support/tickets"),
  assignStaff: (id, staffId) => apiRequest(`/api/admin/support/tickets/${id}/assignee`, {
    method: "PATCH",
    body: JSON.stringify({ staffId }),
  }),
  updatePriority: (id, priority) => apiRequest(`/api/admin/support/tickets/${id}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority }),
  }),
  sendMessage: supportApi.sendMessage,
  closeTicket: supportApi.closeTicket,
  reopenTicket: supportApi.reopenTicket,
};

export const createSupportConnection = () =>
  new HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/support`, {
      accessTokenFactory: () => getAccessToken() || "",
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.None)
    .build();

export const startSupportConnection = async (connection) => {
  if (connection.state !== HubConnectionState.Disconnected) return;
  await connection.start();
};

export const stopSupportConnection = async (connection) => {
  if (connection.state === HubConnectionState.Disconnected) return;
  await connection.stop();
};
