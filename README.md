# TTB Label Verification App

An AI-powered tool that helps TTB compliance agents verify alcohol beverage labels against application data. Upload a label image, enter the application details, and get instant field-by-field verification results.

Built as a standalone prototype for the Alcohol and Tobacco Tax and Trade Bureau (TTB).

---

## Live Demo

> **Deployed URL:** https://ttb-label-verification.delightfulbeach-49152395.eastus.azurecontainerapps.io

---

## Quick Start

### Prerequisites

- Node.js 18+ ([download](https://nodejs.org/))
- npm (included with Node.js)

### Local Setup

```bash
git clone https://github.com/Suntek-Enterprises/ttbgov.git
cd ttbgov
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Copy the example env file:

```bash
cp .env.example .env.local
```

> No external API keys are required. All processing runs locally on the server.

---

## What It Does

A compliance agent reviews ~150,000 label applications per year. Each review involves comparing what's printed on a physical label against what's declared in the application. This tool automates that comparison:

1. **Upload** a label image (drag-and-drop or file picker)
2. **OCR extracts** all text from the label using Tesseract.js (runs locally, no cloud APIs)
3. **Enter application data** in a simple form (brand name, ABV, class/type, etc.)
4. **Get instant results** -- field-by-field pass/fail with confidence scores

### Key Features

- **Single label verification** -- the core 80% use case
- **Batch upload** -- process multiple labels at once for high-volume importers
- **Fuzzy matching** -- handles case/punctuation differences ("STONE'S THROW" vs "Stone's Throw")
- **Government warning validation** -- exact text match with all-caps prefix check
- **Image preprocessing** -- grayscale, contrast enhancement, sharpening for imperfect photos
- **Sub-5-second response** -- warm OCR worker pool keeps processing fast

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js (TypeScript) | Single codebase, single deployment, type-safe |
| UI | React + Tailwind CSS + shadcn/ui | Accessible, clean, responsive -- usable by non-technical staff |
| OCR | Tesseract.js | Local OCR engine, no cloud API calls, works behind firewalls |
| Image Processing | sharp | Fast native Node.js image manipulation for preprocessing |
| Fuzzy Matching | string-similarity-js | Case/punctuation-normalized comparison with confidence scores |
| Deployment | Azure Container Apps | Persistent container, always-on, aligns with TTB's Azure infrastructure |

### Why Local OCR Instead of Cloud AI?

The TTB network blocks outbound traffic to many domains. A previous vendor's cloud ML endpoints were blocked by the firewall. Tesseract.js runs entirely on the app server -- zero outbound API calls for core functionality. See [docs/APPROACH.md](docs/APPROACH.md) for the full decision rationale.

---

## Project Structure

```
ttbgov/
├── docs/
│   ├── spec/                    # Original project spec and breakdowns
│   ├── considerations/          # Internal planning (rationale, risks, assumptions)
│   ├── APPROACH.md              # Approach, decisions, trade-offs
│   └── ARCHITECTURE.md          # System architecture and data flow
├── src/
│   ├── app/                     # Next.js App Router (pages + API routes)
│   ├── components/              # React components
│   └── lib/                     # Core logic (OCR, extraction, verification)
├── public/test-labels/          # Test labels: real (COLA registry), generated (AI), degraded (stress tests)
├── Dockerfile                   # Production container
└── README.md                    # You are here
```

---

## Screenshots

> Screenshots will be added after deployment. To preview locally, run `npm run dev` and open http://localhost:3000.

---

## Approach & Documentation

- **[docs/APPROACH.md](docs/APPROACH.md)** -- How stakeholder interviews informed every design decision, trade-offs acknowledged, what would change for production
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** -- System architecture diagram, data flow, module responsibilities

---

## Trade-offs & Limitations

- **OCR accuracy** -- Tesseract.js is less accurate than cloud vision APIs (GPT-4o, Google Vision) on complex label layouts. Image preprocessing mitigates this but does not eliminate it. Best results come from flat, well-lit label scans rather than angled bottle photos.
- **No COLA integration** -- This is a standalone prototype per the spec. Production integration with COLA would require separate authorization and scoping.
- **No persistent storage** -- Labels and results are processed in-memory. Nothing is stored between sessions.
- **English labels only** -- TTB labels are English. Multi-language OCR is not included to keep the deployment lightweight.
- **Government warning validation** -- Uses a high-threshold fuzzy match on the body text to account for minor OCR artifacts while keeping the "GOVERNMENT WARNING:" prefix check strict.

---

## Deployment

### Azure Container Apps (primary)

Deployed to Azure Container Apps, consistent with TTB's existing Azure infrastructure. The deployment is fully config-driven via `scripts/deploy-azure.sh`:

```bash
# Login to Azure (if not already)
az login

# Deploy (all config via environment variables with sensible defaults)
./scripts/deploy-azure.sh
```

Override any default with environment variables:

```bash
AZURE_RESOURCE_GROUP=my-group AZURE_LOCATION=westus ./scripts/deploy-azure.sh
```

### Docker (run anywhere)

The app ships as a standard Docker container. Deploy to any platform that runs Docker:

```bash
docker build -t ttb-label-verification .
docker run -p 3000:3000 ttb-label-verification
```

---

## What Would Change for Production

- **Azure deployment** with FedRAMP-certified infrastructure
- **COLA system integration** for automated application data import
- **Azure AI Document Intelligence** or similar for higher-accuracy OCR (once firewall rules allow)
- **User authentication** and role-based access
- **Audit logging** and document retention per federal compliance requirements
- **Section 508 accessibility audit**

---

## License

This project was built as a take-home exercise for the TTB IT Specialist position.
