'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

const PREDEFINED_ROLES = [
  'AI Automation',
  'Video Editing',
  'Appointment Setting',
  'Social Media',
  'Virtual Assistant',
  'Tech Operations',
  'Software Development',
  'Data Entry',
  'Customer Support',
  'Sales',
  'Marketing',
  'Content Writing',
  'Design',
  'Project Management',
  'Consulting',
]

interface ParseResult {
  targetRoles: string[]
  coreSkills: string[]
  parsedResumeSummary: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [step, setStep] = useState(0)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [parsingStatus, setParsingStatus] = useState('')
  const [error, setError] = useState('')
  const [editableRoles, setEditableRoles] = useState<string[]>([])
  const [editableSkills, setEditableSkills] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    }
  }, [isLoaded, user, router])

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile)
      setError('')
    } else {
      setError('Please upload a PDF file')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile)
        setError('')
      } else {
        setError('Please upload a PDF file')
      }
    }
  }

  const handleNextStep = () => {
    if (step === 0) {
      if (selectedRoles.length === 0) {
        setError('Select at least one role or skip to upload your resume')
        return
      }
    }
    setError('')
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setError('')
    setParsingStatus('Uploading resume...')

    try {
      const formData = new FormData()
      formData.append('resume', file)
      formData.append('fileName', file.name)
      if (selectedRoles.length > 0) {
        formData.append('targetRoles', JSON.stringify(selectedRoles))
      }

      setParsingStatus('Analyzing with AI...')

      const res = await fetch('/api/onboarding/parse-resume', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse resume')
      }

      setParsingStatus('Finalizing your profile...')

      const prefs = data.preferences
      setParseResult(prefs)
      setEditableRoles(prefs.targetRoles || [])
      setEditableSkills(prefs.coreSkills || [])

      setTimeout(() => {
        setParsing(false)
        setStep(3)
      }, 400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setParsing(false)
    }
  }

  const handleFinish = () => {
    router.push('/')
  }

  const addRole = (role: string) => {
    if (!editableRoles.includes(role)) {
      setEditableRoles([...editableRoles, role])
    }
  }

  const removeRole = (role: string) => {
    setEditableRoles(editableRoles.filter((r) => r !== role))
  }

  const addSkill = () => {
    const skill = prompt('Enter a skill:')
    if (skill && skill.trim() && !editableSkills.includes(skill.trim())) {
      setEditableSkills([...editableSkills, skill.trim()])
    }
  }

  const removeSkill = (skill: string) => {
    setEditableSkills(editableSkills.filter((s) => s !== skill))
  }

  const handleSaveAndContinue = async () => {
    setParsing(true)
    try {
      const res = await fetch('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoles: editableRoles,
          coreSkills: editableSkills,
          parsedResumeSummary: parseResult?.parsedResumeSummary || '',
          setupComplete: true,
        }),
      })

      if (!res.ok) throw new Error('Failed to save')

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setParsing(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 mb-3">
            AF
          </div>
          <h1 className="text-2xl font-bold text-white">Set Up Your Profile</h1>
          <p className="text-sm text-slate-400 mt-1">
            Help us tailor your job feed to your unique skills
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  i === step
                    ? 'bg-indigo-500 text-white'
                    : i < step
                      ? 'bg-indigo-500/30 text-indigo-300'
                      : 'bg-slate-800 text-slate-500'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`w-8 h-0.5 transition ${
                    i < step ? 'bg-indigo-500' : 'bg-slate-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl shadow-indigo-500/5">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  What roles are you targeting?
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Select all that apply to your profile
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PREDEFINED_ROLES.map((role) => {
                  const isSelected = selectedRoles.includes(role)
                  return (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium transition border ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300 shadow-sm shadow-indigo-500/10'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="mr-1.5 text-indigo-400">✓</span>
                      )}
                      {role}
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => {
                    setSelectedRoles([])
                    setStep(1)
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  Skip, I'll upload my resume
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={selectedRoles.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold transition"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Upload Your Resume
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  We'll parse it with AI to auto-detect your skills and target roles
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : file
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {file ? (
                  <div className="space-y-2">
                    <div className="text-3xl">📄</div>
                    <p className="text-sm font-medium text-emerald-300">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-3xl text-slate-600">📄</div>
                    <p className="text-sm text-slate-400">
                      Drop your resume PDF here, or click to browse
                    </p>
                    <p className="text-xs text-slate-600">
                      PDF format only, max 10MB
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(0)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  ← Back to roles
                </button>
                <button
                  onClick={() => {
                    if (file) {
                      handleParse()
                    } else {
                      setError('Please upload a resume file')
                    }
                  }}
                  disabled={!file}
                  className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold transition"
                >
                  Analyze My Resume
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 py-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg animate-pulse" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-indigo-300 animate-pulse">
                    {parsingStatus}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    This usually takes 10-20 seconds
                  </p>
                </div>
              </div>

              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-slate-800 rounded-lg w-3/4 mx-auto" />
                <div className="h-4 bg-slate-800 rounded-lg w-1/2 mx-auto" />
                <div className="flex gap-2 justify-center mt-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-8 w-20 bg-slate-800 rounded-xl"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && parseResult && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Review Your Profile
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Here's what we extracted. Edit if needed, then confirm.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Target Roles
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {editableRoles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium"
                      >
                        {role}
                        <button
                          onClick={() => removeRole(role)}
                          className="text-indigo-400 hover:text-rose-400 transition"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <select
                      onChange={(e) => {
                        if (e.target.value) addRole(e.target.value)
                        e.target.value = ''
                      }}
                      value=""
                      className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs"
                    >
                      <option value="">+ Add role</option>
                      {PREDEFINED_ROLES.filter(
                        (r) => !editableRoles.includes(r),
                      ).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Core Skills
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {editableSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="text-emerald-400 hover:text-rose-400 transition"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={addSkill}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-xs hover:text-slate-300 transition"
                    >
                      + Add skill
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                    Professional Summary
                  </label>
                  <textarea
                    value={parseResult.parsedResumeSummary}
                    onChange={(e) =>
                      setParseResult({
                        ...parseResult,
                        parsedResumeSummary: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSaveAndContinue}
                  disabled={parsing}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-xs font-semibold transition hover:scale-[1.02] shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {parsing ? 'Saving...' : 'Confirm & Start Browsing'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
