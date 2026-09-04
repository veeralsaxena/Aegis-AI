# 🛡️ Aegis AI - The Intelligent EHR

> **"Every team has AI agents. Ours save lives."**

---

## The Problem: A Doctor's Nightmare

It's 2:00 AM. Dr. Priya is on hour 14 of her shift in a busy Mumbai hospital. She has seen 47 patients today. She is exhausted.

Mr. Sharma, 68 years old, walks in with chest pain and an irregular heartbeat. Dr. Priya quickly examines him and reaches for the prescription pad. The standard treatment: **Amiodarone** for the arrhythmia.

What Dr. Priya doesn't remember at 2 AM — buried 3 pages deep in Mr. Sharma's chart — is that he is already on **Ciprofloxacin** for a urinary infection, his **potassium is 3.1 mEq/L** (dangerously low), and his **creatinine is 2.8 mg/dL** (Stage 4 kidney disease).

If that Amiodarone prescription goes through:
- **Ciprofloxacin + Amiodarone** = Critical QTc prolongation → Cardiac arrest risk
- **GFR of 22 mL/min** = The drug cannot be cleared by his kidneys
- **Hypokalemia** = Amplifies the cardiac toxicity by 2x

> [!CAUTION]
> **In a traditional EHR, this prescription goes through with zero warnings. Mr. Sharma's life depends entirely on a fatigued doctor's memory.**

**Aegis AI exists so this never happens.**

---

## The Solution: Three AI Agents, One Mission

Aegis AI is not a chatbot bolted onto a medical record. It is a **coordinated swarm of autonomous AI agents** deeply embedded inside a real, working Electronic Health Record (Bahmni/OpenMRS).

```mermaid
graph TB
    subgraph "🏥 Aegis AI Ecosystem"
        direction TB
        
        subgraph "Layer 1: The EHR Foundation"
            EHR[" <br/>Real Patient Records<br/>Real Prescriptions<br/>Real Lab Results"]
        end
        
        subgraph "Layer 2: The AI Agent Swarm"
            A1["🎙️ Agent 1<br/>Ambient Scribe<br/><i>Voice → Clinical Note</i>"]
            A2["🧠 Agent 2<br/>Differential Diagnosis<br/><i>Symptoms → Ranked Diagnoses</i>"]
            A3["💊 Agent 3<br/>Drug Safety Guardian<br/><i>LangGraph State Machine</i>"]
        end
        
        subgraph "Layer 3: External Medical Intelligence"
            R["💎 NLM RxNav<br/>Drug Normalization"]
            F["📋 FDA openFDA<br/>Label Warnings"]
            C["❤️ CredibleMeds<br/>QTc Risk Database"]
            N["🔬 NLM ClinicalTables<br/>ICD-10 Codes"]
            W["🎤 Whisper STT<br/>Speech Recognition"]
        end
        
        subgraph "Layer 4: Governance"
            AR["🛡️ ArmorIQ<br/>Policy Enforcement"]
        end
    end
    
    EHR <--> A1
    EHR <--> A2
    EHR <--> A3
    A1 <--> W
    A2 <--> N
    A3 <--> R
    A3 <--> F
    A3 <--> C
    A3 --> AR
    
    style A3 fill:#dc2626,stroke:#991b1b,color:#fff
    style AR fill:#7c3aed,stroke:#5b21b6,color:#fff
    style EHR fill:#0ea5e9,stroke:#0284c7,color:#fff
```

---

## Agent 1: The Ambient Scribe 🎙️

> *The doctor talks. The AI documents.*

### What It Does
The doctor walks into the room, sits down, and simply **talks to the patient**. No keyboard. No clicking. No drop-down menus. In the background, Aegis AI captures every word.

### How It Actually Works

