const puppeteer = require('puppeteer')

const useCrawling = () => {
  const openConnection = async () => {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      defaultViewport: { width: 1680, height: 1050 },
    })
    const page = await browser.newPage()
    return { browser, page }
  }

  const closeConnection = async (page, browser) => {
    page && (await page.close())
    browser && (await browser.close())
  }

  const crwal = async (browser, page) => {
    const targetUrl = 'https://plusdeal.naver.com/?sort=1&listType=&grpSeq=4'

    // Login
    const id = process.env.NAVER_ID
    const pw = process.env.NAVER_PW

    await page.goto('https://nid.naver.com/nidlogin.login?url=' + encodeURIComponent(targetUrl))
    await page.type('#id', id, { delay: 100 })
    await page.type('#pw', pw, { delay: 100 })
    await page.click('button[type=submit]')
    await page.waitForNavigation()

    // Navigate to the site
    await page.goto('https://plusdeal.naver.com/?sort=1&listType=&grpSeq=4')

    const productMap = new Map()
    while (!(await page.$('[class^="plusItemTitle"]'))) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight)
      })
      await page.waitForTimeout(1000)

      // Get the product cards on the page and add them to the pool
      const products = await page.$$eval('[class^="productCard_product"]', (elements) => {
        // plustem 제외
        const filteredElements = elements.filter((x) => !Array.from(x.classList).some((x) => x.includes('plustem')))

        const formatDate = (date) => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}/${month}/${day}`
        }

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
            const endTimeInDay = parseInt(endTimeText.replace(/[^0-9]/g, ''), 10)
            const today = new Date()
            endTime = new Date(today.setDate(today.getDate() + endTimeInDay))
            endTime = formatDate(endTime)
          } else {
            // remained time
            const [hour, minute, second] = endTimeText.split(' ')[0].split(':')
            const today = new Date()
            endTime = new Date(today.setHours(today.getHours() + parseInt(hour, 10)))
            endTime = new Date(endTime.setMinutes(endTime.getMinutes() + parseInt(minute, 10)))
            endTime = new Date(endTime.setSeconds(endTime.getSeconds() + parseInt(second, 10)))
            endTime = formatDate(endTime)
          }

          return { title, price, link, orderCount, endTime }
        })
      })

      for (const product of products) {
        const { title, price, link, orderCount, endTime } = product
        productMap.set(title, { title, price, link, order_count: orderCount, end_at: endTime })
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

      const reviewCountText = await page.$eval('a[class*="review"]', (element) => element.textContent)
      const reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, ''), 10)
      product.is_new = reviewCount < 30 ? '신규' : '지속판매'
      product.created_at = Date.now()

      await page.close()
    }

    return products
  }

  return {
    crwal,
    openConnection,
    closeConnection,
  }
}

module.exports = useCrawling
