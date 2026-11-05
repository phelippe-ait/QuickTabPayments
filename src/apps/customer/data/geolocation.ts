export type CustomerLocation = {
  latitude: number
  longitude: number
}

export function requestCustomerLocation(): Promise<CustomerLocation> {
  if (!navigator.geolocation) {
    return Promise.reject(
      new Error("Location access is not available in this browser."),
    )
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error(
              "Allow location access in your browser settings to order from within 500 m of the restaurant.",
            ),
          )
        } else if (error.code === error.TIMEOUT) {
          reject(
            new Error("We couldn't get your location in time. Please try again."),
          )
        } else {
          reject(
            new Error("Your location is unavailable. Please try again nearby."),
          )
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
  })
}
