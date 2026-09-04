# 🏥 Bahmni Clinical Module: Deep Technical Research & API Mapping

> **Research Status:** Completed | **Date:** 2026-04-02 | **Researcher:** Antigravity AI

---

## 1. Overview
The **Bahmni Clinical Module** is the primary interface for healthcare providers (Doctors, Nurses, Specialists) to manage patient encounters. It is a highly stateful, SPA (Single Page Application) built with AngularJS that interacts with a suite of RESTful services layered over OpenMRS.

### Key Operational Areas:
1. **Patient Search & Queue:** Managing patient flow.
2. **Patient Dashboard:** Holistic view of medical history via widgets.
3. **Consultation/Data Entry:** The "Active" clinical workspace for entering vitals, diagnoses, and orders.

---

## 2. Access & Authentication
*   **Base URL:** `https://dirgelike-superartificially-rachelle.ngrok-free.dev/bahmni/home/index.html`
*   **Credentials Used:** `superman` / `Admin123`
*   **Login Flow:**
    *   `POST /openmrs/ws/rest/v1/session` (Returns JSESSIONID cookie)
    *   `GET /openmrs/ws/rest/v1/location?v=default` (Populates the login location dropdown)
    *   `POST /openmrs/ws/rest/v1/bahmnicore/login` (Initializes Bahmni-specific session context)

---

## 3. Patient Queue & Search UI
Upon clicking the **"Clinical"** icon, the system defaults to the patient search/queue screen.

### 3.1 Active Patient Queue (Tab)
*   **Functionality:** Shows all patients currently checked in (active visit) at the logged-in location.
*   **UI Features:** 
    *   Grid/List of patient tiles.
    *   Indicators for "Vitals Taken" or "Waiting for Lab".
*   **API Mapping:**
    ```bash
    GET /openmrs/ws/rest/v1/bahmnicore/sql?location_uuid=[location_uuid]&q=emrapi.sqlSearch.activePatients&v=full
    ```
    *   **Response:** A JSON list of patient records including `uuid`, `identifier`, `name`, and `visitUuid`.

### 3.2 Global Patient Search
*   **Functionality:** Search for any patient in the database (active or inactive).
*   **UI Features:** Large search input with autocomplete-like behavior.
*   **API Mapping:**
    ```bash
    GET /openmrs/ws/rest/v1/patient?q=[search_term]&v=full
    ```
    *   **Fallback (Bahmni Lucene):** 
    ```bash
    GET /openmrs/ws/rest/v1/bahmnicore/search/patient/lucene?q=[search_term]&s=byIdOrNameOrVillage
    ```

---

## 4. Patient Dashboard (The "Snapshot")
Clicking a patient opens their **Consultation Summary**. This is a grid of "Widgets" (Display Controls).

### 4.1 UI Components & APIs
| Widget Name | Functionality | API Endpoint |
| :--- | :--- | :--- |
| **Vitals Snapshot** | Shows latest BP, Weight, Pulse, Temp. | `GET /openmrs/ws/rest/v1/bahmnicore/observations?patientUuid=[uuid]&numberOfVisits=1&concept=Vitals` |
| **Diagnosis List** | Displays all active/past diagnoses. | `GET /openmrs/ws/rest/v1/bahmnicore/diagnosis/search?patientUuid=[uuid]` |
| **Active Treatments** | Shows current drug orders (Medications). | `GET /openmrs/ws/rest/v1/bahmnicore/drugOrders/prescribedAndActive?patientUuid=[uuid]` |
| **Lab Results** | Tabular view of recent lab values. | `GET /openmrs/ws/rest/v1/bahmnicore/labOrderResults?patientUuid=[uuid]&numberOfVisits=3` |
| **Disposition** | Current status (Admitted/Discharged). | `GET /openmrs/ws/rest/v1/bahmnicore/disposition?patientUuid=[uuid]` |

---

