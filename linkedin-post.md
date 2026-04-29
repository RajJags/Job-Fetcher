Built a Skills Intelligence feature for my job search tool. First version showed "gin" at 93% demand for AI Engineer roles.

The bug: plain substring matching. `"gin"` matched inside `"engineering"`. `"go"` matched inside `"go-to-market"`. `"ai"` matched every single job title.

Fixed it with word-boundary lookbehind/lookahead regex — short skills (≤3 chars) also block hyphen neighbours so "go" can't sneak through. Then added a canonical alias map so "ml" and "machine learning" merge into one signal instead of splitting it.

The feature now scans 800+ live listings with no location or experience filter — because job hunters need to see the real market, not a filtered slice of it. You get:

→ Which skills are must-have vs. nice-to-have (by actual listing frequency)
→ A warning if your target role has <8 active openings right now
→ Your personal skill gap scored against your resume

Most people pick skills to learn from blog posts. This pulls from live job descriptions.

Open source, India-focused, no paywalls: github.com/RajJags/Job-Fetcher

What role are you targeting right now?

#buildinpublic #jobsearch #typescript #nextjs
