# Crime Tracer - Advanced Digital Complaint Management Platform

Crime Tracer is a state-of-the-art, AI-powered platform designed to revolutionize the way crime complaints are filed, managed, and investigated. It bridges the gap between citizens (Victims) and law enforcement (Police/Home Department) through a seamless, secure, and intelligent ecosystem.

## Table of Contents

- [🚀 Project Overview](#-project-overview)
- [🏗️ Architecture & Tech Stack](#%EF%B8%8F-architecture--tech-stack)
- [📦 Service Breakdown](#-service-breakdown)
- [🧠 AI/ML Model Architecture](#-aiml-model-architecture)
- [🗄️ Database & Migrations](#%EF%B8%8F-database--migrations)
- [🔒 Security Features](#-security-features)
- [🛠️ Getting Started](#%EF%B8%8F-getting-started)
- [📡 API Wireframe](#-api-wireframe)
- [💾 Tech Stack Details](#-tech-stack-details)

---

## 🚀 Project Overview

The system allows users to file complaints digitally with ease, while providing law enforcement with powerful tools for case management, investigation, and analysis. It integrates advanced AI models to automatically map complaints to relevant Bharatiya Nyaya Sanhita (BNS/BNS) sections.

### Key Features

- **Victim Portal**: A user-friendly interface for citizens to file complaints, upload evidence, and track status in real-time.
- **Police Dashboard**: A comprehensive command center for officers to manage investigations, view analytics, and coordinate actions.
- **AI-Powered Legal Section Classification**: Intelligent mapping of case details to legal sections (BNS) using RAG-HGAT models with 99.87% accuracy.
- **Secure Infrastructure**: Enterprise-grade security with JWT authentication, OAuth2, and role-based access control.
- **Evidence Management**: Secure storage with S3 integration and local fallback with SHA-256 hashing.
- **Analytics & Insights**: Real-time dashboards with crime statistics and officer workload tracking.

---

## 🏗️ Architecture & Tech Stack

The project follows a modern microservices architecture:

| Component | Tech Stack | Description |
|-----------|------------|-------------|
| **Backend** | Python, FastAPI, SQLAlchemy | Core API handling logic, auth, and database interactions. Supports both SQLite (dev) and Firestore (prod). |
| **Client Frontend** | React, Vite, TailwindCSS | The public-facing portal for citizens to report crimes and track progress. |
| **Server Frontend** | React, Vite, TailwindCSS | The administrative and operational dashboard for police officers and admins. |
| **BNS Generator** | React, Vite, TypeScript | Frontend interface for BNS section prediction using the AI model. |
| **AI Engine** | PyTorch, FAISS, BERT | Specialized service for Legal Section mapping using RAG-HGAT architecture. |
| **Infrastructure** | Docker, Nginx, GitHub Actions | Fully containerized deployment with CI/CD pipelines. |

---

## 📦 Service Breakdown

### 1. Backend Service (`/Backend`)

The central nervous system of the platform, providing all API endpoints and business logic.

**Framework**: FastAPI (High performance async Python framework)

**Database Support**:
- **Development**: SQLite (local, file-based)
- **Production**: Firebase Firestore (cloud-native)

**Key Features**:
- Rate limiting with Redis
- CORS policies with configurable origins
- JWT token authentication with rotation
- Prometheus metrics and structured logging
- Circuit breaker pattern for external service resilience
- Exponential backoff retry logic

**Core Endpoints**:
- `/api/auth` – Registration/login for victims, cops, and admin bootstrap
- `/api/victim` – Profile, complaint filing, tracking, resolution
- `/api/cases` – Cop dashboards (unassigned, assigned, status changes)
- `/api/stations` – Station management and listing
- `/api/admin` – Cop approvals, global stats, transfer decisions
- `/api/cop` – Cop profile and transfer requests
- `/api/stats` – Victim/case/station level statistics
- `/api/uploads` – Evidence file uploads (S3 + local fallback)

**Database Models**:
- `User` (role-based: victim/cop/admin, station associations, approval status)
- `Station` (police station details)
- `Complaint` (statuses: NotAssigned, Investigating, Resolved, Closed, Rejected)
- `Evidence` (file metadata, storage type, SHA-256 hash)
- `Case` (assigned officer, investigation timeline)
- `Note` (victim-visible and internal notes)
- `ComplaintStatusHistory` (audit trail)
- `CopTransferRequest` (station transfer tracking)
- `AuditLog` (immutable security events)

### 2. Victim Portal (`/Client_Side_Frontend`)

Designed for accessibility and ease of use.

**Tech**: React 18, Framer Motion, React Query, shadcn/ui

**Features**:
- Anonymous reporting options
- Multi-language support (i18n)
- Step-by-step complaint filing wizard
- Real-time complaint status tracking
- Camera integration for evidence capture
- Emergency contact management

**Workflow**:
1. Register/Login as victim
2. File complaint with multi-step wizard
3. Upload evidence (photos, documents)
4. Select location and police station
5. Receive AI-generated BNS sections and precautions
6. Track complaint status in real-time
7. Confirm resolution within 24-hour window

### 3. Police Dashboard (`/Sever_Side_Frontend`)

A data-heavy, feature-rich dashboard for law enforcement.

**Tech**: React 18, Recharts, Leaflet/Mapbox, shadcn/ui

**Features**:
- KanBan board for case management
- Interactive station maps
- Crime statistics and analytics
- Officer workload tracking and assignment
- Transfer request management
- Cop approval workflows
- Real-time case updates

### 4. BNS Generator Frontend (`/BNS_Generator_Frontend`)

Modern interface for testing and demonstrating the AI legal section prediction model.

**Tech**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion

**Features**:
- Case facts input form
- Real-time BNS section predictions
- Detailed legal section analysis
- Animated hero section showcasing the model
- Production-ready deployment ready

---

## 🧠 AI/ML Model Architecture

### RAG-HGAT Model Overview

The RAG-HGAT (Retrieval-Augmented Generation with Hierarchical Graph Attention Networks) model is a sophisticated hybrid neural architecture designed specifically for legal section classification from crime complaint text. It represents a significant advancement in legal text classification by combining multiple complementary learning paradigms.

**Model Performance**:
- 99.87% Hamming accuracy
- 98.57% Micro F1-score
- 95% Exact match accuracy
- Handles 57 active BNS sections + hierarchical relationships

### Model Performance Visualization

#### Section F1-Micro Score Progression
The model demonstrates rapid learning in the first 10 epochs, achieving over 85% F1-score. Training and validation curves show excellent convergence, indicating absence of significant overfitting. The model stabilizes around 98.57% F1-score by epoch 30.

![Section F1-Micro Score Progression](Backend_Model/Images/f1_progression.png)

#### Crime Classification Accuracy Progression
Crime type classification achieves near-perfect accuracy within the first 5 epochs (99%+), stabilizing at essentially 100% accuracy. This demonstrates the model's exceptional ability to categorize crime types even with limited training data.

![Crime Classification Accuracy Progression](Backend_Model/Images/crime_accuracy.png)

#### Embedding Space Visualization

**t-SNE: Embeddings Colored by Primary BNS Section**

The t-SNE visualization reveals that the model's internal representations form well-separated clusters for different legal sections. Sections with related legal meanings naturally cluster together, demonstrating that the model learns meaningful legal relationships. For instance, sexual offense sections (51-56, shown in blue/cyan) form tight clusters, as do theft-related sections (shown in orange).

![t-SNE BNS Section Embeddings](Backend_Model/Images/tsne_bns_sections.png)

**t-SNE: Embeddings Colored by Crime Type**

Crime type embeddings show clear separation across the embedding space, confirming that the model learns distinct patterns for different crime categories. The hierarchical structure suggests the model captures both fine-grained legal distinctions and broader crime type classifications.

![t-SNE Crime Type Embeddings](Backend_Model/Images/tsne_crime_types.png)

### Complete Architecture Diagram

The following diagram illustrates the complete RAG-HGAT architecture flow:

![RAG-HGAT Model Architecture](Backend_Model/Images/model_architecture.png)

**Architecture Flow Explanation**:
1. **Input**: Crime complaint text enters the system
2. **Dual Path Processing**:
   - **Left Path**: Legal-BERT encoder converts text to 768-dim semantic embeddings
   - **Right Path**: BNS Knowledge Base and Sentence Transformer perform Top-20 retrieval
3. **Feature Fusion**: RAG scores (scaled 10x) concatenated with BERT embeddings (825-dim total)
4. **Graph Processing**: 57 BNS section nodes create relationship graph with 278 edges
5. **Multi-Head Attention**: Case-level multi-head attention with 4 parallel heads
6. **Cross-Attention Module**: Case features query section graph features
7. **Shared Base Layer**: Fuses all information (1536-dim)
8. **Output Heads**: Dual classification for sections (57 expert classifiers) and crime type (13 classes)
9. **Final Predictions**: Legal section logits + crime type classification

### Architecture Components

#### 1. **Dual Encoding Strategy**

**Legal-BERT Encoder**
- Model: `nlpaueb/legal-bert-base-uncased` (domain-adapted BERT)
- Pre-trained on legal document corpora
- Output: 768-dimensional embedding vectors
- Sequence length: 512 tokens with truncation
- Processes: Crime complaint text through multiple transformer layers
- Captures: Legal terminology, contextual relationships, linguistic patterns

The Legal-BERT component extracts semantic understanding from complaint narratives, with the final hidden state of the CLS token serving as the embedding that encapsulates complaint content. This happens through multi-layer self-attention mechanisms that allow the model to understand contextual relationships and capture nuanced legal phrasing patterns critical for accurate classification.

#### 2. **Retrieval-Augmented Generation (RAG)**

The RAG component compensates for limited training samples by leveraging external legal knowledge:

**Knowledge Base Construction**:
- 57 active BNS sections (from full 83 sections)
- Rich structured information per section:
  - Section title and detailed description
  - Crime category classification
  - Severity level and legal punishment ranges
  - Specific legal elements constituting the offense
  - Relevant keywords and terminology
  - Cognizability status (police arrest authority)
  - Bailability status
  - Related sections (co-occurrence patterns)

### BNS Knowledge Base Structure & Examples

The knowledge base is a structured repository containing comprehensive legal information for each BNS section. Each entry includes:

```json
{
  "section_id": "100",
  "crime": "Murder",
  "title": "Culpable homicide",
  "description": "Causes death with intention knowledge likely to cause death",
  "severity": "high",
  "cognizable": true,
  "bailable": false,
  "punishment": {
    "min": "Life",
    "max": "May include"
  },
  "fine": "May include",
  "legal_elements": [
    "Intent to cause death",
    "Intent bodily injury→death",
    "Knowledge→death"
  ],
  "keywords": ["death", "homicide", "intention", "bodily injury"],
  "related_sections": ["101", "103", "105", "109"]
}
```

**Example BNS Sections in Knowledge Base**:

| Section | Crime | Title | Severity | Cognizable | Bailable |
|---------|-------|-------|----------|-----------|----------|
| **100** | Murder | Culpable homicide | High | ✓ | ✗ |
| **101** | Murder | Murder definition | High | ✓ | ✗ |
| **102** | Murder | Transfer of malice | High | ✓ | ✗ |
| **103** | Causing death | Causing death by act | High | ✓ | ✗ |

**Knowledge Base Entry Details**:

**Section 100: Culpable Homicide**
```
Crime Type: Murder
Title: Culpable homicide
Description: Causes death with intention knowledge likely to cause death
Severity: High
Cognizable: Yes (Police can arrest without warrant)
Bailable: No
Punishment Range: Life imprisonment → "May include"
Fine: May include
Legal Elements: 
  - Intent to cause death
  - Intent bodily injury→death
  - Knowledge→death
Keywords: death, homicide, intention, bodily injury
Related Sections: 101, 103, 105, 109
```

**Section 101: Murder Definition**
```
Crime Type: Murder
Title: Murder definition
Description: Culpable homicide with intent knowledge of imminent danger
Severity: High
Cognizable: Yes
Bailable: No
Punishment: Life, Death (rarest), Fine: May include
Legal Elements: Premeditation
Keywords: murder, intention, premeditation, imminent danger
Related Sections: 100, 101, 102
Exceptions: Provocation, Self-defence excess, Consent (18+)
```

**Section 102: Transfer of Malice**
```
Crime Type: Murder
Title: Transfer of malice
Description: Intent existing when inflicted during attack—transfer of intent
Severity: High
Cognizable: Yes
Bailable: No
Punishment: 
  - Min: As culpable homicide
  - Max: As murder if intent satisfied
Legal Elements: Act directed at one, Transfer of intent
Keywords: transfer intent, unintended victim, wrong person
Related Sections: 100, 101
Exceptions: Provocation, Self-defence excess
```

**Retrieval Process**:
- Uses Sentence Transformer: `sentence-transformers/all-MiniLM-L6-v2`
- 384-dimensional embedding vectors in shared semantic space
- FAISS indexing for efficient similarity search
- Retrieves top 20 most relevant legal sections per complaint
- Similarity scores range: 0.0 to 1.0

**Feature Scaling Innovation**:
- Applies 10x scaling factor to RAG similarity scores
- Addresses numerical magnitude imbalance between BERT embeddings (-1 to 1, σ≈0.3) and RAG scores (0 to 1)
- Ensures RAG signals contribute equally during neural network training
- Critical for rare legal sections where training data is sparse

**Combined Feature Representation**:
- BERT embeddings: 768 dimensions
- Scaled RAG scores: 57 dimensions (for sections in training data)
- Total combined features: 825 dimensions

#### 3. **Graph-Based Section Relationship Modeling**

**Hierarchical Graph Construction**:
- Nodes: 57 legal sections
- Edges: 278 connections based on co-occurrence patterns
- Average node degree: ~4.88 connections per section
- Edge weights: Logarithmic transformation of co-occurrence counts
- Prevents high-frequency pairs from dominating graph structure

**Example Legal Relationships**:
- Theft frequently co-occurs with criminal trespass
- Assault often paired with criminal intimidation
- Sexual offenses (sections 64, 65, 66) form dense clusters

**Node Initialization**:
- Each section node: 384-dimensional feature vector
- Encoded using same Sentence Transformer as RAG retrieval
- Consistent embedding space where similar sections are geometrically close
- Represents legal meaning and application patterns

#### 4. **Multi-Head Graph Attention Network (GAT)**

**Architecture Design**:
- Two stacked Graph Attention Convolutional layers
- 4 parallel attention heads per layer
- First GAT layer: 384-dim input → 1024-dim output (256 × 4 heads)
- Second GAT layer: 1024-dim → 1024-dim (single-head aggregation)

**Attention Mechanism**:
- Each node aggregates information from graph neighbors
- Learned attention coefficients determine information flow
- Multi-head attention learns different relationship patterns simultaneously
- Attention computation: concatenated features → learned weight matrix → LeakyReLU → softmax normalization
- Enables dynamic learning of predictive section relationships

**Global Graph Representation**:
- Mean pooling: Captures average patterns across all sections
- Max pooling: Captures distinctive features from highly activated sections
- Concatenation: Produces 2048-dimensional section graph summary

#### 5. **Case Encoding Pathway**

**Feature Transformation**:
- Input: 825-dimensional combined case + RAG features
- Linear transformation to 768 hidden dimensions
- Layer normalization (stabilizes training)
- ReLU activation + 0.25 dropout regularization
- Second linear layer to 384 dimensions (matching graph hidden dim)
- Final normalization, activation, and dropout

**Output**: 384-dimensional refined case representation optimized for classification

#### 6. **Cross-Attention Mechanism**

**Implementation**:
- PyTorch MultiheadAttention module
- 4 attention heads on 384-dimensional embeddings
- Case encoding: Query (384-dim)
- Graph-processed sections: Keys and Values (2048-dim after pooling)
- Attention computation: Case-dependent relevance weighting

**Function**: Enables model to determine which legal sections are most applicable to each specific complaint, effectively creating case-dependent section relevance profiles.

#### 7. **Feature Fusion & Classification**

**Concatenation Components**:
- Original case encoding: 384 dimensions
- Cross-attention attended features: 384 dimensions
- Graph mean pooling: 1024 dimensions
- Graph max pooling: 1024 dimensions
- Total: 1536-dimensional combined feature vector

**Processing**:
- Two-layer feedforward network
- Intermediate expansion to 768 dimensions
- Provides additional modeling capacity
- Final output projections for specialized heads

**Output Heads**:

1. **ImprovedSectionHead** (Multi-label):
   - 57 expert classifiers (one per section)
   - Shared feature extraction layer
   - 57 individual binary output layers
   - Advantages: Section specialization, no interference, natural multi-label handling

2. **Crime Type Head** (Multi-class):
   - Feedforward architecture
   - Projects fused features to 13 crime type outputs
   - Softmax activation for single-label classification

### Training Procedure

**Addressing Class Imbalance**:
- **Asymmetric Loss**: Specifically designed for imbalanced multi-label classification
  - gamma_neg = 4: Aggressively down-weights easy negatives
  - gamma_pos = 1: Lighter weighting on easy positives
  - Critical because most cases have only 2-3 relevant sections out of 57

**Optimization**:
- Optimizer: AdamW (proper weight decay separate from gradient computation)
- Initial learning rate: 0.0001 (slower than typical BERT fine-tuning)
- Weight decay: 0.01 (prevents overfitting)
- Gradient clipping: Max norm 1.0 (prevents unstable updates)
- Gradient accumulation: 2 steps (effective batch size doubling)

**Learning Rate Scheduling**:
- ReduceLROnPlateau monitoring validation Hamming accuracy
- Reduces learning rate by 0.5x after 7 epochs of plateau
- Allows finer adjustments and local minima escape

**Early Stopping**:
- Monitors validation Hamming accuracy
- 15 epoch patience to prevent overfitting

**Performance Metrics Tracked**:
- **Sections (Multi-label)**: Hamming accuracy, exact match, F1 (micro/macro/weighted/sample), precision-recall
- **Crime Types (Multi-class)**: Standard multi-class accuracy

### Model Inference Flow

1. **Text Processing**: Complaint text → tokenization → Legal-BERT encoding (768-dim)
2. **Knowledge Retrieval**: RAG system → top 20 sections → 57-dim score vector (scaled 10x)
3. **Feature Combination**: BERT (768) + RAG (57) → concatenation (825) + case encoder → 384-dim
4. **Graph Processing**: Section graph → 2 GAT layers → node embeddings
5. **Cross-Attention**: Case encoding queries over section features
6. **Global Pooling**: Mean + Max pooling → 2048-dim section summary
7. **Feature Fusion**: Concatenate all components (1536-dim total)
8. **Classification**:
   - Section predictions: 57 expert classifiers → sigmoid → probability scores
   - Crime type: Feedforward + softmax → crime category
9. **Output**: BNS section logits + crime type prediction

### Pre-trained Components

| Component | Model | Dimensions | Purpose |
|-----------|-------|-----------|---------|
| Legal-BERT | nlpaueb/legal-bert-base-uncased | 768 | Semantic encoding of complaint text |
| Sentence Transformer | sentence-transformers/all-MiniLM-L6-v2 | 384 | RAG retrieval and section embeddings |
| Graph Layers | PyTorch Geometric GATConv | 1024 (after first layer) | Section relationship learning |
| Attention | PyTorch nn.MultiheadAttention | 384 | Cross-attention mechanism |

**Total Trainable Parameters**: 6,354,502

---

## 🗄️ Database & Migrations

### Database Setup

- **Primary (Production)**: Firebase Firestore (cloud-native, scalable)
- **Fallback (Development)**: SQLite (local, zero setup)
- **Migration System**: Alembic for schema versioning

### Running Migrations

```bash
# Create a new migration after model changes
alembic revision --autogenerate -m "description"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Check current migration status
alembic current

# View migration history
alembic history
```

### Firebase Firestore Integration

The application includes a Firebase service layer (`app/services/firebase_service.py`) that:
- Automatically falls back to SQLite if Firebase is not configured
- Provides CRUD operations for Firestore collections
- Supports batch operations and queries
- Gracefully handles connection failures

**Setup Firebase**:
1. Set `FIREBASE_CREDENTIALS_PATH` in `.env` to your service account JSON file
2. Set `FIREBASE_PROJECT_ID` in `.env`
3. Service initializes automatically on startup

### Background Jobs

- Auto-closes `Resolved` complaints after **24 hours** if victim doesn't confirm resolution
- Ensures case closure compliance

---

## 🔒 Security Features

### Authentication Security

- **Account Lockout**: Automatic lockout after 5 failed login attempts (15-minute duration)
- **Password Strength Validation**: Enforced requirements
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
  - At least one special character
- **Failed Login Tracking**: Comprehensive tracking with remaining attempt count display
- **Security Event Logging**: All authentication events logged with client IP and context

### Token Management

- **JWT Authentication**: JSON Web Tokens for stateless authentication
- **OAuth2 Support**: JWT password flow + OAuth2 scope-based authorization
- **Token Rotation**: Automatic refresh token handling
- **Role-Based Access Control**: Three main roles (victim/cop/admin) with fine-grained permissions

### Error Handling & Resilience

**Custom Exception Classes**:
- `CrimeTracerException`: Base exception
- `AuthenticationError`: Auth-specific errors
- `AccountLockedError`: Account lockout situations
- Standardized error codes for client-side handling

**Circuit Breaker Pattern**: Prevents cascading failures for:
- ML Service (AI model)
- AWS S3 (file storage)

**Retry Logic**: Exponential backoff retry for external services:
- Configurable attempt counts
- Progressive delay increases
- Prevents overwhelming external services

**Graceful Degradation**: System continues functioning when external services are unavailable

### Evidence & Data Protection

- **S3 Integration**: AWS S3 for encrypted evidence storage
- **Local Fallback**: Local filesystem (`uploads/`) + SQLite for offline capability
- **SHA-256 Hashing**: All evidence files hashed for integrity verification
- **Chain of Custody**: Audit trails for evidence handling

### Audit & Monitoring

- **Enhanced Audit Logging**: Non-blocking security event logging
- **Prometheus Metrics**:
  - `auth_attempts_total`: Total authentication attempts
  - `auth_tokens_issued_total`: Tokens issued count
- **Structured Logging**: JSON-formatted logs with security event context
- **Client IP Tracking**: All events include originating client IP

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+) – for frontends
- Python (v3.10+) – for backend
- Docker & Docker Compose (optional, for containerized deployment)

### Installation & Run

#### 1. Clone the Repository

```bash
git clone https://github.com/Neil2813/CTM.git
cd CTM
```

#### 2. Run with Docker (Recommended)

The easiest way to spin up all services:

```bash
docker-compose up --build
```

#### 3. Manual Setup

**Backend**:
```bash
cd Backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python run.py
```

**Client-Side Frontend** (Victim Portal):
```bash
cd Client_Side_Frontend
npm install
npm run dev
```

**Server-Side Frontend** (Police Dashboard):
```bash
cd Sever_Side_Frontend
npm install
npm run dev
```

**BNS Generator Frontend** (AI Model Interface):
```bash
cd BNS_Generator_Frontend
npm install
npm run dev
```

### CORS & Development URLs

The backend allows requests from common development origins by default (when `ENV` is `local` or `dev`):

- **Client (Victim) portal**: `http://localhost:5173`, `http://127.0.0.1:5173`
- **Server (Cop/Admin) dashboard**: `http://localhost:4173`, `http://127.0.0.1:4173`
- **BNS Generator**: `http://localhost:8080`, `http://127.0.0.1:8080`

To allow additional origins, set `ALLOWED_ORIGINS_RAW` in `Backend/.env` (comma-separated):

```env
ALLOWED_ORIGINS_RAW=http://localhost:5173,http://localhost:4173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:4173,http://127.0.0.1:8080
```

### Default Ports

| Service | Port |
|---------|------|
| Backend API | 8000 |
| Client-side frontend | 5173 |
| Server-side frontend | 4173 |
| BNS Generator frontend | 8080 |

### Environment Configuration

Create `.env` files in respective directories:

**Backend/.env**:
```env
ENV=local
DATABASE_URL=sqlite:///./crime_tracer.db
ALLOWED_ORIGINS_RAW=http://localhost:5173,http://localhost:4173,http://localhost:8080
FIREBASE_CREDENTIALS_PATH=
FIREBASE_PROJECT_ID=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

**Frontend .env files**:
```env
VITE_API_URL=http://localhost:8000
```

---

## 📡 API Wireframe

### Victim Flows

#### Authentication
- `POST /api/auth/victim/register` – Register new victim account
- `POST /api/auth/token` – Login (victim or cop)

#### Profile Management
- `GET /api/victim/profile` – Retrieve victim profile
- `PUT /api/victim/profile` – Update victim profile

#### File Complaint
- `POST /api/victim/complaints` – File new complaint
  - Backend processes:
    - Generates `complaint_id` (CTMYYYYMMDDHHMMSSfff format)
    - Stores complaint + evidence with S3 hash
    - Calls Grok for AI analysis (precautions, BNS suggestions)
    - Saves LLM summary, BNS sections, precautions
    - Creates initial status history (NotAssigned)

#### Track Complaint
- `GET /api/victim/complaints/by-id/{complaint_id}` – Get complaint by ID
- `GET /api/victim/complaints/by-phone/{phone}` – Get complaint by phone
  - Returns: Status, assigned officer, victim-visible notes, AI analysis, precautions

#### Confirm Resolution
- `POST /api/victim/complaints/confirm` – Confirm or reject resolution
  - `resolved=True` → Status Closed
  - `resolved=False` → Status Investigating
  - 24-hour window enforced

### Cop & Admin Flows

#### Cop Authentication
- `POST /api/auth/cop/register` – Register cop (pending_approval=True)
- `POST /api/auth/token` – Login (after admin approval)

#### Admin Operations
- `GET /api/admin/cops/pending` – List pending cop approvals
- `POST /api/admin/cops/approve` – Approve cop account
- `GET /api/admin/cops/transfers` – List pending transfer requests
- `POST /api/admin/cops/transfers/decide` – Accept/reject transfer
- `GET /api/stats/overview` – Global statistics overview

#### Cop Dashboard
- `GET /api/cases/unassigned` – List unassigned complaints
- `POST /api/cases/assign` – Assign complaint to officer
- `GET /api/cases/my` – Get officer's assigned cases
- `POST /api/cases/status` – Update case status (Investigating/Resolved/Rejected)
- `POST /api/cases/notes` – Add internal or victim-visible notes
- `GET /api/stats/station` – Station-level statistics

#### Cop Profile & Transfers
- `GET /api/cop/me/transfer-requests` – List officer's transfer requests
- `POST /api/cop/me/transfer-requests` – Submit transfer request

#### Evidence Management
- `POST /api/uploads/evidence/{complaint_id}` – Upload evidence (multipart)
  - Supported formats: Images (PNG, JPG, JPEG, GIF), PDFs, CSV, DOCX
  - Returns: File metadata, S3 URL (or local path), SHA-256 hash

---

## 💾 Tech Stack Details

### Backend Stack

| Technology | Purpose | Version |
|-----------|---------|---------|
| Python | Core language | 3.10+ |
| FastAPI | Web framework | Latest |
| SQLAlchemy | ORM | 2.x |
| Alembic | Database migrations | Latest |
| OAuth2 & JWT | Authentication | python-jose |
| passlib[bcrypt] | Password hashing | Latest |
| Pydantic | Data validation | v2 |
| Firebase Admin SDK | Firebase integration | Latest |
| boto3 | AWS S3 integration | Latest |
| redis-py | Redis caching | Latest |

### Frontend Stack

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI framework | 18+ |
| TypeScript | Type safety | 5+ |
| Vite | Build tool | 5+ |
| TailwindCSS | Utility CSS framework | 3+ |
| shadcn/ui | Component library | Latest |
| React Router | Client routing | v6 |
| React Hook Form | Form management | Latest |
| Zod | Schema validation | Latest |
| Axios | HTTP client | Latest |
| Framer Motion | Animations | Latest |
| Recharts | Charts & graphs | Latest |
| react-hot-toast | Toast notifications | Latest |
| @tanstack/react-query | Data fetching | Latest |
| Lucide Icons | Icon library | Latest |

### AI/ML Stack

| Technology | Purpose |
|-----------|---------|
| PyTorch | Deep learning framework |
| Transformers (HuggingFace) | Pre-trained models (Legal-BERT) |
| Sentence Transformers | Embedding models |
| FAISS | Vector similarity search |
| PyTorch Geometric | Graph neural networks |
| scikit-learn | Machine learning utilities |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| Nginx | Reverse proxy & web server |
| PostgreSQL | Relational database (optional) |
| Firebase Firestore | Cloud database |
| AWS S3 | Cloud file storage |
| GitHub Actions | CI/CD pipelines |
| Prometheus | Metrics & monitoring |

---

## 📚 Additional Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) – Production deployment guide
- [security.md](./security.md) – Threat models and security protocols
- [Backend/QUICK_START.md](./Backend/QUICK_START.md) – Backend quick start
- [Backend/TESTING.md](./Backend/TESTING.md) – Testing guide
- [Backend/MIGRATION_GUIDE.md](./Backend/MIGRATION_GUIDE.md) – Database migration guide


*Last Updated: April 2026*