```mermaid
sequenceDiagram
    participant D as 👩‍⚕️ Doctor
    participant UI as 🖥️ Aegis Frontend
    participant API as ⚙️ Scribe Router
    participant WH as 🎤 Whisper Engine
    participant B as 🗄️ backend
    participant LLM as 🤖 Gemini LLM
    
    D->>UI: Records consultation audio
    UI->>API: POST /api/scribe/transcribe-and-generate
    
    Note over API: Audio or pasted transcript?
    
    alt Audio Recording
        API->>WH: Send audio bytes
        Note over WH: faster-whisper (local)<br/>beam_size=7, VAD filter<br/>Medical vocabulary primed
        WH-->>API: Raw transcript text
    else Pasted Transcript
        Note over API: Skip Whisper,<br/>use text directly
    end
    
    API->>B: GET /patient/{uuid} (age, sex)
    API->>B: GET /condition (active diagnoses)
    API->>B: GET /order (current medications)
    B-->>API: Real patient context
    
    API->>LLM: Transcript + Patient Context
    Note over LLM: Generate consultation draft:<br/>• SOAP Note<br/>• Speaker Attribution<br/>• Medication Extraction<br/>• Lab Order Suggestions<br/>• Red Flags<br/>• Disposition
    LLM-->>API: Structured JSON draft
    
    Note over API: Normalize + merge with<br/>regex fallback extractor<br/>(1149 lines of NLP)
    
    API->>B: Persist draft to database
    API-->>UI: Complete consultation draft
    UI-->>D: Editable clinical note
    
    D->>UI: Reviews, edits, accepts
    UI->>API: PATCH /accept
```

### The Secret Sauce: Hybrid NLP
Most scribe systems send audio to an LLM and return whatever it says. **Aegis AI runs a 1,149-line deterministic NLP pipeline in parallel:**

| Feature | LLM-Only Approach | Aegis AI Hybrid |
|---|---|---|
| Drug name extraction | Hopes the LLM catches it | Regex matches drug suffixes (`-mycin`, `-cillin`, `-pril`, `-sartan`) |
| Hindi-English mixing | Often garbled | Dedicated transliteration normalization layer |
| Whisper misheards | "has been you" stays wrong | Auto-corrects to "has dengue" via medical vocabulary map |
| LLM quota exceeded | **System crashes** | Deterministic fallback generates full draft from transcript alone |

> [!IMPORTANT]
> **If Gemini goes down, the Scribe still works.** The fallback extracts SOAP sections, medications, labs, and diagnoses entirely from regex and heuristic analysis.

---

## Agent 2: Differential Diagnosis Engine 🧠

> *An invisible second opinion for every doctor, every visit.*

### What It Does
Given a chief complaint and a patient, it generates **3-5 ranked differential diagnoses** with reasoning, red flags, and recommended investigations — grounded in the patient's actual EHR data.

### How It Actually Works

```mermaid
flowchart LR
    subgraph "Input: Real Patient Data from Bahmni"
        P["👤 Patient Profile<br/>Age: 68, Male"]
        V["📊 Vitals<br/>BP: 150/95, Temp: 37.2°C"]
        L["🔬 Labs<br/>Creatinine: 2.8<br/>Hemoglobin: 10.2"]
        C["📋 Conditions<br/>Hypertension, CKD Stage 4"]
        M["💊 Medications<br/>Ciprofloxacin, Amlodipine"]
    end
    
    subgraph "AI Processing"
        CC["Chief Complaint:<br/>'Chest pain, irregular heartbeat'"]
        LLM["🤖 Gemini LLM<br/>with clinical system prompt"]
    end
    
    subgraph "Output: Ranked Differentials"
        D1["🥇 Rank 1: Atrial Fibrillation<br/>ICD-10: I48.91<br/>Confidence: HIGH<br/>🚩 Red Flag: Hemodynamic instability"]
        D2["🥈 Rank 2: Acute Coronary Syndrome<br/>ICD-10: I21.9<br/>Confidence: MEDIUM<br/>🚩 Red Flag: ST changes on ECG"]
        D3["🥉 Rank 3: Hypertensive Emergency<br/>ICD-10: I16.1<br/>Confidence: MEDIUM"]
    end
    
    P & V & L & C & M --> CC --> LLM --> D1 & D2 & D3
    
    style D1 fill:#dc2626,stroke:#991b1b,color:#fff
    style LLM fill:#7c3aed,stroke:#5b21b6,color:#fff
```

