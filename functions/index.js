const functions = require('firebase-functions')
const { BigQuery } = require('@google-cloud/bigquery')
const useCrawling = require('./crawling')

exports.crwalOneplusDeal = functions
  .region('asia-northeast3')
  .runWith({ timeoutSeconds: 540, memory: '4GB' })
  .https.onRequest(async (request, response) => {
    const bigQuery = new BigQuery({ projectId: 'tad-story' })
    const { openConnection, closeConnection, crwal } = useCrawling()
    const { browser, page } = await openConnection()

    try {
      const data = await crwal(browser, page)
      const schema = {
        fields: [
          { name: 'title', type: 'STRING' },
          { name: 'price', type: 'INTEGER' },
          { name: 'link', type: 'STRING' },
          { name: 'order_count', type: 'INTEGER' },
          { name: 'end_at', type: 'STRING' },
          { name: 'company', type: 'STRING' },
          { name: 'is_new', type: 'STRING' },
          { name: 'created_at', type: 'INTEGER' },
        ],
      }

      const result = await bigQuery
        .dataset(process.env.DATA_SET)
        .table(process.env.TABLE)
        .insert(data, { schema })
        .catch((err) => {
          console.error('ERROR:', err)
        })

      response.status(201).send(result)
    } catch (error) {
      response.status(500).send(error)
    } finally {
      await closeConnection(page, browser)
    }
  })
