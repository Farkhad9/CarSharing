import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { API_URL, getAccessToken } from "./apiClient";

export const REALTIME_EVENTS = {
  StaffTaskCreated: "StaffTaskCreated",
  StaffTaskUpdated: "StaffTaskUpdated",
  AdminUserChanged: "AdminUserChanged",
  AdminDataChanged: "AdminDataChanged",
};

export const createOperationsConnection = () =>
  new HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/operations`, {
      accessTokenFactory: () => getAccessToken() || "",
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.None)
    .build();

export const startConnection = async (connection) => {
  if (connection.state !== HubConnectionState.Disconnected) return;
  await connection.start();
};

export const stopConnection = async (connection) => {
  if (connection.state === HubConnectionState.Disconnected) return;
  await connection.stop();
};