### ICD-10 Validation
Every diagnosis suggestion is cross-referenced against the **NLM ClinicalTables API** to attach a validated ICD-10 code — not a hallucinated one.

---

## Agent 3: The Drug Safety Guardian 💊



### What It Does
The moment a doctor prescribes a drug, this agent **autonomously launches a 5-step pharmacological safety investigation** using real medical databases and real patient data. It can **BLOCK** a dangerous prescription before it ever reaches the patient.

### The LangGraph State Machine

```mermaid
stateDiagram-v2
    [*] --> Agent: Doctor prescribes drug
    
    Agent --> Tools: LLM decides which tool to call
    Tools --> Agent: Tool returns result
    
    Agent --> Tools: LLM calls next tool
    Tools --> Agent: Result feeds back
    
    Agent --> Decision: All tools complete
    Decision --> BLOCK: Life-threatening risk
    Decision --> WARN: Caution needed
    Decision --> SAFE: No issues found
    
    BLOCK --> WebSocket: Push real-time alert
    WARN --> WebSocket: Push real-time alert
    SAFE --> [*]: No action needed
    
    WebSocket --> DoctorUI: 🔴 Alert flashes on screen
    
    note right of Agent
        LangGraph Agent Node
        Gemini LLM with 5 bound tools
        Autonomous tool selection
        Up to 40 recursion cycles
    end note
    
    note right of Tools
        5 Real Medical APIs:
        1. RxNorm Normalize
        2. FDA Label Lookup
        3. GFR Calculation
        4. Drug Interactions
        5. QTc Risk Score
    end note
```

### The 5-Tool Deep Investigation

```mermaid
sequenceDiagram
    participant DR as 👩‍⚕️ Doctor
    participant UI as 🖥️ Frontend
    participant API as ⚙️ Alert Router
    participant AGENT as 🤖 LangGraph Agent
    participant RX as 💎 NLM RxNav
    participant FDA as 📋 FDA openFDA
    participant GFR as 🧮 GFR Calculator
    participant INT as ⚠️ Interaction Checker
    participant QTC as ❤️ QTc Risk Scorer
    participant B as 🗄️ Bahmni EHR
    participant WS as 📡 WebSocket
    
    DR->>UI: Prescribes "Amiodarone"
    UI->>API: POST /api/alerts/check-drug
    API->>AGENT: Launch LangGraph execution
    
    rect rgb(30, 58, 95)
        Note over AGENT,QTC: 🔬 Step 1: Drug Normalization
        AGENT->>RX: rxnorm_normalize("Amiodarone")
        RX-->>AGENT: RxCUI: 703, Ingredient: amiodarone
    end
    
    rect rgb(95, 30, 30)
        Note over AGENT,QTC: 🔬 Step 2: FDA Label Analysis
        AGENT->>FDA: fda_label_lookup("amiodarone")
        FDA-->>AGENT: ⚠️ BOXED WARNING: Pulmonary toxicity,<br/>hepatotoxicity, proarrhythmia.<br/>Contraindicated in severe sinus-node dysfunction.
    end
    
    rect rgb(30, 95, 40)
        Note over AGENT,QTC: 🔬 Step 3: Kidney Function Check
        AGENT->>B: GET Creatinine, Weight, Age, Sex
        B-->>GFR: Creatinine: 2.8, Age: 68, Weight: 72kg, Male
        GFR-->>AGENT: ⚠️ GFR = 22 mL/min (Stage G4)<br/>Severe renal impairment
    end
    
    rect rgb(95, 70, 30)
        Note over AGENT,QTC: 🔬 Step 4: Drug Interaction Scan
        AGENT->>B: GET active drug orders
        B-->>INT: Active: Ciprofloxacin, Amlodipine
        INT->>RX: Normalize each active drug
        INT->>RX: Check interactions (703 + active RxCUIs)
        RX-->>AGENT: 🚨 HIGH: Ciprofloxacin + Amiodarone<br/>= QTc prolongation, cardiac arrest risk
    end
    
    rect rgb(95, 30, 70)
        Note over AGENT,QTC: 🔬 Step 5: QTc Cardiac Risk
        AGENT->>B: GET Potassium, Magnesium levels
        B-->>QTC: K⁺ = 3.1 mEq/L (LOW)
        QTC-->>AGENT: 🚨 CRITICAL: 2 QTc drugs + hypokalemia<br/>Combined risk = CRITICAL<br/>Torsades de Pointes risk
    end
    
    Note over AGENT: 🧠 LLM Synthesis:<br/>GFR 22 + High interaction +<br/>Critical QTc + FDA boxed warning<br/>= BLOCK + CRITICAL
    
    AGENT-->>API: Decision: BLOCK, Severity: CRITICAL
    API->>B: Persist alert to database
    API->>WS: Push real-time alert
    WS->>UI: 🔴 CRITICAL ALERT
    UI->>DR: "BLOCKED: Amiodarone — Critical QTc risk<br/>with Ciprofloxacin + Hypokalemia.<br/>GFR 22 mL/min contraindicates standard dosing."
    
    DR->>UI: Acknowledges alert, changes plan
    Note over DR: Mr. Sharma is safe. ✅
```

