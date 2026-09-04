"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Screen_patient_registration() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [registeredPatient, setRegisteredPatient] = useState<any>(null);
  
  // State for form fields
  const [givenName, setGivenName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [estimated, setEstimated] = useState(false);
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setPhotoBlob(e.target.files[0]);
  };

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
      setPhotoBlob(null);
    } catch (err) {
      console.error("Camera access denied:", err);
      setMessage({ type: "error", text: "Camera access denied. Please manually upload a photo instead."});
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 300, 300);
        canvasRef.current.toBlob((blob) => {
          if (blob) setPhotoBlob(blob);
        }, 'image/jpeg');
        stopCamera();
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async () => {
    if (!givenName || !familyName || !gender || !birthdate) {
      setMessage({ type: "error", text: "First Name, Last Name, Date of Birth, and Gender are heavily restricted mandatory fields." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Step 1: Use Bahmnicore patientprofile to automatically trigger the backend ID Generator
      const patientPayload = {
        patient: {
          person: {
            names: [{ givenName, middleName, familyName, preferred: true }],
            gender,
            birthdate,
            birthdateEstimated: estimated,
            addresses: [{ address1: address, cityVillage: address }]
          },
          identifiers: [
            {
              identifierSourceUuid: "c5cf4b68-6529-43fc-a644-c775ae73745e", 
              identifierPrefix: "GAN",
              identifierType: "b9a9e100-f496-11ed-b02c-0242ac150003",
              preferred: true,
              voided: false
            }
          ]
        },
        relationships: []
      };

      const patientRes = await authFetch("/openmrs/ws/rest/v1/bahmnicore/patientprofile", {
        method: "POST",
        body: JSON.stringify(patientPayload),
      });

      if (!patientRes.ok) throw new Error((await patientRes.json()).error?.message || "Failed to create patient via Bahmni Core API");
      
      const responseData = await patientRes.json();
      const patient = responseData.patient || responseData; // Handling wrapper nuances

      if (photoBlob && patient?.uuid) {
        const reader = new FileReader();
        const b64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(photoBlob);
        });
        await authFetch(`/openmrs/ws/rest/v1/bahmnicore/patientprofile/${patient.uuid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient,
            image: b64,
            relationships: Array.isArray(responseData.relationships) ? responseData.relationships : [],
          }),
        });
      }

      setRegisteredPatient(patient);
      setMessage({ type: "success", text: `Patient ${givenName} ${familyName} registered successfully. You can now start a visit.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Registration critical sequence failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartVisit = async (visitTypeUuid: string, visitName: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch("/openmrs/ws/rest/v1/visit", {
        method: "POST",
        body: JSON.stringify({
          patient: registeredPatient.uuid,
          visitType: visitTypeUuid,
          location: "833d0c66-e29a-4d31-ac13-ca9050d1bfa9" // Standard General Ward location
        })
      });
      if (!res.ok) throw new Error(`Failed to start ${visitName} visit`);
      setMessage({ type: "success", text: `${visitName} Visit Started Successfully!` });
      setTimeout(() => router.push(`/patients/${registeredPatient.uuid}`), 1000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
      setSaving(false);
    }
  };

  return (
    <div className="font-display text-slate-100 min-h-screen flex flex-col -m-8">
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden bg-background-dark/80">
        {/* Added background meshes */}
        <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-screen" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-HaSwB-iBEftYAyerdJJhFf3jLPAwL_GDX3tbskIdeFjVXSodJ2-76kfR5FMbXKmel4xaT51ooAbgPWhk5BRaAGhhFhuNHtm2gK236-au1VoVVk4p-h1YyPsM2awpryTVI3DrxoSDx-XE-bJtIgBQwQgKYYTaVXt8nyET_0ZFzawrdPzYVIxkUYZ5ozydYBxl_8YXmrSs8dJpA2O57741XVExWumueI7NM8S6N7tbJEsQ9_7yI_kdW6vAXDus6Wmw1Qr8ygXLm8Jh")' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-[#050B10]/95 via-[#050B10]/80 to-primary/20" />
        
        <div className="relative z-10 w-full max-w-6xl rounded-2xl overflow-hidden shadow-lg flex flex-col md:flex-row glass-panel">
          {/* Left Side: Upload Zone */}
          <div className="w-full md:w-2/5 p-8 md:p-12 border-b md:border-b-0 md:border-r border-border-dark flex flex-col">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Registration</h2>
              <p className="text-slate-400 text-sm mb-10">Securely onboard a new patient into the Aegis AI network.</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border-dark rounded-xl p-8 glass-card transition-colors relative">
              <canvas ref={canvasRef} width="300" height="300" className="hidden" />
              
              {isCameraOpen ? (
                <div className="flex flex-col items-center z-10">
                  <video ref={videoRef} autoPlay playsInline className="w-48 h-48 object-cover rounded-full mb-4 border-4 border-primary/50 shadow-lg bg-background-dark" />
                  <div className="flex gap-2">
                    <button type="button" onClick={capturePhoto} className="bg-primary text-background-dark font-bold rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors flex items-center gap-2">
                       <span className="material-symbols-outlined text-sm">camera_alt</span> Capture
                    </button>
                    <button type="button" onClick={stopCamera} className="bg-red-500/20 text-red-500 border border-red-500/30 font-bold rounded-lg px-4 py-2 hover:bg-red-500/30 transition-colors flex items-center gap-1">
                       Cancel
                    </button>
                  </div>
                </div>
              ) : photoBlob ? (
                <div className="flex flex-col items-center z-10 w-full">
                  <img src={URL.createObjectURL(photoBlob)} alt="Preview" className="w-48 h-48 object-cover rounded-full mb-4 border-4 border-primary/30" />
                  <div className="flex gap-2 relative">
                     <button type="button" onClick={startCamera} className="bg-primary/20 text-primary border border-primary/30 rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-primary/30 transition-colors">
                       Capture New Identity
                     </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center group cursor-pointer z-10" onClick={startCamera}>
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all shadow-lg">
                    <span className="material-symbols-outlined text-4xl text-primary pointer-events-none">add_a_photo</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 text-center pointer-events-none">Capture Patient Identity</h3>
                  <p className="text-sm text-slate-400 text-center max-w-[250px] mb-6 pointer-events-none">Start WebRTC Native Camera Feed to authenticate profile visually.</p>
                </div>
              )}
              
              {!isCameraOpen && (
                <div className="absolute bottom-6 opacity-60 text-xs">
                  <label className="cursor-pointer hover:underline text-primary/80 transition-all">
                    Or upload file manually
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>
            <div className="mt-8 flex items-center gap-3 text-sm text-slate-400 glass-card p-4 rounded-lg">
              <span className="material-symbols-outlined text-primary text-xl">shield</span>
              <p>All uploads are encrypted and HIPAA compliant.</p>
            </div>
          </div>
          
          {/* Right Side: Demographic Form */}
          <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-semibold text-white">Demographic Details</h3>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">Step 1 of 2</span>
            </div>
            
            {message && (
              <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
                  {message.type === "success" ? "check_circle" : "error"}
                </span>
                <p className={`text-sm font-medium ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>{message.text}</p>
              </div>
            )}

            <form className="space-y-6 flex-1 flex flex-col" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Patient Name *</label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input className="w-full glass-card border border-border-dark focus:border-primary text-white p-3 rounded-lg outline-none" placeholder="First Name *" value={givenName} onChange={e=>setGivenName(e.target.value)} />
                    <input className="w-full glass-card border border-border-dark focus:border-primary text-white p-3 rounded-lg outline-none" placeholder="Middle Name" value={middleName} onChange={e=>setMiddleName(e.target.value)} />
                    <input className="w-full glass-card border border-border-dark focus:border-primary text-white p-3 rounded-lg outline-none" placeholder="Last Name" value={familyName} onChange={e=>setFamilyName(e.target.value)} />
                  </div>
                </div>

                {/* Date of Birth & Estimated */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Date of Birth *</label>
                  <div className="flex items-center gap-3">
                    <div className="relative glass-card border border-border-dark focus-within:border-primary focus-within:shadow-lg transition-all rounded-lg flex-1 overflow-hidden">
                      <input 
                        className="w-full bg-transparent border-none text-white px-4 py-3 focus:ring-0 placeholder-slate-500 outline-none [color-scheme:dark]" 
                        type="date"
                        value={birthdate}
                        onChange={e => setBirthdate(e.target.value)}
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                      <input type="checkbox" checked={estimated} onChange={e=>setEstimated(e.target.checked)} className="rounded border-border-dark bg-black/50 text-primary" />
                      Estimated
                    </label>
                  </div>
                </div>

                {/* Gender Component */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Gender Identity</label>
                  <div className="relative glass-card border border-border-dark focus-within:border-primary focus-within:shadow-lg transition-all rounded-lg flex items-center overflow-hidden">
                    <span className="material-symbols-outlined text-slate-400 pl-4 text-sm">transgender</span>
                    <select 
                      className="w-full bg-transparent border-none text-white px-4 py-3 focus:ring-0 appearance-none cursor-pointer outline-none"
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                    >
                      <option className="text-slate-500 bg-background-dark" disabled value="">Select gender</option>
                      <option className="bg-background-dark" value="F">Female</option>
                      <option className="bg-background-dark" value="M">Male</option>
                      <option className="bg-background-dark" value="O">Other</option>
                    </select>
                    <span className="material-symbols-outlined text-slate-400 pr-4 pointer-events-none absolute right-0">expand_more</span>
                  </div>
                </div>

                {/* Contact Number */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Contact Number</label>
                  <div className="relative glass-card border border-border-dark focus-within:border-primary focus-within:shadow-lg transition-all rounded-lg flex items-center overflow-hidden">
                    <span className="material-symbols-outlined text-slate-400 pl-4 text-sm">call</span>
                    <input 
                      className="w-full bg-transparent border-none text-white px-4 py-3 focus:ring-0 placeholder-slate-500 outline-none" 
                      placeholder="(555) 000-0000" 
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Residential Address</label>
                <div className="relative glass-card border border-border-dark focus-within:border-primary focus-within:shadow-lg transition-all rounded-lg flex items-center overflow-hidden">
                  <span className="material-symbols-outlined text-slate-400 pl-4 text-sm">location_on</span>
                  <input 
                    className="w-full bg-transparent border-none text-white px-4 py-3 focus:ring-0 placeholder-slate-500 outline-none" 
                    placeholder="Street Address, City, State, ZIP" 
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-5 rounded-xl glass-card border-border-dark mt-4">
                <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">emergency</span>
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative glass-panel border border-border-dark focus-within:border-primary focus-within:shadow-lg transition-all rounded-lg flex items-center overflow-hidden">
                    <input className="w-full bg-transparent border-none text-white px-4 py-2.5 text-sm focus:ring-0 placeholder-slate-500 outline-none" placeholder="Contact Name" type="text"/>
                  </div>
                  <div className="relative glass-panel border border-border-dark focus-within:border-primary focus-within:shadow-lg transition-all rounded-lg flex items-center overflow-hidden">
                    <input className="w-full bg-transparent border-none text-white px-4 py-2.5 text-sm focus:ring-0 placeholder-slate-500 outline-none" placeholder="Relationship & Number" type="tel"/>
                  </div>
                </div>
              </div>

              <div className="flex-grow"></div>

              {/* Action Buttons */}
              <div className="pt-6 mt-4 border-t border-border-dark flex gap-4">
                {!registeredPatient ? (
                  <button 
                    className="flex-1 liquid-button text-background-dark font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50" 
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                  >
                    {saving ? (
                      <><span className="material-symbols-outlined text-xl animate-spin">progress_activity</span> <span>Saving Identity...</span></>
                    ) : (
                      <><span>Save Registration</span> <span className="material-symbols-outlined text-xl">save</span></>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col w-full gap-3">
                    <button 
                      className="w-full glass-card border border-primary/50 text-primary hover:bg-primary/10 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all" 
                      type="button"
                      onClick={handlePrint}
                    >
                      <span className="material-symbols-outlined text-xl">print</span> <span>Print Registration Card (PDF)</span>
                    </button>
                    <div className="flex gap-3 w-full">
                      <button 
                        className="flex-1 liquid-button text-background-dark font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50" 
                        type="button"
                        onClick={() => handleStartVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                        disabled={saving}
                      >
                        <span className="material-symbols-outlined text-xl">personal_injury</span> <span>Start OPD Visit</span>
                      </button>
                      <button 
                        className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50" 
                        type="button"
                        onClick={() => handleStartVisit("ff237ff8-b5c0-46a6-9abc-1017c6a0ff10", "Emergency")}
                        disabled={saving}
                      >
                        <span className="material-symbols-outlined text-xl">local_hospital</span> <span>Start Emergency</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
