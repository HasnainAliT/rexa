const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
const AUTH_TOKEN_KEY = 'earas-token'

function getToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

async function downloadResponse(
  path: string,
  filename: string,
  init: RequestInit,
): Promise<void> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = 'Failed to download report'
    try {
      const body = await response.json()
      message = body.message ?? body.detail ?? message
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

export type ClassReportExportRow = {
  student_name: string
  student_id: string
  class_name: string
  question: string
  role_coverage: number
  concept_coverage: number
  depth: number
  stars: number
  overall: number
  status: string
}

export const reportsService = {
  downloadMarkdown: (id: string) =>
    downloadResponse(`/reports/${id}/markdown`, `earas-report-${id}.md`, {
      method: 'GET',
    }),
  downloadPdf: (id: string) =>
    downloadResponse(`/reports/${id}/pdf`, `earas-report-${id}.pdf`, {
      method: 'POST',
    }),
  downloadClassXlsx: (rows: ClassReportExportRow[]) =>
    downloadResponse('/reports/class/xlsx', 'rexa-class-report.xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'RExA class report', rows }),
    }),
  downloadClassPdf: (rows: ClassReportExportRow[]) =>
    downloadResponse('/reports/class/pdf', 'rexa-class-report.pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'RExA class report', rows }),
    }),
}
