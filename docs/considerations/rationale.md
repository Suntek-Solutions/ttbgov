# Decision Rationale

> **The ask:** "Could you read this entire spec and our new project we are doing in this repo. I want you to work with me and plan out the entire project, the document tracking for clarity (as noted in the criteria and requirements) and everything we will do to bring this project to completion so I can send over the final solution to the requesting party."

---

## How I Approached the Spec

The PDF is not a typical requirements document. It is four informal stakeholder interviews followed by a deliberately sparse "Technical Requirements" section that says almost nothing:

> "You are free to use any programming languages, frameworks, or libraries you prefer. We want to see what kind of engineering, design, and integration decisions you make."

That single sentence is the real test. The spec is designed to see whether a candidate can extract actionable requirements from conversational, sometimes contradictory human input -- and then make defensible engineering decisions on their own. The evaluation criteria reinforce this: "Attention to requirements" and "Creative problem-solving" are listed alongside code quality and correctness.

So the first thing I did was read every interview line by line and pull out every implicit requirement, constraint, preference, and warning. The plan was built from that extraction, not from the two-paragraph "Technical Requirements" section.

---

## Extracting Requirements from the Interviews

### Sarah Chen (Deputy Director of Label Compliance)

Sarah's interview contains the most requirements of any single source. Here is what I extracted:

| What she said | What it means for us |
|---|---|
| "150,000 label applications a year, 47 agents" | High volume. The tool must be fast and efficient, not a novelty demo. |
| "5-10 minutes per application for a simple one" | Even shaving 2 minutes off is significant at scale. The AI doesn't need to replace agents -- it needs to accelerate them. |
| "A lot of what we do is just... matching" | The core feature is comparison: extracted label text vs. application data. Field-by-field. This is the MVP. |
| "30, 40 seconds... Our agents just went back to doing it by eye" | **Hard constraint: results must return in ~5 seconds or the tool will be abandoned.** This is the single most important non-functional requirement in the entire spec. It eliminated slow cloud APIs, heavy ML models, and serverless cold starts from consideration. |
| "We need something my mother could figure out -- she's 73" | **UX must be dead simple.** Large buttons, obvious flow, no jargon, no hidden menus. Color-coded pass/fail. This is a government workforce where half the team is over 50. |
| "Big importers who dump 200, 300 label applications on us at once" | **Batch upload is a real need.** Not a "nice to have" -- Janet from Seattle has been asking for years. This became a dedicated page in the plan. |

### Marcus Williams (IT Systems Administrator)

Marcus gave the technical landscape. His interview shaped the architecture more than anyone else's:

| What he said | What it means for us |
|---|---|
| "We're on Azure now after the migration in 2019" | Their infrastructure is Azure. For a production version, Azure-native services would matter. For a prototype, this is context, not a constraint. |
| "Not looking to integrate with COLA directly" | **Standalone prototype.** No legacy system integration. This is freeing -- we can pick any stack. |
| "For a prototype? Just don't do anything crazy" | No over-engineering. No database, no auth, no user accounts. Keep it clean and focused. |
| "Our network blocks outbound traffic to a lot of domains" | **This is the firewall constraint.** The scanning vendor's cloud ML endpoints were blocked. Any solution that depends on calling OpenAI, Google Vision, or Azure AI during runtime would face this same problem in production. |
| "Half their features didn't work because our firewall blocked connections to their ML endpoints" | Reinforces the above. **The OCR/AI must run locally -- bundled with the app, no outbound API calls.** This single constraint eliminated the most popular approaches (GPT-4o Vision, Google Cloud Vision, Azure Document Intelligence) and led directly to dual local OCR (ONNX PaddleOCR + Tesseract.js). |

### Dave Morrison (Senior Compliance Agent, 28 years)

Dave is the skeptic. His interview reveals what will make or break adoption:

