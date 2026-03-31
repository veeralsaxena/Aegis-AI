# 🧬 AI Agents in Healthcare — Research Foundation for Aegis AI

> **Curated Research Library** | Maintained by the **Aegis AI Team** | Last Updated: March 2026

[![Aegis AI](https://img.shields.io/badge/Aegis_AI-Healthcare_Platform-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAyTDIgN2wxMCA1IDEwLTV6Ii8+PC9zdmc+)](https://github.com/veeralsaxena/Aegis-AI)
![Research Papers](https://img.shields.io/badge/Papers-400%2B-green?style=for-the-badge)
![AI Agents](https://img.shields.io/badge/AI_Agents-Multi--Agent_Systems-purple?style=for-the-badge)

---

This document serves as Aegis AI's **research foundation** — a comprehensive catalog of peer-reviewed papers, open-source projects, and benchmarks that inform and validate our multi-agent healthcare architecture. Every agent in Aegis AI's 11-agent ecosystem is grounded in the cutting-edge research documented here.

## Why This Matters for Aegis AI

Aegis AI's architecture is not built in a vacuum. Each of our AI agents — from the **Chart Prep Agent** to the **Post-Discharge RAG Chatbot** — draws from established research in:

- **Multi-Agent Collaboration** for clinical decision-making
- **Ambient Clinical Documentation** (medical scribes)
- **Clinical Decision Support** with drug interaction detection
- **Revenue Cycle Automation** (medical coding, claims, denials)
- **Post-Discharge Patient Engagement** and triage
- **RAG-based Medical Question Answering**

---

## Table of Contents

- [1. Doctor-Facing Agents](#1-doctor-facing-agents)
  - [1.1 Multi-Modal Clinical Agents](#11-multi-modal-clinical-agents)
  - [1.2 Radiology Agents](#12-radiology-agents)
  - [1.3 Pathology Agents](#13-pathology-agents)
  - [1.4 EHR & Clinical Note Agents](#14-ehr--clinical-note-agents)
  - [1.5 Reasoning & Multi-Agent Techniques](#15-reasoning--multi-agent-techniques)
- [2. Patient-Facing Applications](#2-patient-facing-applications)
  - [2.1 Mental Health & CBT Agents](#21-mental-health--cbt-agents)
  - [2.2 Clinical Communication & Intake Agents](#22-clinical-communication--intake-agents)
  - [2.3 Screening & Personalized Care Agents](#23-screening--personalized-care-agents)
- [3. Drug Discovery & Development](#3-drug-discovery--development)
- [4. Healthcare Administration & Workflow](#4-healthcare-administration--workflow)
- [5. Datasets & Benchmarks](#5-datasets--benchmarks)
- [6. Related Surveys](#6-related-surveys)
- [7. Open-Source Projects & Tools](#7-open-source-projects--tools)

---

## 1. Doctor-Facing Agents

### 1.1 Multi-Modal Clinical Agents
*Agents that process and reason over multiple data types — images, text, structured EHR data*

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **Meissa: Multi-modal Medical Agentic Intelligence** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2603.09018) · [GitHub](https://github.com/Schuture/Meissa) |
| **CARE: Clinical Accountability in Multi-Modal Medical Reasoning** | ICLR | 2026 | [Paper](https://arxiv.org/abs/2603.01607) |
| **3DMedAgent: Unified Perception-to-Understanding for 3D Medical Analysis** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2602.18064) |
| **CoMMa: Contribution-Aware Medical Multi-Agents (Game-Theoretic)** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2602.09159) |
| **MedSAM-Agent: Interactive Medical Image Segmentation with Agentic RL** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2602.03320) · [GitHub](https://github.com/CUHK-AIM-Group/MedSAM-Agent) |
| **MedAgent-Pro: Evidence-based Multi-modal Medical Diagnosis** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2503.18968) · [GitHub](https://github.com/jinlab-imvr/MedAgent-Pro) |
| **MDAgents: Adaptive Collaboration of LLMs for Medical Decision-Making** | NeurIPS (Oral) | 2024 | [Paper](https://proceedings.neurips.cc/paper_files/paper/2024/hash/90d1fc07f46e31387978b88e7e057a31-Abstract-Conference.html) · [GitHub](https://github.com/mitmedialab/MDAgents) |
| **MMedAgent: Learning to Use Medical Tools with Multi-modal Agent** | EMNLP Findings | 2024 | [Paper](https://aclanthology.org/2024.findings-emnlp.510/) · [GitHub](https://github.com/Wangyixinxin/MMedAgent) |

### 1.2 Radiology Agents
*AI agents for CT, X-ray, MRI interpretation and report generation*

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **DUCX: Decomposing Unfairness in Tool-Using Chest X-ray Agents** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2603.00777) |
| **Which Tool Response Should I Trust? Tool-Expertise-Aware CXR Agent** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2602.21517) |
| **RadFabric: Agentic AI System with Reasoning for Radiology** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2506.14142) |
| **MedRAX: Medical Reasoning Agent for Chest X-ray** | ICML | 2025 | [Paper](http://arxiv.org/abs/2502.02673v2) · [GitHub](https://github.com/bowang-lab/MedRAX) |
| **Radiologist Copilot: Agentic AI for Holistic Radiology Reporting** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2512.02814) |
| **AT-CXR: Uncertainty-Aware Agentic Triage for Chest X-rays** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2508.19322) |

### 1.3 Pathology Agents

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **CPathAgent: Agent-based Foundation Model for Pathology Image Analysis** | NeurIPS | 2025 | [Paper](http://arxiv.org/abs/2505.20510v1) |
| **PathFinder: Multi-Modal Multi-Agent System for Histopathology** | ICCV | 2025 | [Paper](https://arxiv.org/abs/2502.08916) · [GitHub](https://github.com/ghezloo/PathFinder) |
| **WSI-Agents: Collaborative Multi-Agent System for Whole Slide Image Analysis** | MICCAI (Oral) | 2025 | [Paper](https://arxiv.org/abs/2507.14680) · [GitHub](https://github.com/XinhengLyu/WSI-Agents) |
| **Pathgen-1.6M: 1.6M pathology image-text pairs via multi-agent collaboration** | ICLR (Oral) | 2024 | [Paper](https://arxiv.org/abs/2407.00203) · [GitHub](https://github.com/PathFoundation/PathGen-1.6M) |

### 1.4 EHR & Clinical Note Agents
*Agents for Electronic Health Record manipulation, clinical coding, and note generation — directly relevant to Aegis AI's Chart Prep and Ambient Scribe agents*

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **TRACE: Temporal Reasoning via Agentic Context Evolution for Streaming EHRs** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2602.12833) |
| **AgentEHR: Autonomous Clinical Decision-Making via Retrospective Summarization** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2601.13918) |
| **Hybrid-Code: Privacy-Preserving Multi-Agent Framework for Clinical Coding** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2512.23743) |
| **MedDCR: Learning to Design Agentic Workflows for Medical Coding** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2511.13361) |
| **Automated Clinical Problem Detection from SOAP Notes using Multi-Agent LLM** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2508.21803v1) |
| **CARE-AD: Multi-Agent LLM Framework for Alzheimer's Disease Prediction** | npj Digital Medicine | 2025 | [Paper](https://www.nature.com/articles/s41746-025-01940-4) |
| **EHRAgent: Code-Empowered LLMs for Tabular Reasoning on EHRs** | EMNLP | 2024 | [Paper](https://aclanthology.org/2024.emnlp-main.1245/) |
| **FHIR-AgentBench: Benchmarking LLM Agents for EHR Question Answering** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2509.19319) · [GitHub](https://github.com/glee4810/FHIR-AgentBench) |

### 1.5 Reasoning & Multi-Agent Techniques
*Core techniques powering Aegis AI's Clinical Decision Support and diagnostic agents*

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **From Conflict to Consensus: Multi-Round Agentic RAG for Medical Reasoning** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2603.03292) · [GitHub](https://github.com/NJU-RL/MA-RAG) |
| **MedCollab: Causal-Driven Multi-Agent Diagnosis** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2603.01131) |
| **EvoClinician: Self-Evolving Agent for Multi-Turn Medical Diagnosis** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2601.22964) · [GitHub](https://github.com/yf-he/EvoClinician) |
| **Scaling Medical Reasoning Verification via Tool-Integrated RL** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2601.20221) |
| **MDTeamGPT: Self-Evolving LLM Multi-Agent for Multi-Disciplinary Team Consultation** | EMNLP | 2025 | [Paper](http://arxiv.org/abs/2503.13856v1) · [GitHub](https://github.com/KaiChenNJ/MDTeamGPT) |
| **TxAgent: AI Agent for Therapeutic Reasoning** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2503.10970v1) · [GitHub](https://github.com/mims-harvard/TxAgent) |
| **ReflecTool: Reflection-Aware Tool-Augmented Clinical Agents** | ACL | 2025 | [Paper](http://arxiv.org/abs/2410.17657v3) · [GitHub](https://github.com/BlueZeros/ReflecTool) |
| **Tree-of-Reasoning: Complex Medical Diagnosis via Multi-Agent Evidence Tree** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2508.03038v1) |

---

## 2. Patient-Facing Applications

### 2.1 Mental Health & CBT Agents

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **MIND: Unified Inquiry and Diagnosis RL for Psychiatric Consultation** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2603.03677) |
| **DemMA: Dementia Multi-Turn Dialogue Agent** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2601.06373) |
| **MIND: Immersive Psychological Healing with Multi-Agent Inner Dialogue** | EMNLP Findings | 2025 | [Paper](https://arxiv.org/abs/2502.19860) |
| **Cami: Counselor Agent for Motivational Interviewing** | ACL | 2025 | [Paper](http://arxiv.org/abs/2502.02807v1) |
| **AutoCBT: Autonomous Multi-Agent Framework for CBT** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2501.09426v1) |
| **PsyDraw: Multi-Agent System for Mental Health Screening** | arXiv | 2024 | [Paper](http://arxiv.org/abs/2412.14769v1) |

### 2.2 Clinical Communication & Intake Agents

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **AI Agents for Conversational Patient Triage** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2506.04032) |
| **PIORS: Personalized Intelligent Outpatient Reception** | ACL Findings | 2024 | [Paper](http://arxiv.org/abs/2411.13902v1) · [GitHub](https://github.com/FudanDISC/PIORS) |
| **Conversational Health Agents: Personalized LLM-Powered Framework** | JAMIA Open | 2024 | [Paper](https://academic.oup.com/jamiaopen/article/8/4/ooaf067/8186991) · [GitHub](https://github.com/Institute4FutureHealth/CHA) |
| **Talk2Care: LLM-based Voice Assistant for Healthcare Providers and Older Adults** | ACM IMWUT | 2024 | [Paper](https://dl.acm.org/doi/10.1145/3659625) |

### 2.3 Screening & Personalized Care Agents

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **NutriOrion: Multi-Agent Framework for Personalized Nutrition** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2602.18650) |
| **AI-VaxGuide: Agentic RAG-Based LLM for Vaccination Decisions** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2507.03493v1) |
| **The Anatomy of a Personal Health Agent** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2508.20148v1) |

---

## 3. Drug Discovery & Development

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **TxGemma: Efficient and Agentic LLMs for Therapeutics** | arXiv | 2025 | [Paper](https://arxiv.org/abs/2504.06196) |
| **TxAgent: AI Agent for Therapeutic Reasoning** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2503.10970v1) · [GitHub](https://github.com/mims-harvard/TxAgent) |
| **RAG-Enhanced Collaborative LLM Agents for Drug Discovery** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2502.17506v2) |
| **LLM Agent Swarm for Hypothesis-Driven Drug Discovery** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2504.17967v1) |
| **TrialGenie: Clinical Trial Design with Agentic Intelligence** | medRxiv | 2025 | [Paper](https://www.medrxiv.org/content/10.1101/2025.04.17.25326033) |
| **MALADE: LLM-powered Agents for Pharmacovigilance** | MLHC | 2024 | [Paper](http://arxiv.org/abs/2408.01869v1) · [GitHub](https://github.com/jihyechoi77/malade) |

---

## 4. Healthcare Administration & Workflow
*Directly relevant to Aegis AI's Revenue Cycle Management agents (Medical Coding, Claims Scrubbing, Denials Management)*

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **Engineering AI Agents for Clinical Workflows** | CAIN | 2026 | [Paper](https://arxiv.org/abs/2602.00751) |
| **AutoHealth: Uncertainty-Aware Multi-Agent System for Health Data Modeling** | arXiv | 2026 | [Paper](https://arxiv.org/abs/2602.01078) |
| **Code Like Humans: Multi-Agent Solution for Medical Coding** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2509.05378v1) |
| **MedScrubCrew: Multi-Agent Framework for Appointment Scheduling** | Healthcare (Basel) | 2025 | [Paper](https://doi.org/10.3390/healthcare13141649) |
| **IMAS: Comprehensive Agentic Approach to Rural Healthcare Delivery** | arXiv | 2024 | [Paper](http://arxiv.org/abs/2410.12868v1) · [GitHub](https://github.com/uheal/imas) |
| **LLM-based Framework for Administrative Task Automation in Healthcare** | IEEE ISDFS | 2024 | [Paper](https://ieeexplore.ieee.org/document/10527275) |
| **EHRFlow: LLM-Driven Iterative Multi-Agent EHR Data Analysis** | KDD Workshop | 2024 | [Paper](https://www.pure.ed.ac.uk/ws/portalfiles/portal/487318240/EHRFlow_WU_DOA28062024_VOR_CC-BY.pdf) · [GitHub](https://github.com/PKU-AICare/EHRFlow) |

---

## 5. Datasets & Benchmarks

| Paper | Venue | Year | Links |
|:------|:------|:-----|:------|
| **MedAgentBench: Realistic Virtual EHR Environment** | NEJM AI | 2025 | [Paper](http://arxiv.org/abs/2501.14654v2) · [GitHub](https://github.com/stanfordmlgroup/MedAgentBench) |
| **MedAgentsBench: Benchmarking Thinking Models for Medical Reasoning** | arXiv | 2025 | [Paper](http://arxiv.org/abs/2503.07459v2) · [GitHub](https://github.com/gersteinlab/medagents-benchmark) |
| **MedAgentBoard: Multi-Agent Collaboration Benchmarking** | NeurIPS | 2025 | [Paper](http://arxiv.org/abs/2505.12371v1) · [GitHub](https://github.com/yhzhu99/MedAgentBoard) |
| **AgentClinic: Multimodal Agent Benchmark for Simulated Clinical Environments** | arXiv | 2024 | [Paper](https://arxiv.org/abs/2405.07960) · [GitHub](https://github.com/samuelschmidgall/agentclinic) |
| **Agent Hospital: Simulacrum of Hospital with Evolvable Medical Agents** | arXiv | 2024 | [Paper](http://arxiv.org/abs/2405.02957v3) · [GitHub](https://github.com/wisdom-pan/Agent_Hospital) |

---

## 6. Related Surveys

| Survey | Venue | Year | Links |
|:-------|:------|:-----|:------|
| **A Comprehensive Survey of Agentic AI in Healthcare** | TechRxiv | 2025 | [Paper](https://www.techrxiv.org/users/994756/articles/1355990-a-comprehensive-survey-of-agentic-ai-in-healthcare) |
| **LLM-based Agentic Systems in Medicine** | Nature Machine Intelligence | 2025 | [Paper](https://www.nature.com/articles/s42256-024-00944-1) |
| **AI Agent in Healthcare: Applications, Evaluations, and Future Directions** | npj AI | 2026 | [Paper](https://www.nature.com/articles/s44387-026-00076-4) |
| **Coordinated AI Agents for Advancing Healthcare** | Nature Biomedical Engineering | 2025 | [Paper](https://www.nature.com/articles/s41551-025-01363-2) |
| **A Foundational Architecture for AI Agents in Healthcare** | Cell Reports Medicine | 2025 | [Paper](https://www.cell.com/cell-reports-medicine/fulltext/S2666-3791(25)00447-1) |
| **Next-Generation Agentic AI for Transforming Healthcare** | Cell Reports Medicine | 2025 | [Paper](https://www.sciencedirect.com/science/article/pii/S2949953425000141) |
| **A Survey of LLM-based Agents in Medicine: How Far from Baymax?** | ACL Findings | 2025 | [Paper](https://arxiv.org/abs/2502.11211) · [GitHub](https://github.com/AIM-Research-Lab/Awesome-AI-Agents-Medicine) |

---

## 7. Open-Source Projects & Tools

| Project | Description | Links |
|:--------|:------------|:------|
| **HealthFlow** | Self-Evolving AI Agent with Meta Planning for Autonomous Healthcare Research | [GitHub](https://github.com/yhzhu99/HealthFlow) |
| **STELLA** | Self-Evolving LLM Agent for Biomedical Research | [GitHub](https://github.com/zaixizhang/STELLA) |
| **MedRAX** | Medical Reasoning Agent for Chest X-ray | [GitHub](https://github.com/bowang-lab/MedRAX) |
| **TxAgent** | AI Agent for Therapeutic Reasoning | [GitHub](https://github.com/mims-harvard/TxAgent) |
| **MedAgentGym** | Training LLM Agents for Code-Based Medical Reasoning at Scale | [GitHub](https://github.com/wshi83/MedAgentGym) |
| **ReflecTool** | Reflection-Aware Tool-Augmented Clinical Agents | [GitHub](https://github.com/BlueZeros/ReflecTool) |

---

> **📌 Note:** This research library is continuously updated as new papers are published. It serves as the academic backbone for Aegis AI's agent design decisions and validates our approach to healthcare automation through multi-agent systems.

---

*Maintained by the Aegis AI Research Team*
