# Debugging "Could not parse AI response" Error

## Problem Summary

The error "Could not parse AI response. Try again." occurs when the AI model returns text that cannot be parsed as valid JSON, even though the system explicitly requests JSON format.

## Root Causes

1. **AI models don't always follow instructions**: Despite being told to return ONLY JSON, models often:
   - Wrap JSON in markdown code fences (```json ... ```)
   - Add explanatory text before/after the JSON
   - Return malformed JSON with syntax errors
   - Truncate responses when hitting token limits

2. **Free models are less reliable**: The app uses free OpenRouter models which may have:
   - Lower quality JSON generation
   - More hallucinations
   - Inconsistent instruction following

## What I Fixed

### 1. Enhanced JSON Parsing (`lib/ai/client.ts`)
- Added detailed console logging to show exactly what the AI returned
- Better error messages to help diagnose the issue
- The parser now logs:
  - The raw AI response (first 200 chars)
  - Whether it found JSON braces
  - Which parsing strategy succeeded or failed
  - The full response when parsing fails

### 2. Increased Token Limits (`app/api/chat/route.ts`)
- `analyze-resume`: 4000 → 6000 tokens
- `generate-ats-resume`: 6000 → 8000 tokens  
- `interview-prep`: 8000 → 10000 tokens
- This reduces truncation of long JSON responses

### 3. Stricter System Prompts (`app/api/chat/route.ts`)
- Added "CRITICAL INSTRUCTION" prefix to emphasize JSON-only output
- More explicit formatting: "starting with { and ending with }"
- Removed ambiguous language that might confuse the model

### 4. Better Error Messages (`app/analyze/page.tsx`)
- More helpful error messages suggesting to try again or switch models
- Added console logging of raw responses for debugging

## How to Debug Further

### Step 1: Check the Browser Console
1. Open your app in the browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to the Console tab
4. Try to analyze a resume again
5. Look for these log messages:
   - `Raw AI response for analysis:` - Shows what the AI actually returned
   - `extractJson: Attempting to parse:` - Shows the cleaned text
   - `extractJson: Failed to parse JSON from response` - Shows the full problematic response

### Step 2: Common Issues to Look For

**Issue: Response contains markdown fences**
```
Here's the analysis:
```json
{"overallScore": 75, ...}
```
Let me know if you need more help!
```
**Solution**: The parser removes ```json fences, but may struggle with extra text.

**Issue: Response is truncated**
```
{"overallScore": 75, "atsCompatibility": 80, "resumeQuality": 70, "keyw
```
**Solution**: Increase token limits or use a more capable model.

**Issue: Response has no JSON at all**
```
I'd be happy to help analyze your resume! Based on the job description...
```
**Solution**: The model is not following instructions. Try a different model.

**Issue: Malformed JSON**
```
{"overallScore": 75, "missingSkills": ["Python", "React",], "summary": "..."}
```
**Solution**: The parser handles trailing commas, but may fail on other syntax errors.

## Solutions & Recommendations

### Immediate Solutions

1. **Try a Different Model**
   - Go to Settings in your app
   - Change the OpenRouter model
   - Try models like:
     - `google/gemma-4-31b-it:free`
     - `meta-llama/llama-3.3-70b-instruct:free`
     - `deepseek/deepseek-chat-v3-0324:free`
   - Some models are better at following JSON-only instructions

2. **Simplify the Resume/Job Description**
   - Very long resumes may cause truncation
   - Try with a shorter resume first to test if parsing works
   - Reduce the job description length if it's very long

3. **Retry the Analysis**
   - Click "Re-analyze" button
   - AI models are non-deterministic - sometimes they comply, sometimes they don't

### Long-Term Solutions

1. **Add API Key Support**
   - Currently using free models which are less reliable
   - Consider adding support for paid models (GPT-4, Claude, etc.) which follow instructions better
   - Add your OpenRouter API key in `.env.local`:
     ```
     OPENROUTER_API_KEY=your_key_here
     ```

2. **Implement Retry Logic**
   - Automatically retry parsing with different prompts if it fails
   - Add a "retry with different model" button

3. **Add Response Validation**
   - Validate JSON structure before parsing
   - Provide more specific error messages about what's wrong

4. **Use Structured Outputs**
   - Some models support JSON mode or structured outputs
   - This enforces valid JSON responses

## Testing the Fix

To test if the fixes work:

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the app and navigate to the analyze page

3. Open the browser console (F12)

4. Try analyzing a resume

5. Check the console logs for:
   - The raw AI response
   - Whether parsing succeeded or failed
   - The specific error if it failed

## Example Console Output

### Successful Parse:
```
Raw AI response for analysis: {"overallScore":75,"atsCompatibility":80,...
extractJson: Attempting to parse: {"overallScore":75,"atsCompatibility":80,...
extractJson: Successfully parsed full JSON slice
```

### Failed Parse:
```
Raw AI response for analysis: I'd be happy to help! Here's the analysis:
extractJson: Attempting to parse: I'd be happy to help! Here's the analysis:
extractJson: No opening brace found in response
extractJson: Full response: I'd be happy to help! Here's the analysis:
```

## Need More Help?

If you're still experiencing issues:

1. Check the console logs and share what the AI is returning
2. Try multiple different models
3. Consider using a paid model for more reliable JSON generation
4. The free models on OpenRouter can be hit-or-miss with strict JSON formatting
