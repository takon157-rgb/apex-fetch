import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getClient() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })
}

const BUCKET = 'resumes'

export async function ensureBucket() {
  const client = getClient()
  if (!client) return false
  const { data: buckets } = await client.storage.listBuckets()
  if (buckets?.find((b) => b.name === BUCKET)) return true
  const { error } = await client.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ['application/pdf'],
    fileSizeLimit: 10 * 1024 * 1024,
  })
  return !error
}

export async function uploadResume(
  userId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  await ensureBucket()
  const path = `${userId}/resume.pdf`
  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  })
  return error ? null : path
}

export async function downloadResume(
  userId: string,
): Promise<Buffer | null> {
  const client = getClient()
  if (!client) return null
  const path = `${userId}/resume.pdf`
  const { data, error } = await client.storage.from(BUCKET).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}