| What he said | What it means for us |
|---|---|
| "I've seen a lot of these 'modernization' projects come and go" | The tool must demonstrably help, not add friction. If it's slower or more confusing than the current process, it's dead on arrival. |
| "'STONE'S THROW' on the label but 'Stone's Throw' in the application" | **Fuzzy matching is essential.** Exact string comparison would flag obviously-identical brand names as mismatches. The tool needs case-insensitive, punctuation-normalized comparison with a confidence threshold. |
| "You need judgment" | The AI should assist, not replace. Results should show confidence scores and let the agent make the final call. |
| "Just don't make my life harder" | Minimal learning curve. The tool should feel like an accelerator, not a new system to learn. |

### Jenny Park (Junior Compliance Agent, 8 months)

Jenny gave the most specific technical requirements about the verification itself:

| What she said | What it means for us |
|---|---|
| "I literally have a printed checklist on my desk" | The UI should mirror this mental model: a checklist of fields, each with a pass/fail status. |
| "'GOVERNMENT WARNING:' has to be in all caps and bold" | **The government warning check is not fuzzy -- it is exact.** The validator must check: (1) exact wording, (2) "GOVERNMENT WARNING:" in all caps specifically, (3) both required sentences present. This is a different kind of check than brand name matching. |
| "'Government Warning' in title case instead of all caps. Rejected." | Confirms the all-caps requirement is enforced strictly. A dedicated `warningValidator.ts` module handles this separately from generic field comparison. |
| "Labels that are photographed at weird angles, or the lighting is bad, or there's glare" | **Image preprocessing matters.** Grayscale conversion, contrast enhancement, sharpening, and noise reduction should happen before OCR to maximize accuracy on imperfect images. Jenny even flagged this as "maybe out of scope for a prototype" -- delivering it anyway shows attention to detail. |

---

## The Decision Tree

### Decision 1: What is the core problem?

The spec buries this in conversational text, but the core problem is simple:

> Given a label image and a set of application data fields, determine whether each field on the label matches the corresponding application data.

Everything else (batch upload, image preprocessing, fuzzy matching, government warning validation) is a feature that supports or enhances that core comparison.

### Decision 2: Cloud AI vs. Dual Local OCR

This was the highest-impact architectural decision. Here is how I evaluated the options:

**Option A: Cloud Vision API (OpenAI GPT-4o, Google Vision, Azure AI)**
- Pros: Best accuracy, structured extraction, handles complex layouts
- Cons: Requires outbound API calls (Marcus's firewall concern), adds cost per request, introduces a runtime dependency on a third party, API latency adds to response time
- Verdict: **Eliminated.** The user explicitly requested non-cloud, and the spec's firewall anecdote makes this a poor choice for demonstrating production awareness.

**Option B: Self-hosted vision LLM (Ollama + LLaVA)**
- Pros: Runs locally, good accuracy, structured extraction
- Cons: Requires GPU server for reasonable speed ($$$), large model downloads, complex deployment, evaluators can't easily run it locally
- Verdict: **Eliminated.** Too heavy for a prototype. Deployment cost and complexity are disproportionate to the ask.

**Option C: Dual Local OCR (ONNX PaddleOCR + Tesseract.js)** -- ONNX PaddleOCR (PP-OCRv4) as primary for high accuracy, Tesseract.js multi-pass as fallback. Both run 100% locally via ONNX Runtime + LSTM neural network. Zero cloud dependency.
- Pros: Runs on any server (no GPU needed), zero API calls, bundled with the app, mature and proven, WASM-based so works in Node.js, free
- Cons: Less accurate than cloud vision AI on complex layouts, requires image preprocessing to get good results, extracts raw text (not structured fields) so we need custom parsing
- Verdict: **Selected.** Dual-engine approach provides high accuracy locally while meeting all firewall and performance constraints.

**Option D: Hybrid (Tesseract.js primary, optional cloud AI enhancement)**
- Considered but rejected for simplicity. A working core with clean code is preferred over ambitious features. The optional cloud path can be documented as a "future enhancement" in APPROACH.md.

### Decision 3: Tech Stack

**Options considered:**

| Stack | Pros | Cons | Verdict |
|---|---|---|---|
| Next.js (TypeScript) full-stack | Single codebase, single deployment, modern UI, type safety, fast to build | .gitignore is Python (cosmetic mismatch) | **Selected** |
| Python FastAPI + React frontend | Python matches .gitignore, pytesseract is mature, good separation | Two deployments, more moving parts, slower to build in timeframe | Rejected |
| Python FastAPI + Jinja2/HTMX | Single Python app, simple deployment | Less modern UI, harder to build beautiful UX | Rejected |
| .NET (matching their existing COLA system) | Aligns with their infrastructure | Over-optimization for the audience, slower to prototype | Rejected |

**Why Next.js won:**

1. **Single deployment.** One codebase, one URL for evaluators. No "start the backend, then the frontend" complexity.
2. **TypeScript.** Type safety across the entire app. Self-documenting interfaces. The evaluation criteria explicitly mention "code quality and organization."
3. **React + Tailwind + shadcn/ui.** The fastest path to a beautiful, accessible UI. Half the team is over 50 -- the UI must be clean, large, and obvious. shadcn/ui gives us accessible, keyboard-navigable components for free.
4. **API Routes.** Next.js API routes run server-side on the same deployment. Tesseract.js runs there with no additional infrastructure.
5. **The spec says "any language."** They want to see decision-making, not language loyalty.

### Decision 4: Deployment Platform

**Azure Container Apps over Vercel.** Driven by the 5-second performance requirement and alignment with TTB's infrastructure.

- **Vercel** uses serverless functions. Each API call spins up a new function instance. Tesseract.js needs to load its WASM engine and language data on each cold start -- this alone can take 3-5 seconds before OCR even begins. Combined with OCR processing time, it would blow past the 5-second budget.
- **Azure Container Apps** runs a persistent container. The Tesseract.js worker pool initializes once on startup and stays warm. Subsequent OCR requests hit a warm worker and complete in ~1-3 seconds. This meets the 5-second SLA with room to spare. Additionally, TTB is already on Azure (Marcus's interview), so deploying there aligns with their existing infrastructure and demonstrates production awareness.

### Decision 5: Fuzzy Matching Strategy

Two types of comparison are needed:

1. **Fuzzy comparison** for text fields (brand name, class/type, producer name). Dave's 'STONE'S THROW' vs 'Stone's Throw' example demands this. We normalize (lowercase, strip punctuation) and then compute similarity. A threshold (e.g., 85%+) returns "match" with a confidence score.

2. **Exact comparison** for the government warning. Jenny was explicit: word-for-word, "GOVERNMENT WARNING:" in all caps. No fuzzy matching here. A dedicated validator handles this as a special case.

This dual approach shows the evaluators that we understood the nuance -- not everything is a nail that needs the same hammer.

### Decision 6: Image Preprocessing

Jenny flagged imperfect images as a real problem. The dual-engine approach handles this at two levels:

- **ONNX PaddleOCR (primary)** processes the raw image directly -- its built-in preprocessing handles most labels without our intervention.
- **Tesseract.js (conditional fallback)** benefits from a `sharp` preprocessing pipeline when ONNX finds fewer than 5 fields:

1. **Resize** -- normalize to 1200px width for consistent Tesseract input
2. **Grayscale conversion** -- reduces noise from color variation
3. **Contrast normalization** -- makes text pop against backgrounds
4. **Sharpening** -- improves edge definition on blurry photos

An alternate pass (high-contrast binary threshold or color inversion at 2000px) runs only when the normal Tesseract pass still leaves gaps. This is done with `sharp`, a fast native Node.js image library. Preprocessing adds ~100-200ms but significantly improves OCR accuracy on imperfect real-world label photos.

---

## Why the Project is Structured This Way

### The docs/ folder

The spec calls for "brief documentation of approach, tools used, assumptions made." Most candidates will write a README and call it done. We go further:

- **`docs/APPROACH.md`** -- Maps every stakeholder quote to a design decision. Shows the evaluator that we didn't just build something; we listened, extracted, and responded to their actual concerns.
- **`docs/ARCHITECTURE.md`** -- System diagram, data flow, module responsibilities. Shows we can communicate technical decisions clearly -- a critical skill for a government IT specialist.
- **The existing spec docs** (`docs/spec/interviews.md`, `docs/spec/requirements.md`, etc.) -- Show organized thinking from the start. The evaluators can see we broke down their monolithic spec into actionable reference documents.

### The src/lib/ structure

Code is organized by responsibility, not by file type:

- `lib/ocr/` -- Everything related to image-to-text conversion
- `lib/extraction/` -- Everything related to parsing raw text into structured fields
- `lib/verification/` -- Everything related to comparing fields and producing results

Each layer is independently testable. The OCR engine doesn't know about verification. The comparator doesn't know about Tesseract. This separation of concerns is deliberate and shows software engineering maturity.

### The UI structure

Two pages, not one:

- **Home page (`/`)** -- Single label verification. The 80% use case. Upload, fill form, verify.
- **Batch page (`/batch`)** -- Multi-label processing. The 20% use case that Sarah and Janet specifically asked for.

A third page (`/about`) explains how the tool works -- useful for the evaluators and for the less technical agents on the team.

---

## What I Deliberately Left Out (and Why)

| Feature | Why it's excluded |
|---|---|
| User authentication / accounts | Marcus said "don't do anything crazy" for the prototype. No PII, no sessions. |
| Database / persistent storage | Standalone prototype. No data retention needed. Everything is processed in-memory. |
| COLA system integration | Marcus explicitly said not to integrate with COLA. |
| Cloud AI fallback | The user requested non-cloud. Documented as a future enhancement. |
| PDF label support | The spec shows image-based labels. PDF parsing adds complexity for an edge case. Documented as a limitation. |
| Multi-language OCR | TTB labels are English. Adding language support adds download size and complexity for no prototype value. |

These trade-offs will be documented in `docs/APPROACH.md` to show the evaluators we considered them and made intentional decisions -- not that we forgot.

---

## Implementation Sequence Rationale

The work is ordered so that at any point, we have a working (if incomplete) app:

1. **Project init** -- Scaffolding. After this step we have a running Next.js app with styled placeholder pages.
2. **OCR engine** -- The technical core. After this step we can upload an image and get text back.
3. **Field extraction** -- Parse that text into structured data. After this step the OCR is useful, not just raw text.
4. **Verification logic** -- The comparison engine. After this step the core intellectual property is built.
5. **API routes** -- Wire everything together. After this step we have working endpoints.
6. **UI (single label)** -- The primary interface. After this step we have a shippable MVP.
7. **UI (batch)** -- The stretch feature. After this step we've addressed Sarah's batch concern.
8. **Test labels** -- Proof that it works on realistic inputs.
9. **Documentation** -- README, approach, architecture. Shows professionalism.
10. **Deployment** -- Live URL for evaluators to test.

If time runs short, we stop after step 6 and we still have a complete, working, documented application. The spec says: "A working core application with clean code is preferred over ambitious but incomplete features." The sequencing honors that directly.

---

## Summary

Every decision traces back to something a stakeholder said, a constraint in the spec, or an evaluation criterion. Nothing was chosen because it is trendy or because it is what I am most comfortable with. The plan is built to answer one question the evaluators will be asking themselves:

> "Does this person understand what we actually need, and can they deliver it?"

The answer is in the traceability, the trade-off documentation, the UX priorities, and the working prototype.
