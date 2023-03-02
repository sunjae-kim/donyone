const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

const main = async () => {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1366, height: 768 },
    args: ['--start-maximized'],
  })
  const page = await browser.newPage()
  const productMap = new Map()

  // Navigate to the site
  await page.goto('https://plusdeal.naver.com/?sort=1&listType=&grpSeq=4')

  const plusItemTitleSelector = '[class^="plusItemTitle"]'

  while (!(await page.$(plusItemTitleSelector))) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight)
    })
    await page.waitForTimeout(1000)

    // Get the product cards on the page and add them to the pool
    const products = await page.$$eval('[class^="productCard_product"]', (elements) => {
      // plustem 제외
      const filteredElements = elements.filter((x) => !Array.from(x.classList).some((x) => x.includes('plustem')))

      return filteredElements.map((x) => {
        const title = x.querySelector('[class^="productCard_title"]').textContent
        const priceText = x.querySelector('[class^="productCard_number"]').textContent
        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10)
        const orderCountText = x.querySelector('[class^="productCard_order"]').textContent
        const orderCount = parseInt(orderCountText.replace(/[^0-9]/g, ''), 10)
        const link = x.querySelector('[class^="productCard_link"]').href
        return { title, price, link, orderCount }
      })
    })

    for (const product of products) {
      const { title, price, link, orderCount } = product
      productMap.set(title, { title, price, link, orderCount })
    }
  }

  const products = Array.from(productMap.values())

  for (const product of products) {
    const { link } = product
    const page = await browser.newPage()
    await page.goto(link)

    await page.waitForSelector('.etc td')
    const company = await page.$eval('.etc td', (element) => element.textContent)
    product.company = company

    // Select li which class contains 'review'
    const reviewCountText = await page.$eval('a[class*="review"]', (element) => element.textContent)
    const reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, ''), 10)
    product.isNew = reviewCount < 10

    await page.close()
  }

  // format date as YYYY-MM-DD
  const today = new Date()
  const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
  fs.writeFileSync(path.join(__dirname, 'output', `${date}.json`), JSON.stringify(products, null, 2))

  // export products to csv file in output folder
  const csv = products
    .sort((a, b) => (a.company < b.company ? 1 : -1))
    .map((x) => {
      const { title, price, link, orderCount, company, isNew } = x
      return `${company},${title},${price},${orderCount},${isNew},${link}`
    })
  csv.unshift('브랜드,제품,가격,노출,기존판매,링크')
  fs.writeFileSync(path.join(__dirname, 'output', `${date}.csv`), csv.join('\n'))

  await browser.close()
}

main()
