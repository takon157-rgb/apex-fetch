import fs from 'fs';
import path from 'path';

const jobStoragePath = path.join(process.cwd(), 'leads_storage.json');
const statusStoragePath = path.join(process.cwd(), 'scraper_status.json');
const settingsStoragePath = path.join(process.cwd(), 'settings.json');

export interface ScraperStatus {
  progress: number;
  status: string;
  active: boolean;
  updatedAt: string;
}

export interface PipelineSettings {
  careerProfile: string;
  targetUrls: string[];
  trendingTargets: string[];
  lastTrendDiscoveryAt?: string;
}

const defaultStatus: ScraperStatus = {
  progress: 0,
  status: 'Idle',
  active: false,
  updatedAt: new Date().toISOString(),
};

const defaultSettings: PipelineSettings = {
  careerProfile: '',
  targetUrls: [],
  trendingTargets: [],
  lastTrendDiscoveryAt: '',
};

const careerProfileStoragePath = path.join(process.cwd(), 'career_profile.json');

function ensureFile(filePath: string, payload: unknown) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}

export interface CareerProfile {
  name: string;
  email: string;
  resumeFileName: string;
  resumeBase64: string;
  resumeText: string;
}

export function getCareerProfile(): CareerProfile | null {
  ensureFile(careerProfileStoragePath, null);
  try {
    const rawData = fs.readFileSync(careerProfileStoragePath, 'utf8');
    return JSON.parse(rawData) || null;
  } catch (err) {
    console.error('[Career Profile] Failed to read profile file:', err);
    return null;
  }
}

export function saveCareerProfile(profile: CareerProfile): CareerProfile {
  try {
    fs.writeFileSync(careerProfileStoragePath, JSON.stringify(profile, null, 2), 'utf8');
    return profile;
  } catch (err) {
    console.error('[Career Profile] Failed to save profile:', err);
    return profile;
  }
}

export function readStoredJobs(): any[] {
  ensureFile(jobStoragePath, []);
  try {
    const rawData = fs.readFileSync(jobStoragePath, 'utf8');
    return JSON.parse(rawData) || [];
  } catch (err) {
    console.error('[Storage Error] Failed to parse jobs file:', err);
    return [];
  }
}

export function writeStoredJobs(jobs: any[]) {
  try {
    fs.writeFileSync(jobStoragePath, JSON.stringify(jobs, null, 2), 'utf8');
  } catch (err) {
    console.error('[Storage Error] Failed to write jobs file:', err);
  }
}

export function getJobs() {
  return readStoredJobs();
}

export function updateJobStatus(id: string, status: string) {
  const jobs = readStoredJobs();
  const updated = jobs.map((job) => {
    if (job.id === id) {
      return {
        ...job,
        status,
        deleted: status === 'deleted' || job.deleted,
        applied: status === 'applied' ? true : job.applied || false,
      };
    }
    return job;
  });
  writeStoredJobs(updated);
  return updated;
}

export function readScraperStatus(): ScraperStatus {
  ensureFile(statusStoragePath, defaultStatus);
  try {
    const rawData = fs.readFileSync(statusStoragePath, 'utf8');
    const parsed = JSON.parse(rawData);
    return { ...defaultStatus, ...parsed };
  } catch (err) {
    console.error('[Status Error] Failed to read status file:', err);
    return defaultStatus;
  }
}

