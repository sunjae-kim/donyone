const functions = require('firebase-functions')
const { BigQuery } = require('@google-cloud/bigquery')
const { OAuth2Client } = require('google-auth-library')
const useCrawling = require('./crawling')
const client = new OAuth2Client(process.env.CLIENT_ID)

exports.crwalOneplusDeal = functions
  .region('asia-northeast3')
  .runWith({ timeoutSeconds: 540, memory: '4GB' })
  .https.onRequest(async (request, response) => {
    try {
      if (request.method !== 'POST') {
        console.error('not post method')
        return response.status(400)
      }

      const token = request.headers.authorization?.split('Bearer ')[1]
      if (!token) {
        console.error('no token found')
        return response.status(401)
      }

      const uid = await verify(token)

      if (!uid) {
        console.err('no uid found')
        return response.status(401)
      }
    } catch (error) {
      console.error(error)
      return response.status(500)
    }

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

      await bigQuery
        .dataset(process.env.DATA_SET)
        .table(process.env.TABLE)
        .insert(data, { schema })
        .catch((err) => {
          console.error('ERROR:', err)
        })

      response.status(201)
    } catch (error) {
      response.status(500)
    } finally {
      await closeConnection(page, browser)
    }
  })

async function verify(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.CLIENT_ID,
  })
  const payload = ticket.getPayload()
  const userid = payload['sub']
  return userid
}
