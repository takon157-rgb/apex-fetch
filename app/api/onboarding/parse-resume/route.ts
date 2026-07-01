import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { uploadResume } from '@/lib/supabase-storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are an expert resume analyst and career coach. Analyze the provided resume PDF and extract structured information.

You MUST return ONLY valid JSON matching this exact schema:
{
  "targetRoles": ["string"],
  "coreSkills": ["string"],
  "summary": "string"
}

Rules:
- targetRoles: Identify 2-5 niche industry roles the candidate is best suited for. Match to categories like: AI Automation, Video Editing, Appointment Setting, Social Media, Virtual Assistant, Tech Operations, Software Development, Data Entry, Customer Support, Sales, Marketing, Content Writing, Design, Project Management, Consulting.
- coreSkills: Extract 5-15 specific technical and operational skills mentioned in the resume. Be specific (e.g., "Python" not just "programming", "Adobe Premiere Pro" not just "video editing").
- summary: Write a 2-3 sentence executive brief describing the candidate's professional profile, experience level, and career direction.

Do NOT include any text outside the JSON. Do NOT wrap in markdown fences.`

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: { code?: number; message?: string; status?: string }
}

interface ResumeParseResult {
  targetRoles: string[]
  coreSkills: string[]
  summary: string
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  const formData = await req.formData()
  const file = formData.get('resume') as File | null
  const base64Data = formData.get('resumeBase64') as string | null
  const fileName = formData.get('fileName') as string | null
  const targetRolesFromUI = formData.get('targetRoles') as string | null

  let pdfBase64: string
  let originalName = fileName || 'resume.pdf'

  if (file) {
    const bytes = await file.arrayBuffer()
    pdfBase64 = Buffer.from(bytes).toString('base64')
    originalName = file.name || originalName
  } else if (base64Data) {
    pdfBase64 = base64Data
  } else {
    return NextResponse.json({ error: 'No resume file provided' }, { status: 400 })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const geminiBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBase64,
            },
          },
          { text: SYSTEM_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(geminiBody),
  })

  const data: GeminiResponse = await response.json()

  if (!response.ok || data.error) {
    const message = data.error?.message || `HTTP ${response.status}`
    return NextResponse.json({ error: `Gemini API error: ${message}` }, { status: 502 })
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!rawText) {
    return NextResponse.json({ error: 'Gemini returned empty response' }, { status: 502 })
  }

  let parsed: ResumeParseResult
  try {
    parsed = JSON.parse(rawText) as ResumeParseResult
  } catch {
    const braceMatch = rawText.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try { parsed = JSON.parse(braceMatch[0]) as ResumeParseResult } catch {
        return NextResponse.json({ error: 'Failed to parse Gemini response as JSON' }, { status: 502 })
      }
    } else {
      return NextResponse.json({ error: 'Failed to parse Gemini response as JSON' }, { status: 502 })
    }
  }

  if (!Array.isArray(parsed.targetRoles)) parsed.targetRoles = []
  if (!Array.isArray(parsed.coreSkills)) parsed.coreSkills = []
  if (!parsed.summary) parsed.summary = ''

  const finalRoles = targetRolesFromUI
    ? JSON.parse(targetRolesFromUI)
    : parsed.targetRoles

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      targetRoles: finalRoles,
      coreSkills: parsed.coreSkills,
      parsedResumeSummary: parsed.summary,
      setupComplete: true,
    },
    update: {
      targetRoles: finalRoles,
      coreSkills: parsed.coreSkills,
      parsedResumeSummary: parsed.summary,
      setupComplete: true,
    },
  })

  const rawBuffer = Buffer.from(pdfBase64, 'base64')
  await prisma.careerProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      name: user.name || '',
      email: user.email || '',
      resumeFileName: originalName,
      resumeBase64: pdfBase64,
      resumeText: `[Parsed via Gemini - ${originalName}]`,
    },
    update: {
      resumeFileName: originalName,
      resumeBase64: pdfBase64,
      resumeText: `[Parsed via Gemini - ${originalName}]`,
    },
  })

  try {
    await uploadResume(user.id, rawBuffer, 'application/pdf')
  } catch {
    // silently skip if Supabase storage not configured
  }

  return NextResponse.json({
    success: true,
    preferences: {
      targetRoles: finalRoles,
      coreSkills: parsed.coreSkills,
      parsedResumeSummary: parsed.summary,
      setupComplete: true,
    },
  })
}