export function writeScraperStatus(status: Partial<ScraperStatus>) {
  try {
    const current = readScraperStatus();
    const merged = {
      ...current,
      ...status,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(statusStoragePath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (err) {
    console.error('[Status Error] Failed to write status file:', err);
    return { ...defaultStatus, ...status };
  }
}

export function readPipelineSettings(): PipelineSettings {
  ensureFile(settingsStoragePath, defaultSettings);
  try {
    const rawData = fs.readFileSync(settingsStoragePath, 'utf8');
    const parsed = JSON.parse(rawData);
    return { ...defaultSettings, ...parsed };
  } catch (err) {
    console.error('[Settings Error] Failed to read settings file:', err);
    return defaultSettings;
  }
}

export function writePipelineSettings(settings: Partial<PipelineSettings>) {
  try {
    const current = readPipelineSettings();
    const merged = {
      ...current,
      ...settings,
      targetUrls: settings.targetUrls ?? current.targetUrls,
      trendingTargets: settings.trendingTargets ?? current.trendingTargets,
    };
    fs.writeFileSync(settingsStoragePath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (err) {
    console.error('[Settings Error] Failed to write settings file:', err);
    return readPipelineSettings();
  }
}

/**
 * Maintenance Tool: Limits file system overhead by preserving the 200 most recent opportunities
 */
export function purgeStaleJobHistoryLog() {
  try {
    if (!fs.existsSync(jobStoragePath)) return;
    
    const existingData = fs.readFileSync(jobStoragePath, 'utf8');
    const jobs = JSON.parse(existingData);
    
    if (Array.isArray(jobs) && jobs.length > 200) {
      // Sort with newest timestamps placed at the front of the array
      jobs.sort((a, b) => new Date(b.postedTime || 0).getTime() - new Date(a.postedTime || 0).getTime());
      
      const truncatedCollection = jobs.slice(0, 200);
      writeStoredJobs(truncatedCollection);
      console.log(`[DB Cleaner] Trimmed storage file down to current top 200 rows.`);
    }
  } catch (error) {
    console.error('[DB Maintenance Error] Failed to truncate old logs:', error);
  }
}

// ==================== LOCAL BUSINESS LEADS ====================

export interface LocalBusinessLead {
  id: string;
  businessName: string;
  niche: string;
  city: string;
  address: string;
  phoneNumber: string;
  rating: number;
  reviewCount: number;
  googleMapsUrl: string;
  opportunityScore: number;
  aiAnalysis: string;
  coldCallScript: string;
  emailPitch: string;
  status: 'New' | 'Contacted' | 'Interested' | 'Closed';
  createdAt: string;
}

const localLeadsStoragePath = path.join(process.cwd(), 'local_leads_storage.json');

export function readStoredLocalLeads(): LocalBusinessLead[] {
  ensureFile(localLeadsStoragePath, []);
  try {
    const rawData = fs.readFileSync(localLeadsStoragePath, 'utf8');
    return JSON.parse(rawData) || [];
  } catch (err) {
    console.error('[Local Leads Storage Error] Failed to parse leads file:', err);
    return [];
  }
}

export function writeStoredLocalLeads(leads: LocalBusinessLead[]) {
  try {
    fs.writeFileSync(localLeadsStoragePath, JSON.stringify(leads, null, 2), 'utf8');
  } catch (err) {
    console.error('[Local Leads Storage Error] Failed to write leads file:', err);
  }
}

export function getLocalLeads(): LocalBusinessLead[] {
  return readStoredLocalLeads();
}

export function addLocalLead(lead: LocalBusinessLead) {
  const leads = readStoredLocalLeads();
  // Check for duplicates
  const exists = leads.some(
    (l) => l.businessName.toLowerCase() === lead.businessName.toLowerCase() && 
           l.city.toLowerCase() === lead.city.toLowerCase()
  );
  if (exists) {
    console.log(`[Local Leads] Lead already exists: ${lead.businessName} in ${lead.city}`);
    return leads;
  }
  leads.push(lead);
  writeStoredLocalLeads(leads);
  return leads;
}

export function updateLocalLeadStatus(id: string, status: 'New' | 'Contacted' | 'Interested' | 'Closed') {
  const leads = readStoredLocalLeads();
  const updated = leads.map((lead) => {
    if (lead.id === id) {
      return { ...lead, status };
    }
    return lead;
  });
  writeStoredLocalLeads(updated);
  return updated;
}

export function updateLocalLead(id: string, updates: Partial<LocalBusinessLead>) {
  const leads = readStoredLocalLeads();
  const updated = leads.map((lead) => {
    if (lead.id === id) {
      return { ...lead, ...updates };
    }
    return lead;
  });
  writeStoredLocalLeads(updated);
  return updated;
}

// ==================== STORED LEADS ====================

const storedLeadsPath = path.join(process.cwd(), 'stored_leads.json');

export interface StoredLead {
  id: string;
  businessName: string;
  phoneNumber: string;
  strategy: string;
  niche: string;
  city: string;
  savedAt: string;
}

export function getStoredLeads(): StoredLead[] {
  ensureFile(storedLeadsPath, []);
  try {
    return JSON.parse(fs.readFileSync(storedLeadsPath, 'utf8')) || [];
  } catch {
    return [];
  }
}

export function saveStoredLead(lead: StoredLead) {
  const leads = getStoredLeads();
  const exists = leads.some(l => l.businessName.toLowerCase() === lead.businessName.toLowerCase());
  if (!exists) {
    leads.push(lead);
    fs.writeFileSync(storedLeadsPath, JSON.stringify(leads, null, 2), 'utf8');
  }
  return leads;
}

export function removeStoredLead(id: string) {
  const leads = getStoredLeads().filter(l => l.id !== id);
  fs.writeFileSync(storedLeadsPath, JSON.stringify(leads, null, 2), 'utf8');
  return leads;
}

// ==================== REVIEWED JOBS (for Profile workspace) ====================

const reviewedJobsPath = path.join(process.cwd(), 'reviewed_jobs.json');

export interface ReviewedJob {
  id: string;
  title: string;
  description: string;
  reviewedAt: string;
  tailoredResume?: string;
}

export function getReviewedJobs(): ReviewedJob[] {
  ensureFile(reviewedJobsPath, []);
  try {
    return JSON.parse(fs.readFileSync(reviewedJobsPath, 'utf8')) || [];
  } catch {
    return [];
  }
}

export function addReviewedJob(job: ReviewedJob) {
  const jobs = getReviewedJobs();
  const exists = jobs.some(j => j.id === job.id);
  if (!exists) {
    jobs.unshift(job);
    fs.writeFileSync(reviewedJobsPath, JSON.stringify(jobs, null, 2), 'utf8');
  }
  return jobs;
}

export function updateReviewedJob(id: string, updates: Partial<ReviewedJob>) {
  const jobs = getReviewedJobs().map(j => j.id === id ? { ...j, ...updates } : j);
  fs.writeFileSync(reviewedJobsPath, JSON.stringify(jobs, null, 2), 'utf8');
  return jobs;
}