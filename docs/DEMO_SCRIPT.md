# ReturnReady — 2:15 Demo Video Storyboard & Narration Script

> **App Developed by:** Ritesh Kochar for **Build, Ship, Shape: Amazon Developer Hackathon** on Oct 23, 2026  
> **Official YouTube Demo Video:** [https://youtu.be/GEOhZsTn5ME](https://youtu.be/GEOhZsTn5ME)  
> **Live Web App:** [https://returnready.ensure.in/](https://returnready.ensure.in/)  
> **GitHub Repository:** [https://github.com/ensuredesign/returnready](https://github.com/ensuredesign/returnready)

**Target Duration:** ~2 minutes 15 seconds (under the 3:00 Devpost limit)  
**Format:** Live screen recording (`1920×1080` Full HD) of the working ReturnReady application + voiceover narration.

---

## Watch the Official Demo Video

[![ReturnReady Demo Video Thumbnail](./images/01-hero-household-returns-organized.jpg)](https://youtu.be/GEOhZsTn5ME)

- **Direct YouTube Link:** [https://youtu.be/GEOhZsTn5ME](https://youtu.be/GEOhZsTn5ME)

---

## Pre-Recording Checklist

1. Ensure the Supabase migration [`supabase/migrations/20261023000001_returnready_schema.sql`](../supabase/migrations/20261023000001_returnready_schema.sql) has been applied on `https://returnready-sb.propixer.in`.
2. Open `https://returnready.ensure.in/` (or `http://localhost:5173` locally via `npm run dev`) in a clean browser window at `1920×1080`.
3. If you already used the session during testing, click **Reset sample data** and clear browser storage so you start on **Screen A (Entry)** for the recording.
4. Do not display `.env` contents, tokens, or unrelated personal browser tabs.

---

## Timed Narration & On-Screen Actions (With Visual Guides)

### 0:00 – 0:35 | Problem, Entry & Checking What Is Due This Week
- **On screen:** Start on **Screen A** (`Get your returns ready.`), click **Try sample household** to open **Screen B** with 5 sample INR purchases, summary cards, and the ReturnReady Assistant panel on the right. Ask: **`What needs returning this week?`**
- **Visual Reference:**
  ![From planning to drop-off](./images/02-planning-to-dropoff-status.jpg)
- **Voiceover:**
  > "Household returns rarely fail because we didn't want to return an item—they fail because a deadline slips by, a charging cable is left on a desk, or nobody knows who is taking the parcel. This is ReturnReady, an Alexa+ experience simulation built in Google Antigravity with React, TypeScript, and Supabase. Clicking 'Try sample household' creates an isolated Supabase session and seeds five sample purchases in Indian Rupees. When I ask 'What needs returning this week?', ReturnReady filters to the inclusive seven-day deadline window in Asia/Kolkata—showing three items due soon, including the Wireless Headphones due tomorrow and the Running Shoes already Ready to drop off."

### 0:35 – 1:20 | Selecting an Item, Checking Missing Steps & Derived Ready State
- **On screen:** In the Assistant input, type or click **`Prepare the headphones`**, then ask **`What is missing?`** Next, in the Wireless Headphones detail panel on the left, check off the remaining steps so the counter reaches `4 / 4 complete` and the status badge changes to **Ready to drop off**.
- **Visual Reference:**
  ![Know what is still missing](./images/03-know-what-is-missing-assistant.jpg)
- **Voiceover:**
  > "Next, I ask to 'Prepare the headphones' and follow up with 'What is missing?'. Because the assistant tracks the active item in context, it opens the Wireless Headphones detail view and reports which packing steps are still unchecked. As I check off the remaining steps, each toggle persists to Supabase and increments the item's version. Once all four steps are checked, ReturnReady automatically derives the 'Ready to drop off' state—and if I uncheck a step, Ready disappears immediately."

### 1:20 – 1:55 | Confirmed Household Assignment & Persistence Across Refresh
- **On screen:** In the Assistant panel, click or type **`Assign this to Priya`**. Highlight the confirmation card (`Assign Wireless Headphones to Priya?`), click **Confirm**, and then click the browser **Reload / Refresh** button to show `Ready to drop off` and `Assigned to Priya` persisted from Supabase PostgreSQL.
- **Visual Reference:**
  ![Pick up where you left off](./images/04-saved-progress-and-assignments.jpg)
- **Voiceover:**
  > "Now I ask 'Assign this to Priya'. ReturnReady never mutates data without confirmation: it binds the pending action to the item ID, member ID, and expected version. When I click Confirm, it validates the version in PostgreSQL and records 'Assigned to Priya in ReturnReady'. When I refresh the browser, ReturnReady resumes the same authenticated Supabase session—the completed checklist, derived Ready status, and Priya's assignment are all persisted in PostgreSQL with Row Level Security isolating each visitor's workspace."

### 1:55 – 2:15 | Architecture & Truthful Wrap-Up
- **On screen:** Show the **Mark dropped off** confirmation flow and the 6-step architecture overview.
- **Visual Reference:**
  ![Architecture and Return Flow](./images/05-architecture-and-return-flow.png)
- **Voiceover:**
  > "ReturnReady is a rule-based Alexa+ experience simulation built in Google Antigravity with real Supabase Auth, RLS, and transactional SQL RPCs—without requiring a live Alexa device or retailer account integration. It helps households know what is due, prepare what is needed, and decide who will handle it."

---

*App Developed by: Ritesh Kochar for Build, Ship, Shape: Amazon Developer Hackathon on Oct 23, 2026*