### What Makes This Different From Everyone Else

```mermaid
graph LR
    subgraph "❌ What Other Teams Build"
        direction TB
        O1["User types prompt"] --> O2["LLM generates response"] --> O3["Display to user"]
    end
    
    subgraph "✅ What Aegis AI Builds"
        direction TB
        A1["Doctor prescribes drug"] --> A2["Agent calls RxNav API"]
        A2 --> A3["Agent calls FDA API"]
        A3 --> A4["Agent reads REAL<br/>patient labs from EHR"]
        A4 --> A5["Agent computes GFR<br/>using Cockcroft-Gault"]
        A5 --> A6["Agent checks drug<br/>interactions via RxNav"]
        A6 --> A7["Agent checks QTc risk<br/>via CredibleMeds DB"]
        A7 --> A8["LLM synthesizes<br/>all 5 tool results"]
        A8 --> A9["BLOCK / WARN / SAFE"]
        A9 --> A10["Real-time WebSocket<br/>alert to doctor"]
    end
    
    style O1 fill:#64748b,stroke:#475569,color:#fff
    style O2 fill:#64748b,stroke:#475569,color:#fff
    style O3 fill:#64748b,stroke:#475569,color:#fff
    
    style A1 fill:#0ea5e9,stroke:#0284c7,color:#fff
    style A5 fill:#f59e0b,stroke:#d97706,color:#fff
    style A8 fill:#7c3aed,stroke:#5b21b6,color:#fff
    style A9 fill:#dc2626,stroke:#991b1b,color:#fff
    style A10 fill:#dc2626,stroke:#991b1b,color:#fff
```

> [!IMPORTANT]
> ### The Key Differentiator
> | Metric | Typical Hackathon AI | Aegis AI Drug Safety |
> |---|---|---|
> | External API calls per action | **1** (just the LLM) | **5+** (RxNav, FDA, GFR, Interactions, QTc) |
> | Uses real patient data? | ❌ Mock/demo data | ✅ Live from Bahmni EHR |
> | Clinical math? | ❌ None | ✅ Cockcroft-Gault GFR formula |
> | Works if LLM is down? | ❌ Crashes | ✅ Full deterministic fallback |
> | Architecture | Simple API call | LangGraph state machine (636 lines) |
> | Alert delivery | Page refresh | Real-time WebSocket push |

---

## The Failsafe: When AI Goes Down, Safety Stays Up

> [!WARNING]
> **What happens when Gemini returns a 429 (quota exceeded)?**

Most AI systems crash. Aegis AI has a **complete deterministic fallback** that runs the same 5-tool investigation without any LLM:

```mermaid
flowchart TD
    START["Doctor prescribes drug"] --> GRAPH["Launch LangGraph Agent"]
    
    GRAPH -->|Success| LLM_SYNTH["LLM synthesizes<br/>tool results into<br/>BLOCK/WARN/SAFE"]
    GRAPH -->|Gemini 429 Error<br/>Quota Exceeded<br/>Network Timeout| FALLBACK["🔄 Deterministic Fallback<br/>_run_fallback_assessment()"]
    
    FALLBACK --> T1["Tool 1: rxnorm_normalize"]
    T1 --> T2["Tool 2: fda_label_lookup"]
    T2 --> T3["Tool 3: calculate_gfr"]
    T3 --> T4["Tool 4: drug_interactions"]
    T4 --> T5["Tool 5: qtc_risk_score"]
    
    T5 --> RULES["Rule-Based Escalation Engine"]
    
    RULES -->|"High-severity interaction"| BLOCK1["BLOCK + HIGH"]
    RULES -->|"GFR < 15"| BLOCK2["BLOCK + CRITICAL"]
    RULES -->|"QTc CRITICAL"| BLOCK3["BLOCK + CRITICAL"]
    RULES -->|"Moderate interaction"| WARN1["WARN + MODERATE"]
    RULES -->|"No issues"| SAFE["SAFE + LOW"]
    
    LLM_SYNTH --> ALERT["Push alert to UI"]
    BLOCK1 & BLOCK2 & BLOCK3 & WARN1 --> ALERT
    
    style FALLBACK fill:#f59e0b,stroke:#d97706,color:#000
    style BLOCK1 fill:#dc2626,stroke:#991b1b,color:#fff
    style BLOCK2 fill:#dc2626,stroke:#991b1b,color:#fff
    style BLOCK3 fill:#dc2626,stroke:#991b1b,color:#fff
    style SAFE fill:#16a34a,stroke:#15803d,color:#fff
```

> [!TIP]
> **Pitch line:** *"Our safety system is more reliable than the AI itself. Even when the model is completely offline, the deterministic fallback still catches every dangerous prescription."*

---

## The Governance Layer: ArmorIQ 🛡️

Every agent action passes through the **ArmorIQ Interceptor** — a policy enforcement layer that ensures no AI agent can act autonomously beyond defined boundaries.

```mermaid
flowchart LR
    subgraph "AI Agent Action"
        AGENT["🤖 AI Agent wants to<br/>ORDER_MEDICATION"]
    end
    
    subgraph "ArmorIQ Sentinel"
        INTERCEPT["🛡️ Intercept Intent"]
        POLICY["📜 Check YAML Policies"]
        AUDIT["📝 Cryptographic Audit Log"]
    end
    
    subgraph "Decision"
        ALLOW["✅ ALLOW<br/>Action proceeds"]
        DENY["🚫 DENY<br/>Action blocked +<br/>Doctor notified"]
    end
    
    AGENT --> INTERCEPT
    INTERCEPT --> POLICY
    POLICY -->|"No violation"| ALLOW
    POLICY -->|"Policy MED-001<br/>violated"| DENY
    INTERCEPT --> AUDIT
    
    style INTERCEPT fill:#7c3aed,stroke:#5b21b6,color:#fff
    style DENY fill:#dc2626,stroke:#991b1b,color:#fff
    style ALLOW fill:#16a34a,stroke:#15803d,color:#fff
```

### Why ArmorIQ Matters
| Without ArmorIQ | With ArmorIQ |
|---|---|
| Developer writes `if/else` safety rules | Compliance Officer writes YAML policies |
| Changing a rule = code change + redeploy | Changing a rule = edit a YAML file |
| No audit trail | Cryptographic, tamper-proof audit trail |
| Rules are scattered across the codebase | Single governance dashboard |

---

## The Complete Data Flow: End to End

