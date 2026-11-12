# 🌱 DRISHTI 360
### AI-Powered Farm-to-Market Intelligence Platform

<p align="center">
  <img src="docs/assets/drishti-360-logo.png" alt="DRISHTI 360 Logo" width="180"/>
</p>

<h3 align="center">From Farm to Market – Quality, Compliance, Transparency & Fair Value.</h3>

<p align="center">
  <img src="https://img.shields.io/badge/AI-Powered-14532D?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Agriculture-Tech-228B22?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Farm--to--Market-A3E635?style=for-the-badge&labelColor=14532D" />
  <img src="https://img.shields.io/badge/Status-Development-D9F99D?style=for-the-badge&labelColor=14532D" />
</p>

---

## 🌾 About DRISHTI 360

**DRISHTI 360** is an AI-powered Farm-to-Market Intelligence Platform designed to empower farmers, Farmer Producer Organizations (FPOs), buyers and agricultural businesses.

The platform connects crop quality assessment, packaging compliance verification, fair price intelligence and digital traceability into one unified ecosystem.

By combining Computer Vision, OCR, market intelligence and cryptographic verification, DRISHTI 360 aims to make agricultural quality information more transparent, accessible and trustworthy.

### 🎯 Our Mission

To empower farmers with reliable quality insights, transparent price information and verifiable digital product identities — helping build a fairer and more trusted agricultural marketplace.

---

## 🚀 The Problem We Address

Agricultural supply chains face several challenges:

- Farmers struggle to prove the quality of their produce.
- Inconsistent quality assessment can lead to unjustified price deductions.
- Limited market price transparency creates information asymmetry.
- Packaging and compliance verification can be time-consuming.
- Buyers lack easy access to reliable product inspection records.
- Disconnected systems make end-to-end traceability difficult.

**Our approach:** Connect quality, compliance, pricing and traceability through a single intelligent platform.

---

## 💡 Core Features

### 1. 🌿 AI Visual Crop Intelligence

- Upload crop images using a smartphone.
- Analyze visible crop characteristics and defects.
- Identify discoloration, damage and uniformity.
- Generate structured crop quality observations and estimated grades.
- Support crop-specific assessment workflows.

### 2. 📦 Smart Label & Compliance Intelligence

- Extract packaging information using OCR.
- Identify batch details, dates and mandatory declarations.
- Detect missing or inconsistent label information.
- Highlight potential compliance issues for further review.

*Automated findings are preliminary and do not replace official regulatory certification.*

### 3. 💰 Grade-Linked Fair Price Intelligence

- Connect assessed crop quality with market price benchmarks.
- Use crop variety, location, grade and market information.
- Generate indicative grade-adjusted price ranges.
- Display benchmark prices and valuation details.
- Help farmers and buyers make more informed decisions.

### 4. 🏅 Digital Quality Passport

- Generate a unique digital identity for each inspected batch.
- Store crop grade and inspection information.
- Generate downloadable quality certificates.
- Create QR codes for product verification.
- Use SHA-256 hashes to check inspection record integrity.

### 5. 🔍 End-to-End Traceability

- Track batch-level agricultural records.
- Maintain chronological inspection and processing events.
- Record grading, compliance, certification and dispatch information.
- Support buyer-side product verification.
- Maintain an auditable history of recorded activities.

### 6. 🤝 FPO & Buyer Workflow

- Support multiple farmers and agricultural batches.
- Enable batch-level management.
- Provide buyers with QR-based verification.
- Help FPOs organize inspection and certification records.

### 7. 📡 Offline-First Field Readiness

- Support offline data capture where implemented.
- Queue records for synchronization.
- Sync information when connectivity returns.
- Support low-bandwidth field environments.

### 8. 👨‍🔬 Human-in-the-Loop Review

- Enable inspector review of AI-generated assessments.
- Record corrections and review reasons.
- Compare original predictions with human-reviewed results.
- Support continuous quality improvement through validated feedback.

---

## 🧠 What Makes DRISHTI 360 Different?

| Innovation | Value |
|---|---|
| Multi-Modal Intelligence Fusion | Combines crop images, packaging text and market information |
| Context-Aware Valuation | Connects assessed quality with market benchmarks |
| Digital Quality Passport | Creates a verifiable digital identity for produce |
| Cryptographic Record Integrity | Helps detect changes to stored inspection records |
| QR-Based Verification | Makes relevant product information accessible to buyers |
| Offline-First Workflow | Supports agricultural field environments |
| Human-in-the-Loop Intelligence | Allows expert review and correction |

**Our core innovation:** Bringing crop quality, packaging compliance, grade-linked valuation and digital traceability together in one connected platform.

---

## ⚙️ System Architecture

```text
             FARMER / FPO / BUYER / INSPECTOR
                            |
                            v
                  DRISHTI 360 FRONTEND
                            |
                            v
                     API BACKEND
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
        COMPUTER VISION    OCR       MARKET DATA
             |              |              |
             +--------------+--------------+
                            |
                            v
                 INTELLIGENCE ENGINE
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
          CROP GRADE    COMPLIANCE     PRICE ESTIMATE
             |              |              |
             +--------------+--------------+
                            |
                            v
                  DIGITAL QUALITY PASSPORT
                            |
                   QR + SHA-256 HASH
                            |
                            v
                   TRACEABILITY SYSTEM
                            |
                            v
                    DATABASE STORAGE
```

---

## 🛠️ Technology Stack

