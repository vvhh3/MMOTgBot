const API_URL = "https://server-production-e818.up.railway.app"

export function getLocationImage(fileName: string) {
  return `${API_URL}/location-images/${fileName}`
}
