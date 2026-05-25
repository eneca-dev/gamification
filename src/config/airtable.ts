const BASE_URL = 'https://api.airtable.com/v0'
const BASE_ID = 'appKHrxgAJFFZeeQO'

function getApiKey(): string {
  const key = process.env.AIRTABLE_API_KEY
  if (!key) throw new Error('AIRTABLE_API_KEY is not set')
  return key
}

interface AirtableRecord<T = Record<string, unknown>> {
  id: string
  createdTime: string
  fields: T
}

interface AirtableCreateResponse<T = Record<string, unknown>> {
  records: AirtableRecord<T>[]
}

export async function airtableCreateRecord<T = Record<string, unknown>>(
  tableId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord<T>> {
  const response = await fetch(`${BASE_URL}/${BASE_ID}/${tableId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [{ fields }],
      typecast: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `Airtable API error ${response.status}: ${JSON.stringify(error)}`
    )
  }

  const data: AirtableCreateResponse<T> = await response.json()
  return data.records[0]
}
