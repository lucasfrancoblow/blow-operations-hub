// HTML -> PDF (1 página A4) com Chromium do Playwright.

import { chromium } from "playwright";

const A4_ALTURA_PX = 1123; // 297 mm a 96 dpi
const A4_LARGURA_PX = 794;

export async function htmlParaPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: A4_LARGURA_PX, height: A4_ALTURA_PX },
    });
    await page.setContent(html, { waitUntil: "load" });
    // A fonte vem do Google Fonts; se estiver fora do ar o CSS cai nas fontes do sistema.
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);
    // Garante 1 página: se o conteúdo passar da altura A4, reduz a escala proporcionalmente.
    const altura = await page.evaluate(() => document.body.scrollHeight);
    if (altura > A4_ALTURA_PX) {
      const zoom = (A4_ALTURA_PX - 2) / altura;
      await page.evaluate((z) => {
        (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = String(z);
      }, zoom);
    }
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      pageRanges: "1",
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
