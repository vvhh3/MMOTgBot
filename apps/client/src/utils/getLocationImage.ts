const API_URL = "http://localhost:4000";

export function getLocationImage(fileName: string) {
  return `${API_URL}/location-images/${fileName}`;
}