The following technologies represent the intended architecture. Update this section to match the actual implemented project.

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, Tailwind CSS |
| Backend | Python FastAPI / Spring Boot |
| Database | PostgreSQL |
| AI & Computer Vision | OpenCV, CNN / Vision Models |
| OCR | PaddleOCR / Tesseract |
| Market Intelligence | Agmarknet / e-NAM data sources |
| Security | SHA-256 hashing |
| QR Verification | QR Code Generation |
| Deployment | Vercel / Render / Cloud Hosting |
| Version Control | Git & GitHub |

---

## 🔄 How DRISHTI 360 Works

1. **Register:** Farmer or FPO accesses the platform.
2. **Upload:** Crop images and relevant packaging details are submitted.
3. **Analyze:** AI and OCR modules process the available information.
4. **Assess:** The platform generates crop quality observations and estimated grades.
5. **Evaluate:** Market benchmarks are combined with grade information to estimate indicative value.
6. **Certify:** A Digital Quality Passport and QR identity are generated.
7. **Track:** Batch events and inspection records are maintained.
8. **Verify:** Buyers scan the QR code to view permitted product information.

---

## 📊 Expected Impact

| Stakeholder | Benefits |
|---|---|
| Farmers | Better quality visibility and price transparency |
| FPOs | Centralized batch and inspection management |
| Buyers | Easier product verification and traceability |
| Inspectors | Structured quality review and correction |
| Agricultural Businesses | Improved information transparency |

---

## 🖥️ Screenshots & Demo

Add actual screenshots from your running DRISHTI 360 prototype below.

| Dashboard | Crop Intelligence |
|---|---|
| Add dashboard screenshot | Add crop analysis screenshot |

| Price Intelligence | Digital Quality Passport |
|---|---|
| Add pricing screenshot | Add certificate screenshot |

**Live Demo:** Add your deployed application URL here.

**Demo Video:** Add your project demonstration URL here.

---

## 🚀 Installation & Setup

### Prerequisites

- Git
- Node.js and npm (if using a Node-based frontend)
- Python (if using a Python backend)
- Database server or managed database
- Required AI model files and dependencies

### 1. Clone the Repository

```bash
git clone https://github.com/sudharshanps/Drishti-360.git
cd Drishti-360
```

### 2. Configure Environment Variables

Create environment files based on the provided `.env.example` files.

Example:

```env
DATABASE_URL=your_database_connection
SECRET_KEY=your_secret_key
API_BASE_URL=your_backend_url
```

Use the actual variable names required by your application. Never commit real credentials.

### 3. Install Dependencies

Install frontend and backend dependencies using the commands specified in their respective project directories.

### 4. Start the Application

Use the actual development commands configured in the project.

For example, a Vite frontend may use:

```bash
npm install
npm run dev
```

A FastAPI backend may use:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Adjust the entry-point and commands to match the actual repository structure.

---

## 🔐 Security & Data Integrity

DRISHTI 360 is designed with security and data integrity considerations:

- Environment-based secret management.
- Role-based access control where implemented.
- Secure API communication.
- SHA-256 inspection record integrity checks.
- Input validation and upload restrictions.
- Controlled public QR verification.
- Protection of private farmer and inspection information.

---

## ☁️ Deployment

The production deployment architecture will depend on the implemented project stack.

Potential hosting configuration:

| Component | Hosting |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | Managed PostgreSQL |
| File Storage | Cloud Object Storage |

### Cloud & Local Setup Guides
- **Frontend (Vercel):** Config in `frontend/vercel.json` (SPA fallback for `/verify/:passportId` and `/app/*`). Set Root Directory = `frontend`, Env = `VITE_API_BASE_URL=https://<your-render-backend>.onrender.com`.
- **Backend & PostgreSQL (Render Blueprint):** Config in `render.yaml` and `backend/Dockerfile` (`/api/health` healthcheck). Connect `sudharshanps/Drishti-360` and configure `FRONTEND_URL`, `CORS_ORIGINS`, and `PUBLIC_VERIFY_BASE_URL`.
- **Docker Compose:** Copy `.env.example` to `.env` and run `docker compose up --build -d`.

Deployment URLs will be added after successful production deployment.

---

## 📈 Future Scope

- Expand crop-specific AI grading capabilities.
- Integrate additional regional market data sources.
- Improve multilingual farmer accessibility.
- Support additional FPO and institutional buyer workflows.
- Integrate external agricultural procurement systems.
- Improve offline synchronization and field performance.
- Expand regional crop grading calibration through validated inspector feedback.

---

## 💼 Sustainability & Business Model

DRISHTI 360 can follow a hybrid freemium model:

- **Farmers:** Free access to core crop assessment and price discovery features.
- **FPOs:** Subscription-based batch management and analytics.
- **Institutional Buyers:** Business dashboards and procurement intelligence.
- **Agri-exporters and Retail Chains:** Bulk certification and compliance API services.

---

## 👥 Team — CIPHER CREW

**Built with a vision to create a more transparent and intelligent agricultural ecosystem.**

| Team Member |
|---|
| Samvardhini P |
| Sudharshan P S |

---

## 🌱 Our Vision

We believe every farmer deserves the opportunity to demonstrate the true quality of their produce.

With AI-driven intelligence, transparent valuation and verifiable digital records, DRISHTI 360 aims to connect farms and markets through trust.

<p align="center">
  <strong>🌾 DRISHTI 360</strong>
  <br/>
  <em>Quality. Compliance. Transparency. Fair Value.</em>
  <br/><br/>
  <img src="https://img.shields.io/badge/Built%20for%20Agriculture-14532D?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Powered%20by%20Innovation-A3E635?style=for-the-badge&labelColor=14532D" />
</p>

---

<p align="center">
  © 2026 CIPHER CREW | DRISHTI 360
</p>
