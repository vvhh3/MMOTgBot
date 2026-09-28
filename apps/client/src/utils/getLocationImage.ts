const API_URL = "https://server-production-e818.up.railway.app"

export function getLocationImage(fileName: string) {
  console.log("sdfdsfd",import.meta.env.VITE_API_BASE_URL )
  return `${API_URL}/location-images/${fileName}`
}
