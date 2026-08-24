const API_URL = "https://mmotgbot-production.up.railway.app"

export function getLocationImage(fileName: string) {
  return `${API_URL}/location-images/${fileName}`
}