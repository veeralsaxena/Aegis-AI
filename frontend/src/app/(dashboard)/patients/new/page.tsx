"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Dropdown from "@/components/Dropdown";
export default function NewPatientPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  const [state, setStateVal] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Visit dropdown
  const [visitDropdownOpen, setVisitDropdownOpen] = useState(false);

  // Update photo preview when blob changes
  useEffect(() => {
    if (photoBlob) {
      const url = URL.createObjectURL(photoBlob);
      setPhotoPreview(url);
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

  const createPatient = async (): Promise<any> => {
    const address1 = [houseNo, locality].filter(Boolean).join(", ");
    const patientPayload = {
      patient: {
        person: {
          names: [{ givenName, middleName, familyName, preferred: true }],
          gender,
          birthdate,
          birthdateEstimated: estimated,
          addresses: [{
            address1: address1 || undefined,
            cityVillage: cityVillage || undefined,
            countyDistrict: district || undefined,
            stateProvince: state || undefined,
            postalCode: pinCode || undefined,
          }],
          attributes: [
            ...(phone ? [{ attributeType: "c1f4239f-3f10-11e4-adec-0800271c1b75", value: phone }] : []),
            ...(email ? [{ attributeType: "email", value: email }] : []),
          ].filter(a => a.value),
        },
        identifiers: [
          {
            identifierSourceUuid: "c5cf4b68-6529-43fc-a644-c775ae73745e",
            identifierPrefix: "GAN",
            identifierType: "b9a9e100-f496-11ed-b02c-0242ac150003",
            preferred: true,
            voided: false,
          },
        ],
      },
      relationships: [],
    };

    const patientRes = await authFetch("/openmrs/ws/rest/v1/bahmnicore/patientprofile", {
      method: "POST",
      body: JSON.stringify(patientPayload),
    });

    if (!patientRes.ok) {
      const errData = await patientRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || "Failed to create patient");
    }

    const responseData = await patientRes.json();
    const patient = responseData.patient || responseData;

    // Upload photo separately using Bahmni's native personimage API
    if (photoBlob && patient?.person?.uuid) {
      try {
        const reader = new FileReader();
        const b64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(photoBlob);
        });

        // Bahmni saves photos to disk using the patient identifier as filename; the full
        // patient from create (including identifiers[]) must be sent or the image write is skipped silently.
        await authFetch(`/openmrs/ws/rest/v1/bahmnicore/patientprofile/${patient.uuid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient,
            image: b64,
            relationships: Array.isArray(responseData.relationships) ? responseData.relationships : [],
          }),
        });
      } catch (e) {
        console.error("Photo upload failed (patient was created):", e);
      }
    }

    return patient;
  };

  const handleSaveOnly = async () => {
    if (!givenName || !familyName || !gender || !birthdate) {
      setMessage({ type: "error", text: "First Name, Last Name, Date of Birth, and Gender are required." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const patient = await createPatient();
      setMessage({ type: "success", text: `Patient ${givenName} ${familyName} registered successfully!` });
      setTimeout(() => router.push(`/patients/${patient.uuid}`), 1200);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Registration failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartVisit = async (visitTypeUuid: string, visitName: string) => {
    if (!givenName || !familyName || !gender || !birthdate) {
      setMessage({ type: "error", text: "First Name, Last Name, Date of Birth, and Gender are required." });
      return;
    }
    setSaving(true);
    setMessage(null);
    setVisitDropdownOpen(false);
    try {
      const patient = await createPatient();
      // Start the visit
      const visitRes = await authFetch("/openmrs/ws/rest/v1/visit", {
        method: "POST",
        body: JSON.stringify({
          patient: patient.uuid,
          visitType: visitTypeUuid,
          startDatetime: new Date().toISOString(),
          location: "833d0c66-e29a-4d31-ac13-ca9050d1bfa9",
        }),
      });
      if (!visitRes.ok) throw new Error(`Failed to start ${visitName} visit`);
      setMessage({ type: "success", text: `${visitName} Visit started for ${givenName} ${familyName}!` });
      setTimeout(() => router.push(`/patients/${patient.uuid}`), 1000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to start visit" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/patients"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-medium text-slate-900 tracking-tight">Register New Patient</h1>
          <p className="text-slate-500 text-[11px] font-semibold mt-1 uppercase tracking-wider">Create a new patient record in Aegis AI</p>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`px-5 py-4 rounded-2xl flex items-center gap-3 shadow-sm ${message.type === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <span className={`material-symbols-outlined text-2xl ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <p className={`text-sm font-bold ${message.type === "success" ? "text-green-800" : "text-red-800"}`}>{message.text}</p>
        </div>
      )}

      {cameraError && (
        <div className="px-5 py-4 rounded-2xl flex items-center gap-3 bg-amber-50 border border-amber-200 shadow-sm">
          <span className="material-symbols-outlined text-2xl text-amber-600">warning</span>
          <p className="text-sm font-bold text-amber-800">{cameraError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Photo Section */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm sticky top-24">
            <h3 className="text-slate-900 font-medium tracking-tight mb-5 flex items-center gap-2 text-lg">
              <span className="material-symbols-outlined text-slate-500 text-xl">photo_camera</span>
              Patient Photo
            </h3>

            <canvas ref={canvasRef} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />

            <div className="flex flex-col items-center">
              <div className={`flex flex-col items-center w-full ${!isCameraOpen && !photoPreview ? 'hidden' : ''}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full max-w-[280px] aspect-square object-cover rounded-lg mb-5 border border-slate-200 bg-slate-50 ${isCameraOpen ? 'block' : 'hidden'}`}
                />

                {/* Photo Preview img replaces video when captured */}
                {!isCameraOpen && photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Patient preview"
                    className="w-full max-w-[280px] aspect-square object-cover rounded-lg mb-5 border border-slate-200 shadow-sm"
                  />
                )}

                <div className="flex gap-3">
                  {isCameraOpen ? (
                    <>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="bg-slate-900 text-white font-medium rounded-lg px-5 py-2.5 flex items-center gap-2 text-sm hover:bg-slate-800 transition-colors shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[18px]">camera_alt</span>
                        Capture
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="bg-white text-rose-600 border border-rose-200 font-medium rounded-lg px-4 py-2.5 hover:bg-rose-50 transition-colors text-sm"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-white text-slate-600 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">camera_alt</span>
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-50 text-slate-600 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">upload</span>
                        Replace
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Default state: No camera, no photo */}
              {!isCameraOpen && !photoPreview && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="w-40 h-40 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center mb-2">
                    <span className="material-symbols-outlined text-5xl text-slate-300">person</span>
                  </div>
                  <div className="flex gap-3 w-full justify-center">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 bg-white text-slate-600 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">camera_alt</span>
                      Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">upload</span>
                      Upload
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-2 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 p-3 rounded-lg">
              <span className="material-symbols-outlined text-emerald-600 text-sm">shield</span>
              <p>HIPAA compliant. Photos are encrypted.</p>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Name */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-slate-900 font-medium tracking-tight mb-5 flex items-center gap-2 text-lg">
              <span className="material-symbols-outlined text-slate-500 text-xl">badge</span>
              Patient Name
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">First Name <span className="text-rose-500">*</span></label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="First Name" value={givenName} onChange={e => setGivenName(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Middle Name</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="Middle Name" value={middleName} onChange={e => setMiddleName(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Last Name <span className="text-rose-500">*</span></label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="Last Name" value={familyName} onChange={e => setFamilyName(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Demographics */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-slate-900 font-medium tracking-tight mb-5 flex items-center gap-2 text-lg">
              <span className="material-symbols-outlined text-slate-500 text-xl">diversity_3</span>
              Demographics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Dropdown
                  label="Gender"
                  required
                  value={gender}
                  onChange={setGender}
                  options={[
                    { label: "Male", value: "M", icon: "male" },
                    { label: "Female", value: "F", icon: "female" },
                    { label: "Other", value: "O", icon: "transgender" }
                  ]}
                  placeholder="Select Gender"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Date of Birth <span className="text-rose-500">*</span></label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    className="flex-1 w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors"
                    value={birthdate}
                    onChange={e => setBirthdate(e.target.value)}
                  />
                  <label className="flex items-center gap-2 cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 px-3 py-3.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <input type="checkbox" checked={estimated} onChange={e => setEstimated(e.target.checked)} className="rounded border-slate-300 text-slate-900 w-4 h-4 cursor-pointer" />
                    Est.
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-slate-900 font-medium tracking-tight mb-5 flex items-center gap-2 text-lg">
              <span className="material-symbols-outlined text-slate-500 text-xl">location_on</span>
              Address Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">House No / Flat No</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="House number" value={houseNo} onChange={e => setHouseNo(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Locality / Sector</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="Locality" value={locality} onChange={e => setLocality(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">City / Village</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="City" value={cityVillage} onChange={e => setCityVillage(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Pin Code</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="Pin Code" value={pinCode} onChange={e => setPinCode(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">District</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="District" value={district} onChange={e => setDistrict(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">State</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="State" value={state} onChange={e => setStateVal(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-slate-900 font-medium tracking-tight mb-5 flex items-center gap-2 text-lg">
              <span className="material-symbols-outlined text-slate-500 text-xl">call</span>
              Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Email Address</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="email@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Phone Number</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Alternate Phone</label>
                <input className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 text-slate-900 font-medium p-3 rounded-lg outline-none text-sm transition-colors" placeholder="Alternate" type="tel" value={altPhone} onChange={e => setAltPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Save button */}
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={saving}
                className="flex-shrink-0 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? (
                  <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Saving...</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">save</span> Save Draft</>
                )}
              </button>

              {/* Start Visit split button */}
              <div className="flex-1 flex relative">
                <button
                  type="button"
                  onClick={() => handleStartVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                  disabled={saving}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-l-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">personal_injury</span>
                  Start OPD Visit
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVisitDropdownOpen(!visitDropdownOpen)}
                    disabled={saving}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-r-lg border-l border-white/20 transition-colors disabled:opacity-50 shadow-sm h-full"
                  >
                    <span className="material-symbols-outlined text-[18px]">{visitDropdownOpen ? "expand_less" : "expand_more"}</span>
                  </button>

                  {/* Dropdown */}
                  {visitDropdownOpen && (
                    <div className="absolute bottom-full right-0 mb-2 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20 min-w-[200px]">
                      <button
                        type="button"
                        onClick={() => handleStartVisit("ff237ff8-b5c0-46a6-9abc-1017c6a0ff10", "Emergency")}
                        className="w-full px-4 py-3 text-left text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-3 font-medium"
                      >
                        <span className="material-symbols-outlined text-[18px]">local_hospital</span>
                        Emergency Visit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
