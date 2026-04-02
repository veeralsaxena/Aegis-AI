"use client";

import React, { useEffect, useState } from "react";

interface PatientAvatarProps {
  patientUuid: string;
  authFetch: (url: string, options?: any) => Promise<Response>;
  className?: string;
  iconClassName?: string;
}

export default function PatientAvatar({
  patientUuid,
  authFetch,
  className = "w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden",
  iconClassName = "text-primary text-sm",
}: PatientAvatarProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;

    async function fetchImage() {
      try {
        // Bahmni usually stores images under personimage endpoints
        // Try the common Bahmni format
        const res = await authFetch(`/openmrs/ws/rest/v1/personimage/${patientUuid}`);
        if (!res.ok) {
          throw new Error("Failed to fetch");
        }
        
        // Wait, normally Bahmni's personimage endpoint returns `{ "base64EncodedImage": "..." }`
        // Or it returns the binary data directly. Let's handle both.
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            if (data && data.base64EncodedImage) {
                if (mounted) setImgSrc(`data:image/jpeg;base64,${data.base64EncodedImage}`);
                return;
            } else if (data && data.personimage) {
                // some versions
                if (mounted) setImgSrc(`data:image/jpeg;base64,${data.personimage}`);
                return;
            }
        }
        
        const blob = await res.blob();
        if (blob.size > 0 && blob.type.startsWith("image/")) {
          objectUrl = URL.createObjectURL(blob);
          if (mounted) setImgSrc(objectUrl);
        } else {
          throw new Error("Invalid image");
        }
      } catch (err) {
        if (mounted) setError(true);
      }
    }

    if (patientUuid) fetchImage();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [patientUuid, authFetch]);

  if (error || !imgSrc) {
    return (
      <div className={className}>
        <span className={`material-symbols-outlined ${iconClassName}`}>person</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <img src={imgSrc} alt="Patient Avatar" className="w-full h-full object-cover" />
    </div>
  );
}