## 5. The Consultation Workflow (Consultation Button)
Clicking the green **"Consultation"** button enters the **Data Entry Mode**.

### 5.1 Observations (The "Form" Tab)
*   **UI:** Allows providers to select a form template (e.g., "History & Exam", "Vitals").
*   **Functionality:** Dynamic form rendering based on Bahmni Config.
*   **API Interaction:**
    *   **Loading Templates:** `GET /bahmni_config/openmrs/apps/clinical/app.json`
    *   **Saving Data:** `POST /openmrs/ws/rest/v1/bahmnicore/bahmniencounter` (Coarse-grained save).

### 5.2 Diagnoses Tab
*   **UI:** An input field with real-time concept search.
*   **Functionality:** 
    *   Assign ICD-10 or internal concepts.
    *   Toggle between "Coded" and "Non-Coded".
    *   Set `Order` (Primary/Secondary) and `Certainty` (Confirmed/Presumed).
*   **API Interaction:**
    ```bash
    GET /openmrs/ws/rest/v1/concept?s=byFullySpecifiedName&name=[query]&v=custom:(uuid,name,display)
    ```

### 5.3 Medications Tab (Orders)
*   **UI:** Specialized medication entry form.
*   **Functionality:** 
    *   Dose calculation.
    *   Route selection (Oral, IV, IM).
    *   Frequency mapping (QD, BID, TID).
    *   SOS (As needed) toggle.
*   **API Interaction:**
    ```bash
    GET /openmrs/ws/rest/v1/drug?q=[query]&v=default
    ```

### 5.4 Lab Orders Tab
*   **UI:** Category-based selection (e.g., Biochemistry, Hematology).
*   **Functionality:** Click-to-order lab tests.
*   **API Interaction:**
    ```bash
    GET /openmrs/ws/rest/v1/concept?s=byFullySpecifiedName&name=All_Tests_and_Panels&v=custom:(uuid,display,setMembers)
    ```

---

## 6. Saving & State Persistence
The entire consultation session is buffered in the frontend state. Clicking **"Save" (Alt+S)** triggers the most critical Bahmni API:

### ⚠️ The Coarse-Grained Save
*   **API:** `POST /openmrs/ws/rest/v1/bahmnicore/bahmniencounter`
*   **Payload Structure (The "Big JSON"):**
    ```json
    {
      "patientUuid": "...",
      "encounterTypeUuid": "...",
      "visitTypeUuid": "...",
      "observations": [ { "conceptUuid": "...", "value": "..." } ],
      "diagnoses": [ { "conceptUuid": "...", "order": "PRIMARY", "certainty": "CONFIRMED" } ],
      "drugOrders": [ { "drugUuid": "...", "dose": 500, "units": "mg" } ],
      "orders": [ { "conceptUuid": "..." } ]
    }
    ```
*   **Rationale:** Bahmni uses this custom endpoint to ensure atomicity—either the whole consultation is saved, or none of it is.

---

## 7. Audit & Logging
Bahmni tracks clinical activity for compliance:
*   **API:** `POST /openmrs/ws/rest/v1/auditlog`
*   **Trigger:** On every patient selection, save action, and print action.

---

## 8. Summary for Aegis AI Implementation
To replicate or improve this clinical flow in Aegis AI, we must:
1.  **Use `bahmniencounter` (POST):** Do not save vitals, diagnoses, and orders separately. It causes state fragmentation and multiple backend hits.
2.  **Lucene Search:** Use `/bahmnicore/search/patient/lucene` for any "Search" UI to match Bahmni's performance and村 search capabilities.
3.  **Config-Driven UI:** Periodically fetch `app.json` from `bahmni_config` to ensure Aegis AI shows the same clinical forms/tabs as the original UI.

---

> [!IMPORTANT]
> **Source Verification:** All APIs listed were captured live during the browser session using network inspection on the ngrok-tunneled environment.
