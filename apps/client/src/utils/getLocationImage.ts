const API_URL = import.meta.env.VITE_API_BASE_URL 

export function getLocationImage(fileName: string) {
  return `${API_URL}/location-images/${fileName}`
}