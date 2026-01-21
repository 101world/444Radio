/**
 * Reusable API call helper for consistent error handling
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export async function apiCall<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('API call failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Specialized API call for endpoints that return { success: boolean, ... }
 */
export async function apiCallWithSuccess<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const result = await apiCall<T>(url, options)

  if (!result.success) {
    return result
  }

  // Check if the response has success field
  if (result.data && typeof result.data === 'object' && 'success' in result.data) {
    const apiData = result.data as any
    if (!apiData.success) {
      return {
        success: false,
        error: apiData.error || 'API returned success: false',
      }
    }
    return {
      success: true,
      data: apiData,
    }
  }

  return result
}