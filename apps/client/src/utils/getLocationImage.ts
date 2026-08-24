const API_URL = import.meta.env.CLIENT_URL ?? ""

export function getLocationImage(fileName: string) {
  console.log(`${API_URL}/location-images/${fileName}`)
  return `${API_URL}/location-images/${fileName}`
}