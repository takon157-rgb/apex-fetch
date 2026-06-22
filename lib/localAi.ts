import { LocalBusinessData } from './localScraper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';

export interface AIAnalysisResult {
  opportunityScore: number; // 0-10 scale
  aiAnalysis: string;
  coldCallScript: string;
  emailPitch: string;
}

/**
 * Calculates opportunity score based on business metrics
 */
function calculateOpportunityScore(business: LocalBusinessData): number {
  let score = 5; // Base score

  // Higher review count = more established business = higher opportunity
  if (business.reviewCount > 50) score += 1.5;
  else if (business.reviewCount > 20) score += 1;
  else if (business.reviewCount > 0) score += 0.5;

  // Rating analysis
  if (business.rating >= 4.5) score += 1;
  else if (business.rating >= 4.0) score += 0.75;
  else if (business.rating >= 3.5) score += 0.5;
  else score -= 0.5; // Low rating = less likely to need help

  // No website = higher opportunity (they may benefit from digital services)
  score += 1.5;

  // Cap at 10
  return Math.min(score, 10);
}

/**
 * Generates AI-powered analysis, cold call script, and email pitch
 */
export async function analyzeBusinessWithAI(business: LocalBusinessData): Promise<AIAnalysisResult> {
  const opportunityScore = calculateOpportunityScore(business);
  
  const prompt = `You are an elite B2B lead generation specialist. Analyze this local business and generate tailored outreach materials.

Business Information:
- Name: ${business.name}
- Industry: ${business.niche}
- Location: ${business.address}, ${business.city}
- Phone: ${business.phone}
- Rating: ${business.rating}/5 (${business.reviewCount} reviews)
- Google Maps: ${business.mapsUrl}
- Website: ${business.website ? 'Yes' : 'NO - HIGH OPPORTUNITY'}

Generate:
1. ANALYSIS: 2-3 sentences about why this business is a good prospect
2. COLD CALL SCRIPT: A 30-second script that references their Google reviews
3. EMAIL PITCH: A punchy 3-4 sentence email subject + body that hooks them

Format your response as JSON with keys: "analysis", "coldCallScript", "emailPitch"`;

  try {
    const useGemini = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const useOpenAI = process.env.OPENAI_API_KEY;

    if (useGemini) {
      return await analyzeWithGemini(business, prompt, opportunityScore);
    } else if (useOpenAI) {
      return await analyzeWithOpenAI(business, prompt, opportunityScore);
    } else {
      // Fallback to template-based generation
      return generateTemplateAnalysis(business, opportunityScore);
    }
  } catch (error) {
    console.error('[AI Analysis] Error during analysis:', error);
    return generateTemplateAnalysis(business, opportunityScore);
  }
}

/**
 * Analyzes using Google Gemini API
 */
async function analyzeWithGemini(
  business: LocalBusinessData,
  prompt: string,
  opportunityScore: number
): Promise<AIAnalysisResult> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        opportunityScore,
        aiAnalysis: parsed.analysis || generateAnalysisText(business),
        coldCallScript: parsed.coldCallScript || generateColdCallScript(business),
        emailPitch: parsed.emailPitch || generateEmailPitch(business),
      };
    }
  } catch (e) {
    console.warn('[AI Analysis] Failed to parse Gemini response, using template');
  }

  return generateTemplateAnalysis(business, opportunityScore);
}

/**
 * Analyzes using OpenAI API
 */
async function analyzeWithOpenAI(
  business: LocalBusinessData,
  prompt: string,
  opportunityScore: number
): Promise<AIAnalysisResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content || '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        opportunityScore,
        aiAnalysis: parsed.analysis || generateAnalysisText(business),
        coldCallScript: parsed.coldCallScript || generateColdCallScript(business),
        emailPitch: parsed.emailPitch || generateEmailPitch(business),
      };
    }
  } catch (e) {
    console.warn('[AI Analysis] Failed to parse OpenAI response, using template');
  }

  return generateTemplateAnalysis(business, opportunityScore);
}

/**
 * Template-based analysis when AI APIs are unavailable
 */
function generateTemplateAnalysis(business: LocalBusinessData, opportunityScore: number): AIAnalysisResult {
  return {
    opportunityScore,
    aiAnalysis: generateAnalysisText(business),
    coldCallScript: generateColdCallScript(business),
    emailPitch: generateEmailPitch(business),
  };
}

/**
 * Generates analysis text
 */
function generateAnalysisText(business: LocalBusinessData): string {
  const noWebsite = !business.website || business.website.trim() === '';
  const weakWebPresence = business.rating < 4.0 ? 'low ratings' : 'room for online growth';
  
  return `${business.name} is a ${business.niche} business in ${business.city} with ${business.reviewCount} Google reviews and a ${business.rating}/5 rating. ${
    noWebsite 
      ? 'Critically, they have no website presence—a major digital gap.' 
      : 'They have ' + weakWebPresence + '.'
  } This represents a strong opportunity for digital transformation and lead generation services.`;
}

/**
 * Generates cold call script
 */
function generateColdCallScript(business: LocalBusinessData): string {
  return `Hi, this is [Your Name] with [Your Company]. I noticed ${business.name} has fantastic ${business.rating}-star ratings on Google from ${business.reviewCount} customers. 

Here's why I'm calling: Many local service businesses like yours are missing out on phone calls and online leads because they don't have a solid web presence. We help ${business.niche} businesses like you capture those inbound calls.

Quick question—are you getting all the leads you need right now, or is there room to grow?

[Listen → Move forward based on response]`;
}

/**
 * Generates email pitch
 */
function generateEmailPitch(business: LocalBusinessData): string {
  const ratingStr = business.rating > 4.2 ? '⭐ Impressive' : '📊 Strong';
  
  return `Subject: ${ratingStr} ${business.rating}★ Rating → Missing Out on Leads for ${business.name}?

Hi,

Your ${business.reviewCount} happy customers on Google gave you a ${business.rating}★ rating—that's exceptional. But here's the catch: without a strong online funnel, you're losing calls every single day.

We help local ${business.niche} businesses turn those great reviews into a steady stream of qualified leads. Most of your competitors are already doing this.

Quick call this week?

[Your Name]
[Your Company]`;
}