```mermaid
flowchart TB
    subgraph "👩‍⚕️ Doctor's Workflow"
        D1["1. Doctor speaks<br/>to patient"]
        D2["2. Reviews AI-generated<br/>clinical note"]
        D3["3. Prescribes medication"]
        D4["4. Sees real-time<br/>safety alert"]
        D5["5. Adjusts treatment"]
    end
    
    subgraph "🤖 Aegis AI Backend"
        S["🎙️ Ambient Scribe"]
        DIFF["🧠 Differential Engine"]
        DS["💊 Drug Safety Agent"]
    end
    
    subgraph "🗄️ Data Layer"
        BAHMNI["Bahmni EHR<br/>(Real patients, labs, meds)"]
        DB["SQLite/Postgres<br/>(Drafts, alerts, audit)"]
    end
    
    subgraph "🌐 External APIs"
        WHISPER["Whisper STT"]
        GEMINI["Gemini LLM"]
        RXNAV["NLM RxNav"]
        OPENFDA["FDA openFDA"]
        CREDIBLE["CredibleMeds"]
        NLM["NLM ClinicalTables"]
    end
    
    D1 -->|Audio| S
    S --> WHISPER
    S --> GEMINI
    S --> BAHMNI
    S -->|SOAP Draft| D2
    
    D2 -->|Chief complaint| DIFF
    DIFF --> BAHMNI
    DIFF --> GEMINI
    DIFF --> NLM
    DIFF -->|Ranked diagnoses| D2
    
    D3 -->|Drug name| DS
    DS --> RXNAV
    DS --> OPENFDA
    DS --> CREDIBLE
    DS --> BAHMNI
    DS --> GEMINI
    DS -->|BLOCK alert| D4
    
    D4 --> D5
    
    S --> DB
    DIFF --> DB
    DS --> DB
    
    style DS fill:#dc2626,stroke:#991b1b,color:#fff
    style S fill:#0ea5e9,stroke:#0284c7,color:#fff
    style DIFF fill:#7c3aed,stroke:#5b21b6,color:#fff
    style BAHMNI fill:#f59e0b,stroke:#d97706,color:#000
```

---

## Technical Stack

| Layer | Technology | Why |
|---|---|---|
| **EHR Backend** | Node express(Docker) | Industry-standard open-source EMR |
| **AI Backend** | FastAPI + Python 3.12 | Async-first, production-ready |
| **Agent Framework** | LangGraph + LangChain | Google-backed agentic AI framework |
| **LLM** | Gemini 2.0 Flash (with fallback) | Fast, capable, free tier |
| **Speech-to-Text** | faster-whisper (local) / OpenAI Whisper | On-device privacy, no cloud dependency |
| **Frontend** | Next.js 15 + TypeScript | Modern, responsive, real-time |
| **Real-time Alerts** | WebSocket (FastAPI native) | Sub-second alert delivery |
| **Drug Database** | NLM RxNav + FDA openFDA | Gold-standard medical APIs |
| **Cardiac Risk** | CredibleMeds QTc Database | Authoritative cardiac safety source |
| **Governance** | ArmorIQ Sentinel Layer | Policy-as-code for AI actions |

---

## The Numbers That Matter

| Metric | Value |
|---|---|
| Lines of production Python (ai-agents/) | **~4,500+** |
| Lines of production TypeScript (frontend/) | **~15,000+** |
| External medical APIs integrated | **5** (RxNav, FDA, ClinicalTables, CredibleMeds, Bahmni) |
| LangGraph tool nodes | **5** autonomous tools |
| Drug Safety Agent code | **636 lines** of LangGraph state machine |
| Ambient Scribe NLP pipeline | **1,149 lines** of hybrid LLM + deterministic extraction |
| Whisper STT modes | **3** (local faster-whisper, OpenAI API, WhisperX with diarization) |
| Real-time alert delivery | **WebSocket** (sub-second) |
| Fallback coverage | **100%** — deterministic engine runs even if LLM is offline |

---

## The Closing Argument


>
> *Because in healthcare, the AI isn't the product. **Patient safety is the product.** The AI is just the tool we use to deliver it."*

---

<p align="center">
  <b>Aegis AI</b> — Putting the 'care' back into healthcare.
</p>
