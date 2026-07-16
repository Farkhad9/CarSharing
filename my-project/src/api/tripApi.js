import { apiRequest } from "./apiClient";

const appendPhoto = async (formData, fieldName, photo) => {
  if (!photo) return;

  if (photo.file) {
    formData.append(fieldName, photo.file, photo.file.name);
    return;
  }

  if (photo.dataUrl) {
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    formData.append(fieldName, blob, photo.name || `${fieldName}.jpg`);
  }
};

export const tripApi = {
  start: (reservationId) => apiRequest("/api/trips/start", {
    method: "POST",
    body: JSON.stringify({ reservationId }),
  }),
  getMyActive: () => apiRequest("/api/trips/my/active"),
  getById: (id) => apiRequest(`/api/trips/${id}`),
  submitCompletion: async (tripId, photos) => {
    const formData = new FormData();
    await appendPhoto(formData, "FrontPhoto", photos.front);
    await appendPhoto(formData, "RearPhoto", photos.rear);
    await appendPhoto(formData, "LeftPhoto", photos.left);
    await appendPhoto(formData, "RightPhoto", photos.right);

    return apiRequest(`/api/trips/${tripId}/completion-requests`, {
      method: "POST",
      body: formData,
      headers: {},
    });
  },
};
