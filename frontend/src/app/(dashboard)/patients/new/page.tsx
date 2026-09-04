"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

        await authFetch(`/openmrs/ws/rest/v1/bahmnicore/patientprofile/${patient.uuid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient: {
              uuid: patient.uuid,
              person: { uuid: patient.person.uuid },
            },
            image: b64,
            relationships: [],
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
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-black/5 hover:bg-black/10 text-black/40 hover:text-black transition-all shadow-inner"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-black tracking-tighter">Register New Patient</h1>
          <p className="text-black/50 text-sm font-semibold mt-1 uppercase tracking-wider">Create a new patient record in Aegis AI</p>
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
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 sticky top-24">
            <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
              <span className="material-symbols-outlined text-blue-600 text-2xl">photo_camera</span>
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
                  className={`w-full max-w-[280px] aspect-square object-cover rounded-[1.5rem] mb-6 border-4 border-black/5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] bg-black/5 ${isCameraOpen ? 'block' : 'hidden'}`}
                />

                {/* Photo Preview img replaces video when captured */}
                {!isCameraOpen && photoPreview && (
                  <img
                    src={photoPreview}
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
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-black/5 text-black border border-black/10 rounded-xl px-5 py-2.5 text-xs font-bold hover:bg-black/10 transition-colors flex items-center gap-1.5"
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

            <div className="mt-8 flex items-center gap-2 text-xs font-medium text-black/50 bg-black/5 p-4 rounded-xl shadow-inner">
              <span className="material-symbols-outlined text-blue-600 text-base">shield</span>
              <p>HIPAA compliant. Photos are encrypted at rest.</p>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Name */}
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
              <span className="material-symbols-outlined text-blue-600 text-2xl">badge</span>
              Patient Name
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">First Name <span className="text-red-500">*</span></label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="First Name" value={givenName} onChange={e => setGivenName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Middle Name</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="Middle Name" value={middleName} onChange={e => setMiddleName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Last Name <span className="text-red-500">*</span></label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="Last Name" value={familyName} onChange={e => setFamilyName(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Demographics */}
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
              <span className="material-symbols-outlined text-blue-600 text-2xl">diversity_3</span>
              Demographics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Gender <span className="text-red-500">*</span></label>
                <select
                  className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm appearance-none transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05] cursor-pointer"
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                >
                  <option value="" disabled>Select Gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Date of Birth <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-4">
                  <input
                    type="date"
                    className="flex-1 bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
                    value={birthdate}
                    onChange={e => setBirthdate(e.target.value)}
                  />
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-black/50 whitespace-nowrap bg-black/5 px-3 py-3.5 rounded-xl hover:bg-black/10 transition-colors">
                    <input type="checkbox" checked={estimated} onChange={e => setEstimated(e.target.checked)} className="rounded border-black/20 text-blue-600 w-4 h-4 cursor-pointer" />
                    Est.
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
              <span className="material-symbols-outlined text-blue-600 text-2xl">location_on</span>
              Address Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">House No / Flat No</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="House number" value={houseNo} onChange={e => setHouseNo(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Locality / Sector</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="Locality" value={locality} onChange={e => setLocality(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">City / Village</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="City" value={cityVillage} onChange={e => setCityVillage(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Pin Code</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="Pin Code" value={pinCode} onChange={e => setPinCode(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">District</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="District" value={district} onChange={e => setDistrict(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">State</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="State" value={state} onChange={e => setStateVal(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
              <span className="material-symbols-outlined text-blue-600 text-2xl">call</span>
              Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Email Address</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="email@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Phone Number</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="Phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Alternate Phone</label>
                <input className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]" placeholder="Alternate" type="tel" value={altPhone} onChange={e => setAltPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Action Buttons — Bahmni-style Save + Start Visit split button */}
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Save button */}
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={saving}
                className="flex-shrink-0 bg-black/[0.03] text-black border-2 border-transparent hover:bg-black/[0.06] font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm hover:scale-[1.02] active:scale-100"
              >
                {saving ? (
                  <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Saving...</>
                ) : (
                  <><span className="material-symbols-outlined text-lg">save</span> Save Draft</>
                )}
              </button>

              {/* Start Visit split button */}
              <div className="flex-1 flex relative">
                <button
                  type="button"
                  onClick={() => handleStartVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-l-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)]"
                >
                  <span className="material-symbols-outlined text-lg">personal_injury</span>
                  Start OPD Visit
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVisitDropdownOpen(!visitDropdownOpen)}
                    disabled={saving}
                    className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-4 px-4 rounded-r-2xl border-l border-white/20 transition-all disabled:opacity-50 shadow-[10px_10px_30px_-10px_rgba(37,99,235,0.5)]"
                  >
                    <span className="material-symbols-outlined text-lg">{visitDropdownOpen ? "expand_less" : "expand_more"}</span>
                  </button>

                  {/* Dropdown */}
                  {visitDropdownOpen && (
                    <div className="absolute bottom-full right-0 mb-3 bg-white border border-black/10 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden z-20 min-w-[240px]">
                      <button
                        type="button"
                        onClick={() => handleStartVisit("ff237ff8-b5c0-46a6-9abc-1017c6a0ff10", "Emergency")}
                        className="w-full px-5 py-4 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3 font-bold border-l-4 border-transparent hover:border-red-500"
                      >
                        <span className="material-symbols-outlined text-xl">local_hospital</span>
                        Start Emergency Visit
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
