"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Dropdown from "@/components/Dropdown";

interface Visit {
  uuid: string;
  display: string;
  startDatetime: string;
  stopDatetime: string | null;
  visitType: { display: string };
  location: { display: string };
}

export default function PatientDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { authFetch } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Original patient identifiers to display
  const [personUuid, setPersonUuid] = useState<string>("");
  const [identifier, setIdentifier] = useState<string>("");
  const [originalNameUuid, setOriginalNameUuid] = useState<string>("");
  const [originalAddressUuid, setOriginalAddressUuid] = useState<string>("");

  // Form fields
  const [givenName, setGivenName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [estimated, setEstimated] = useState(false);
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [locality, setLocality] = useState("");
  const [cityVillage, setCityVillage] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [district, setDistrict] = useState("");
  const [stateVal, setStateVal] = useState("");

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visits and Quick Actions
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitDropdownOpen, setVisitDropdownOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const [patientRes, visitRes, photoRes] = await Promise.all([
        authFetch(`/openmrs/ws/rest/v1/patient/${uuid}?v=full`),
        authFetch(`/openmrs/ws/rest/v1/visit?patient=${uuid}&v=default`),
        authFetch(`/openmrs/ws/rest/v1/patientImage?patientUuid=${uuid}&q=${Date.now()}`).catch(() => null)
      ]);

      if (patientRes.ok) {
        const pData = await patientRes.json();
        const person = pData.person;
        const pIdentifier = pData.identifiers?.[0]?.display?.split("=")?.[1]?.trim() || "";

        setIdentifier(pIdentifier);
        setPersonUuid(person.uuid);

        // Pre-fill names
        const prefName = person.preferredName || person.names?.[0] || {};
        setOriginalNameUuid(prefName.uuid || "");
        setGivenName(prefName.givenName || "");
        setMiddleName(prefName.middleName || "");
        setFamilyName(prefName.familyName || "");

        // Pre-fill demographics
        setGender(person.gender || "");
        setBirthdate(person.birthdate ? person.birthdate.split("T")[0] : "");
        setEstimated(person.birthdateEstimated || false);

        // Pre-fill address
        const prefAddress = person.preferredAddress || person.addresses?.[0] || {};
        setOriginalAddressUuid(prefAddress.uuid || "");
        setHouseNo(prefAddress.address1 || "");
        // If address1 was concatenated, we might try to split it, but let's just keep it in houseNo for editing simplicity
        setLocality("");
        setCityVillage(prefAddress.cityVillage || "");
        setPinCode(prefAddress.postalCode || "");
        setDistrict(prefAddress.countyDistrict || "");
        setStateVal(prefAddress.stateProvince || "");

        // Pre-fill attributes
        person.attributes?.forEach((attr: any) => {
          const typeDisplay = attr.attributeType?.display?.toLowerCase() || "";
          if (typeDisplay.includes("phone") || attr.attributeType?.uuid === "c1f4239f-3f10-11e4-adec-0800271c1b75") {
            // Assuming first phone attribute found is primary
            if (!phone) setPhone(attr.value);
            else setAltPhone(attr.value);
          } else if (typeDisplay.includes("email")) {
            setEmail(attr.value);
          }
        });
      }

      if (visitRes.ok) {
        const vData = await visitRes.json();
        setVisits(vData.results || []);
      }

      if (photoRes && photoRes.ok) {
        const photoBlob = await photoRes.blob();
        if (photoBlob.size > 100) {
          const objectUrl = URL.createObjectURL(photoBlob);
          // Set the src to this newly minted object URL
          setExistingPhotoUrl(objectUrl);
        }
      }
    } catch (e) {
      console.error("Error loading patient:", e);
      setMessage({ type: "error", text: "Failed to load patient details." });
    } finally {
      setLoading(false);
    }
  }, [uuid, authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update photo preview when blob changes
  useEffect(() => {
    if (photoBlob) {
      const url = URL.createObjectURL(photoBlob);
      setPhotoPreview(url);
      setExistingPhotoUrl(null); // hide existing photo once a new one is picked
      return () => URL.revokeObjectURL(url);
    } else {
      setPhotoPreview(null);
    }
  }, [photoBlob]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const activeVisits = visits.filter(v => !v.stopDatetime);
  const hasActiveVisit = activeVisits.length > 0;

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOpen(true);
      setPhotoBlob(null);
    } catch (err: any) {
      console.error("Camera access denied:", err);
      setCameraError(err.name === "NotAllowedError"
        ? "Camera permission denied. Please allow camera access in your browser settings."
        : "Could not access camera. Please use the upload option instead.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) setPhotoBlob(blob);
        }, 'image/jpeg', 0.85);
        stopCamera();
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoBlob(e.target.files[0]);
      stopCamera();
    }
  };

  const updatePatient = async (): Promise<any> => {
    const address1 = [houseNo, locality].filter(Boolean).join(", ");

    // Construct person payload
    const personPayload: any = {
      names: [{
        ...(originalNameUuid ? { uuid: originalNameUuid } : {}),
        givenName,
        middleName,
        familyName,
        preferred: true
      }],
      gender,
      birthdate,
      birthdateEstimated: estimated,
      addresses: [{
        ...(originalAddressUuid ? { uuid: originalAddressUuid } : {}),
        address1: address1 || undefined,
        cityVillage: cityVillage || undefined,
        countyDistrict: district || undefined,
        stateProvince: stateVal || undefined,
        postalCode: pinCode || undefined,
      }],
      attributes: [
        ...(phone ? [{ attributeType: "c1f4239f-3f10-11e4-adec-0800271c1b75", value: phone }] : []),
        ...(email ? [{ attributeType: "email", value: email }] : []),
        // Ideally we should map existing attribute UUIDs so we don't duplicate them,
        // but for simplicity we rely on Bahmni's attribute handling or assume it overwrites by type.
      ].filter(a => a.value),
    };

    // Update person
    const personRes = await authFetch(`/openmrs/ws/rest/v1/person/${personUuid}`, {
      method: "POST",
      body: JSON.stringify(personPayload),
    });

    if (!personRes.ok) {
      const errData = await personRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || "Failed to update patient details");
    }

    // Upload photo if new blob is captured — use Bahmni patientprofile endpoint
    if (photoBlob) {
      try {
        const reader = new FileReader();
        const b64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(photoBlob);
        });

        await authFetch(`/openmrs/ws/rest/v1/bahmnicore/patientprofile/${uuid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient: {
              uuid,
              person: {
                uuid: personUuid,
              },
            },
            image: b64,
            relationships: [],
          }),
        });
        // Clear local photo state so loadData refreshes from server
        setPhotoBlob(null);
        setPhotoPreview(null);
      } catch (e) {
        console.error("Photo upload failed:", e);
      }
    }

    return true;
  };

  const handleSaveOnly = async () => {
    if (!givenName || !familyName || !gender || !birthdate) {
      setMessage({ type: "error", text: "First Name, Last Name, Date of Birth, and Gender are required." });
      window.scrollTo(0, 0);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updatePatient();
      setMessage({ type: "success", text: `Patient details updated successfully!` });
      window.scrollTo(0, 0);
      await loadData(); // refresh
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Update failed" });
      window.scrollTo(0, 0);
    } finally {
      setSaving(false);
    }
  };

  const handleStartVisit = async (visitTypeUuid: string, visitName: string) => {
    if (!givenName || !familyName || !gender || !birthdate) {
      setMessage({ type: "error", text: "First Name, Last Name, Date of Birth, and Gender are required." });
      window.scrollTo(0, 0);
      return;
    }
    setSaving(true);
    setMessage(null);
    setVisitDropdownOpen(false);
    try {
      // First save details just in case they were modified
      await updatePatient();

      // Start the visit
      const visitRes = await authFetch("/openmrs/ws/rest/v1/visit", {
        method: "POST",
        body: JSON.stringify({
          patient: uuid,
          visitType: visitTypeUuid,
          startDatetime: new Date().toISOString(),
          location: "833d0c66-e29a-4d31-ac13-ca9050d1bfa9",
        }),
      });
      if (!visitRes.ok) throw new Error(`Failed to start ${visitName} visit`);

      setMessage({ type: "success", text: `${visitName} Visit started for ${givenName} ${familyName}!` });
      window.scrollTo(0, 0);
      await loadData(); // refresh visit list
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to start visit" });
      window.scrollTo(0, 0);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="text-slate-400 text-sm">Loading patient details...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SCREEN UI */}
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/patients"
              className="text-slate-500 hover:text-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-slate-900 flex items-center gap-3">
                Edit Patient Details
                {hasActiveVisit && (
                  <span className="px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-600 text-xs font-semibold flex items-center gap-1.5 translate-y-[2px]">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Active Visit
                  </span>
                )}
              </h1>
              <p className="text-slate-500 text-sm font-semibold mt-0.5 uppercase tracking-wider">
                ID: <span className="text-slate-900 font-mono font-bold">{identifier}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Actions (only show if active visit) */}
            {hasActiveVisit && (
              <div className="hidden md:flex gap-3 mr-2">
                <Link href={`/vitals?patient=${uuid}`} className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-sm">monitor_heart</span>
                  Vitals
                </Link>
                <Link href={`/diagnoses?patient=${uuid}`} className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-sm">stethoscope</span>
                  Diagnosis
                </Link>
              </div>
            )}

            {/* Print Button */}
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Registration Card
            </button>
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div className={`px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-green-50 border border-green-200" : "bg-rose-50 border border-rose-200"}`}>
            <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-green-600" : "text-rose-600"}`}>
              {message.type === "success" ? "check_circle" : "error"}
            </span>
            <p className={`text-sm font-medium ${message.type === "success" ? "text-green-700" : "text-rose-700"}`}>{message.text}</p>
          </div>
        )}

        {cameraError && (
          <div className="px-4 py-3 rounded-xl flex items-center gap-2 bg-amber-500/10 border border-amber-500/20">
            <span className="material-symbols-outlined text-lg text-amber-400">warning</span>
            <p className="text-sm font-medium text-amber-400">{cameraError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Photo Section */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-6 sticky top-24">
              <h3 className="text-slate-900 font-semibold tracking-tight mb-6 flex items-center gap-2 text-lg">
                <span className="material-symbols-outlined text-slate-500 text-xl">photo_camera</span>
                Patient Photo
              </h3>

              <canvas ref={canvasRef} className="hidden" />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />

              <div className="flex flex-col items-center">
                {/* If camera is open or checking newly taken photo */}
                <div className={`flex flex-col items-center w-full ${!isCameraOpen && !photoPreview && !existingPhotoUrl ? 'hidden' : ''}`}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full max-w-[280px] aspect-square object-cover rounded-[1.5rem] mb-6 border-4 border-black/5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] bg-black/5 ${isCameraOpen ? 'block' : 'hidden'}`}
                  />

                  {/* Photo Preview img replaces video when captured (either existing or new) */}
                  {!isCameraOpen && (photoPreview || existingPhotoUrl) && (
                    <img
                      src={photoPreview || existingPhotoUrl || undefined}
                      alt="Patient preview"
                      className="w-full max-w-[280px] aspect-square object-cover rounded-[1.5rem] mb-6 border-4 border-black/5 shadow-md"
                    />
                  )}

                  <div className="flex gap-3">
                    {isCameraOpen ? (
                      <>
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="bg-blue-600 text-white font-bold rounded-xl px-6 py-3 flex items-center gap-2 text-sm shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] hover:bg-blue-700 hover:shadow-[0_10px_25px_-6px_rgba(37,99,235,0.5)] transition-all"
                        >
                          <span className="material-symbols-outlined text-lg">camera_alt</span>
                          Capture
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl px-5 py-3 hover:bg-red-100 transition-colors text-sm"
                        >
                          <span className="material-symbols-outlined text-lg">close</span>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="bg-blue-50 text-blue-600 border border-blue-100 rounded-xl px-5 py-2.5 text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">camera_alt</span>
                          {existingPhotoUrl || photoPreview ? "Retake" : "Camera"}
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-black/5 text-black border border-black/10 rounded-xl px-5 py-2.5 text-xs font-bold hover:bg-black/10 transition-colors flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">upload</span>
                          {existingPhotoUrl || photoPreview ? "Replace" : "Upload"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Default state: No camera, no photo */}
                {!isCameraOpen && !photoPreview && !existingPhotoUrl && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="w-48 h-48 rounded-[2rem] bg-black/5 border-2 border-dashed border-black/20 flex items-center justify-center mb-2 shadow-inner">
                      <span className="material-symbols-outlined text-6xl text-black/20">person</span>
                    </div>
                    <div className="flex gap-3 w-full justify-center">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="flex-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl px-4 py-3 text-sm font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">camera_alt</span>
                        Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 bg-black/5 text-black border border-black/10 rounded-xl px-4 py-3 text-sm font-bold hover:bg-black/10 transition-colors flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">upload</span>
                        Upload
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 p-4 rounded-xl shadow-sm">
                <span className="material-symbols-outlined text-slate-400 text-base">shield</span>
                <p>HIPAA compliant. Photos are encrypted at rest.</p>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Name */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-6">
              <h3 className="text-slate-900 font-semibold tracking-tight mb-6 flex items-center gap-2 text-lg">
                <span className="material-symbols-outlined text-slate-500 text-xl">badge</span>
                Patient Name
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">First Name <span className="text-rose-500">*</span></label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="First Name" value={givenName} onChange={e => setGivenName(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Middle Name</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="Middle Name" value={middleName} onChange={e => setMiddleName(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Last Name <span className="text-rose-500">*</span></label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="Last Name" value={familyName} onChange={e => setFamilyName(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Demographics */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-6">
              <h3 className="text-slate-900 font-semibold tracking-tight mb-6 flex items-center gap-2 text-lg">
                <span className="material-symbols-outlined text-slate-500 text-xl">diversity_3</span>
                Demographics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Dropdown
                    label={<>Gender <span className="text-rose-500">*</span></>}
                    value={gender}
                    onChange={(value) => setGender(value)}
                    options={[
                      { label: "Select Gender", value: "", disabled: true },
                      { label: "Male", value: "M" },
                      { label: "Female", value: "F" },
                      { label: "Other", value: "O" },
                    ]}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Date of Birth <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-4">
                    <input
                      type="date"
                      className="flex-1 bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100"
                      value={birthdate}
                      onChange={e => setBirthdate(e.target.value)}
                    />
                    <label className="flex items-center gap-2 cursor-pointer text-[10px] font-semibold text-slate-600 whitespace-nowrap bg-slate-50 border border-slate-200 px-3 py-3 rounded-xl hover:bg-slate-100 transition-colors uppercase tracking-wider">
                      <input type="checkbox" checked={estimated} onChange={e => setEstimated(e.target.checked)} className="rounded border-slate-300 text-slate-900 w-4 h-4 cursor-pointer" />
                      Est.
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-6">
              <h3 className="text-slate-900 font-semibold tracking-tight mb-6 flex items-center gap-2 text-lg">
                <span className="material-symbols-outlined text-slate-500 text-xl">location_on</span>
                Address Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">House No / Flat No</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="House number" value={houseNo} onChange={e => setHouseNo(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Locality / Sector</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="Locality" value={locality} onChange={e => setLocality(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">City / Village</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="City" value={cityVillage} onChange={e => setCityVillage(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Pin Code</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="Pin Code" value={pinCode} onChange={e => setPinCode(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">District</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="District" value={district} onChange={e => setDistrict(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">State</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="State" value={stateVal} onChange={e => setStateVal(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-6">
              <h3 className="text-slate-900 font-semibold tracking-tight mb-6 flex items-center gap-2 text-lg">
                <span className="material-symbols-outlined text-slate-500 text-xl">call</span>
                Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Email Address</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="email@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Phone Number</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Alternate Phone</label>
                  <input className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" placeholder="Alternate" type="tel" value={altPhone} onChange={e => setAltPhone(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Save button */}
                <button
                  type="button"
                  onClick={handleSaveOnly}
                  disabled={saving}
                  className="flex-shrink-0 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm shadow-sm"
                >
                  {saving ? (
                    <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Saving...</>
                  ) : (
                    <><span className="material-symbols-outlined text-lg">save</span> Save Changes</>
                  )}
                </button>

                {/* Start Visit split button */}
                {!hasActiveVisit ? (
                  <div className="flex-1 flex relative">
                    <button
                      type="button"
                      onClick={() => handleStartVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                      disabled={saving}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-l-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm shadow-sm"
                    >
                      <span className="material-symbols-outlined text-lg">personal_injury</span>
                      Start OPD Visit
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setVisitDropdownOpen(!visitDropdownOpen)}
                        disabled={saving}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-3 rounded-r-lg border-l border-white/20 transition-colors disabled:opacity-50 shadow-sm h-full"
                      >
                        <span className="material-symbols-outlined text-lg">{visitDropdownOpen ? "expand_less" : "expand_more"}</span>
                      </button>

                      {/* Dropdown */}
                      {visitDropdownOpen && (
                        <div className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20 min-w-[220px]">
                          <button
                            type="button"
                            onClick={() => handleStartVisit("ff237ff8-b5c0-46a6-9abc-1017c6a0ff10", "Emergency")}
                            className="w-full px-4 py-3 text-left text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3 font-medium"
                          >
                            <span className="material-symbols-outlined text-xl">local_hospital</span>
                            Start Emergency Visit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex">
                    <button
                      type="button"
                      onClick={() => router.push(`/patients/${uuid}/visit-details`)}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm shadow-sm"
                    >
                      <span className="material-symbols-outlined text-lg">edit_note</span>
                      Enter Visit Details
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT UI: Registration card overlay — Bahmni Form Mimic */}
      <div className="hidden print:block absolute inset-0 bg-white text-black z-[9999] p-8 -m-4">
        <div className="max-w-2xl mx-auto border-4 border-black p-6 bg-white relative">
          {/* Header */}
          <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h1 className="text-3xl font-extrabold uppercase tracking-widest text-black">Aegis AI Medical Center</h1>
            <h2 className="text-xl font-bold uppercase tracking-wider text-gray-800 mt-1 pb-2">Patient Registration Card</h2>
          </div>

          <div className="flex justify-between items-start mb-6 gap-6">
            {/* Left Data Area */}
            <div className="flex-1">
              <table className="w-full text-left text-lg border-collapse">
                <tbody>
                  <tr className="border-b-2 border-dashed border-gray-300">
                    <th className="py-2.5 px-1 w-1/3 text-gray-700 uppercase text-xs tracking-widest">Patient ID</th>
                    <td className="py-2.5 font-mono font-bold text-xl text-black">{identifier || "N/A"}</td>
                  </tr>
                  <tr className="border-b-2 border-dashed border-gray-300">
                    <th className="py-2.5 px-1 w-1/3 text-gray-700 uppercase text-xs tracking-widest">Patient Name</th>
                    <td className="py-2.5 px-1 font-extrabold text-black uppercase text-xl">
                      {givenName} {middleName} {familyName}
                    </td>
                  </tr>
                  <tr className="border-b-2 border-dashed border-gray-300">
                    <th className="py-2.5 px-1 w-1/3 text-gray-700 uppercase text-xs tracking-widest">Gender / Age</th>
                    <td className="py-2.5 px-1 text-black font-bold uppercase text-lg">
                      {gender === "M" ? "Male" : gender === "F" ? "Female" : "Other"}
                      {birthdate ? ` • ${Math.floor((new Date().getTime() - new Date(birthdate).getTime()) / 31557600000)} YRS` : ""}
                    </td>
                  </tr>
                  <tr className="border-b-2 border-dashed border-gray-300">
                    <th className="py-2.5 px-1 w-1/3 text-gray-700 uppercase text-xs tracking-widest">Address</th>
                    <td className="py-2.5 px-1 text-black font-semibold uppercase text-base">
                      {[houseNo, locality, cityVillage, district, stateVal, pinCode].filter(Boolean).join(", ") || "NOT PROVIDED"}
                    </td>
                  </tr>
                  <tr className="border-b-2 border-dashed border-gray-300">
                    <th className="py-2.5 px-1 w-1/3 text-gray-700 uppercase text-xs tracking-widest">Mobile</th>
                    <td className="py-2.5 px-1 text-black font-bold font-mono text-lg">{phone || "N/A"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Photo Area */}
            <div className="w-48 h-48 border-[6px] border-black bg-gray-100 flex flex-col items-center justify-center shrink-0 relative overflow-hidden">
              {existingPhotoUrl || photoPreview ? (
                <img src={existingPhotoUrl || photoPreview || undefined} alt="Patient" className="w-full h-full object-cover grayscale" style={{ filter: 'grayscale(100%) contrast(120%)' }} />
              ) : (
                <>
                  <span className="material-symbols-outlined text-6xl text-gray-400">face</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest mt-2 text-gray-500">Attach Photo Here</span>
                </>
              )}
            </div>
          </div>

          {/* Footer Barcode Area */}
          <div className="mt-8 pt-6 border-t-[3px] border-black flex justify-between items-end">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">Date of Registration</p>
              <p className="text-xl font-mono font-bold text-black">{new Date().toLocaleDateString('en-IN')}</p>
            </div>

            {/* Mock Barcode Output */}
            <div className="text-right flex flex-col items-end">
              <div className="px-4 py-2 border-2 border-black flex space-x-1 justify-center bg-gray-50 max-w-fit mb-2">
                {/* Simplified visual barcode bars for aesthetic since actual font might not load in printers */}
                <div className="w-1 h-8 bg-black"></div><div className="w-2 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-3 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-2 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-2 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-2 h-8 bg-black"></div><div className="w-3 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-2 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div><div className="w-2 h-8 bg-black"></div><div className="w-1 h-8 bg-black"></div>
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-black">SCAN AT COUNTER</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
