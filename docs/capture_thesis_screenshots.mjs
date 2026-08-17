import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'thesis_screenshots')
mkdirSync(OUT, { recursive: true })

const BASE = 'http://127.0.0.1:5173'
const EMAIL = 'admin@earas.edu'
const PASSWORD = 'Admin1234'

const STRONG_ANSWER = `Mitosis is when a cell divides into two identical daughter cells. Before this happens, the cell copies its DNA so both new cells get the same chromosomes. This is important because it lets the body grow and repair damaged tissue by replacing dead cells. In summary, mitosis keeps genetic information consistent while allowing organisms to grow and heal.`

const WEAK_ANSWER = `Mitosis is a type of cell division. It happens in the body.`

async function shot(page, name) {
  const path = join(OUT, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  console.log('saved', path)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(45000)
  page.setDefaultNavigationTimeout(45000)

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await shot(page, '01_landing')

  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await shot(page, '02_login')

  await page.fill('#email', EMAIL)
  await page.fill('#password', PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/app/, { timeout: 20000 })
  await page.waitForTimeout(1200)
  await shot(page, '03_dashboard')

  await page.goto(`${BASE}/app/questions`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await shot(page, '04_questions')

  await page.goto(`${BASE}/app/analysis`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.getByRole('tab', { name: /custom question/i }).click()
  await page.waitForTimeout(300)
  await page.fill('#questionText', 'Explain the process of mitosis and why it is important for living organisms.')
  await page.fill('#referenceAnswer', 'Mitosis is the process by which a single cell divides into two genetically identical daughter cells. It occurs in several phases: prophase, metaphase, anaphase, and telophase. Before division, the cell replicates its DNA so that each daughter cell receives a complete set of chromosomes. This process is important because it allows organisms to grow, replace damaged or dead cells, and maintain genetic consistency across cell generations.')
  await page.fill('#concepts', 'daughter cells, DNA replication, chromosomes, growth, cell repair')
  await page.fill('#studentAnswer', STRONG_ANSWER)
  await shot(page, '05_analysis_form')

  await page.getByRole('button', { name: /run analysis/i }).click()
  await page.waitForTimeout(8000)
  await shot(page, '06_analysis_result')

  const reasoningLink = page.getByRole('link', { name: /reasoning/i }).first()
  if (await reasoningLink.count()) {
    await reasoningLink.click()
    await page.waitForTimeout(1500)
  } else {
    await page.goto(`${BASE}/app/reasoning`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
  }
  await shot(page, '07_reasoning_engine')

  await page.goto(`${BASE}/app/compare`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const areas = page.locator('textarea')
  const areaCount = await areas.count()
  if (areaCount >= 2) {
    await areas.nth(areaCount - 2).fill(STRONG_ANSWER)
    await areas.nth(areaCount - 1).fill(WEAK_ANSWER)
  }
  const compareBtn = page.getByRole('button', { name: /compare/i })
  if (await compareBtn.count()) {
    await compareBtn.first().click()
    await page.waitForTimeout(8000)
  }
  await shot(page, '08_compare')

  await page.goto(`${BASE}/app/evaluation`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await shot(page, '09_evaluation')

  await page.goto(`${BASE}/app/annotation`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await shot(page, '10_annotation_lab')

  await page.goto(`${BASE}/app/reports`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await shot(page, '11_reports')

  await page.goto(`${BASE}/app/models`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await shot(page, '12_models')

  await browser.close()
  console.log('done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
