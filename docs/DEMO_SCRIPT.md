# ReturnReady — 2:15 Demo Video Storyboard & Narration Script

**Target Duration:** ~2 minutes 15 seconds (must be under 3:00)  
**Format:** Live screen recording of the working ReturnReady application (`http://localhost:5173`) + voiceover narration.

---

## Pre-Recording Checklist

1. Ensure the Supabase migration [`supabase/migrations/20261023000001_returnready_schema.sql`](../supabase/migrations/20261023000001_returnready_schema.sql) has been applied on `https://returnready-sb.propixer.in`.
2. Start the app locally with `npm run dev` and open `http://localhost:5173` in a clean browser window at `1440×900` (or `1920×1080` at 110% zoom).
3. If you already used the session during testing, click **Reset sample data** and clear browser storage so you start on **Screen A (Entry)** for the recording.
4. Do not display `.env` contents, tokens, or unrelated personal browser tabs.

---

## Timed Narration & On-Screen Actions

### 0:00 – 0:15 | Problem & Entry Screen
- **On screen:** Start on **Screen A** (`Get your returns ready.`). Point the cursor briefly at the notice: `Alexa+ experience simulation · Sample data · No retailer connection`. Click **Try sample household**.
- **Voiceover:**
  > "Household returns rarely fail because we didn't want to return an item—they fail because a deadline slips by, a charging cable is left on a desk, or nobody knows who is taking the parcel. This is ReturnReady, an Alexa+ experience simulation built in Google Antigravity with React, TypeScript, and Supabase."

### 0:15 – 0:35 | Checking What Is Due This Week
- **On screen:** The main workspace (**Screen B**) loads with 5 sample purchases, summary cards, and the ReturnReady Assistant panel on the right. Click the suggested prompt or type: **`What needs returning this week?`**
- **Voiceover:**
  > "Clicking 'Try sample household' creates an isolated Supabase session and seeds five sample purchases in Indian Rupees. When I ask 'What needs returning this week?', ReturnReady filters to the inclusive seven-day deadline window in Asia/Kolkata—showing three items due soon, including the Wireless Headphones due tomorrow and the Running Shoes already Ready to drop off."

### 0:35 – 0:55 | Selecting an Item & Checking Missing Steps
- **On screen:** In the Assistant input, type or click **`Prepare the headphones`**, then ask **`What is missing?`**
- **Voiceover:**
  > "Next, I ask to 'Prepare the headphones' and follow up with 'What is missing?'. Because the assistant tracks the active item in context, it opens the Wireless Headphones detail view and reports that two of the four suggested packing steps—the charging cable and protective packaging—are still unchecked."

### 0:55 – 1:20 | Completing Checklist & Derived Ready State
- **On screen:** In the Wireless Headphones detail panel on the left, click **Charging cable** and **Protective packaging**. Point out the counter reaching `4 / 4 complete` and the status badge changing to **Ready to drop off**.
- **Voiceover:**
  > "As I check off the charging cable and protective packaging, each toggle persists to Supabase and increments the item's version. Once all four steps are checked, ReturnReady automatically derives the 'Ready to drop off' state—and if I uncheck a step, Ready disappears immediately."

### 1:20 – 1:40 | Confirmed Household Assignment
- **On screen:** In the Assistant panel, click or type **`Assign this to Priya`**. Highlight the confirmation card (`Assign Wireless Headphones to Priya?`), then click **Confirm**.
- **Voiceover:**
  > "Now I ask 'Assign this to Priya'. ReturnReady never mutates data without confirmation: it binds the pending action to the item ID, member ID, and expected version. When I click Confirm, it validates the version in PostgreSQL and records 'Assigned to Priya in ReturnReady'—without claiming to send external messages."

### 1:40 – 1:55 | Proving Persistence Across Refresh
- **On screen:** Click the browser **Reload / Refresh** button. Select **Wireless Headphones** again to show `4 / 4 complete`, `Ready to drop off`, and `Assigned owner: Priya`.
- **Voiceover:**
  > "When I refresh the browser, ReturnReady resumes the same authenticated Supabase session. The completed checklist, derived Ready status, and Priya's assignment are all persisted in PostgreSQL with Row Level Security isolating each visitor's workspace."

### 1:55 – 2:15 | Architecture & Truthful Wrap-Up
- **On screen:** Briefly show the **Mark dropped off** confirmation flow (or the repository structure in Antigravity with `supabase/migrations/20261023000001_returnready_schema.sql` and passing tests).
- **Voiceover:**
  > "ReturnReady is a rule-based Alexa+ experience simulation built in Google Antigravity with real Supabase Auth, RLS, and transactional SQL RPCs—without requiring a live Alexa device or retailer account integration. It helps households know what is due, prepare what is needed, and decide who will handle it."
