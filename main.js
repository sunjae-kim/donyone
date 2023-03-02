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
        const endTimeText = x.querySelector('[class^="productCard_flag"]').textContent
        let endTime

        if (endTimeText.includes('종료')) {
          const endTimeInDay = parseInt(endTimeText.replace(/[^0-9]/g, ''))
          const today = new Date()
          endTime = new Date(today.setDate(today.getDate() + endTimeInDay))
          endTime = new Date(endTime.setHours(17)).toLocaleString()
        } else {
          // remained time
          const [hour, minute, second] = endTimeText.split(' ')[0].split(':')
          const today = new Date()
          endTime = new Date(today.setHours(today.getHours() + parseInt(hour, 10)))
          endTime = new Date(endTime.setMinutes(endTime.getMinutes() + parseInt(minute, 10)))
          endTime = new Date(endTime.setSeconds(endTime.getSeconds() + parseInt(second, 10))).toLocaleString()
        }

        return { title, price, link, orderCount, endTime }
      })
    })

    for (const product of products) {
      const { title, price, link, orderCount, endTime } = product
      productMap.set(title, { title, price, link, orderCount, endTime })
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
    product.isNew = reviewCount < 10 ? '신규' : '지속판매'

    await page.close()
  }

  // create output folder if not exists
  if (!fs.existsSync(path.join(__dirname, 'output'))) {
    fs.mkdirSync(path.join(__dirname, 'output'))
  }

  // format date as YYYY-MM-DD
  const today = new Date()
  const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
  fs.writeFileSync(path.join(__dirname, 'output', `${date}.json`), JSON.stringify(products, null, 2))

  // export products to csv file in output folder
  const csv = products
    .sort((a, b) => (a.company < b.company ? 1 : -1))
    .map((x) => {
      const { title, price, link, orderCount, company, isNew, endTime } = x
      return `${company},${title.replace(/,/g, ' ')},${price},${orderCount},${isNew},${endTime},${link}`
    })
  csv.unshift('브랜드,제품,가격,노출,기존판매,종료일,링크')
  fs.writeFileSync(path.join(__dirname, 'output', `${date}.csv`), '\uFEFF' + csv.join('\n'))

  await browser.close()
}

main()
