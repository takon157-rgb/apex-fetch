import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) {
    return NextResponse.json({ preferences: null })
  }

  const preferences = await prisma.userPreference.findUnique({
    where: { userId: user.id },
  })

  return NextResponse.json({ preferences })
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await request.json()
  const { targetRoles, coreSkills, parsedResumeSummary, setupComplete } = body

  const preferences = await prisma.userPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      targetRoles: targetRoles || [],
      coreSkills: coreSkills || [],
      parsedResumeSummary: parsedResumeSummary || null,
      setupComplete: setupComplete ?? false,
    },
    update: {
      ...(targetRoles !== undefined && { targetRoles }),
      ...(coreSkills !== undefined && { coreSkills }),
      ...(parsedResumeSummary !== undefined && { parsedResumeSummary }),
      ...(setupComplete !== undefined && { setupComplete }),
    },
  })

  return NextResponse.json({ success: true, preferences })
}
