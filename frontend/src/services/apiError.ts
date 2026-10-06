import axios from 'axios'

interface ValidationErrorResponse {
  message?: string
  errors?: Record<string, string[]>
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ValidationErrorResponse>(error)) {
    const response = error.response?.data

    if (response?.errors) {
      const firstError = Object.values(response.errors).flat()[0]
      if (firstError) return firstError
    }

    if (response?.message) return response.message
    return 'Unable to reach BookEase. Check your connection and try again.'
  }

  return 'Something went wrong. Please try again.'
}
