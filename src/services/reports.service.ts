const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const AUTH_TOKEN_KEY = 'earas-token'

function getToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

async function downloadBlob(
  path: string,
  filename: string,
  method: 'GET' | 'POST' = 'GET',
): Promise<void> {
  const token = getToken()
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
  })

  if (!response.ok) {
    let message = 'Failed to download report'
    try {
      const body = await response.json()
      message = body.message ?? message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const reportsService = {
  downloadMarkdown: (id: string) =>
    downloadBlob(`/reports/${id}/markdown`, `earas-report-${id}.md`),
  downloadPdf: (id: string) =>
    downloadBlob(`/reports/${id}/pdf`, `earas-report-${id}.pdf`, 'POST'),
}
