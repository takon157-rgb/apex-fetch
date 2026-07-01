'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function OnboardingPopup() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      setChecking(false)
      return
    }

    async function checkOnboarding() {
      try {
        const res = await fetch('/api/user-preferences')
        if (res.ok) {
          const data = await res.json()
          if (!data.preferences?.setupComplete) {
            router.push('/onboarding')
            return
          }
        }
      } catch {
        // allows offline dev
      }
      setChecking(false)
    }
    checkOnboarding()
  }, [isLoaded, user, router])

  if (checking) return null

  return null
}
