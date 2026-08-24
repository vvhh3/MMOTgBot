const API_URL = "https://mmotgbot-production.up.railway.app "

export function getLocationImage(fileName: string) {
  console.log(`${API_URL}/location-images/${fileName}`)
  return `${API_URL}/location-images/${fileName}`
}