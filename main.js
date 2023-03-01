const puppeteer = require('puppeteer')

const main = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 768 },
    args: ['--start-maximized'],
  })
  const page = await browser.newPage()

  // Navigate to the site
  await page.goto('https://plusdeal.naver.com/?sort=1&listType=&grpSeq=4')

  const plusItemTitleSelector = '[class^="plusItemTitle"]'

  while (!(await page.$(plusItemTitleSelector))) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight)
    })
    await page.waitForTimeout(1000)
  }

  // Get the product cards on the page and add them to the pool
  const products = await page.$$eval('[class^="productCard_product"]', (elements) => {
    // plustem 제외
    const filteredElements = elements.filter((x) => !Array.from(x.classList).some((x) => x.includes('plustem')))

    return filteredElements.map((x) => {
      const title = x.querySelector('[class^="productCard_title"]').textContent
      const priceText = x.querySelector('[class^="productCard_number"]').textContent
      const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10)
      const link = x.querySelector('[class^="productCard_link"]').href

      return { title, price, link }
    })
  })

  
  for (const product of products) {
    const {  link } = product
    const page = await browser.newPage()
    await page.goto(link)

    await page.waitForSelector('.etc td')
    const company = await page.$eval('.etc td', (element) => element.textContent)
    product.company = company

    await page.close()
  }

  console.log(products)
  

  await browser.close()
}

main()