"use client";

import React, { useEffect, useState } from "react";

interface PatientAvatarProps {
  /** OpenMRS patient UUID */
  patientUuid: string;
  /** If known, OpenMRS person UUID (image APIs often use this) */
  personUuid?: string | null;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  className?: string;
  iconClassName?: string;
}

async function resolvePersonUuid(
  authFetch: PatientAvatarProps["authFetch"],
  patientUuid: string
): Promise<string> {
  try {
    const r = await authFetch(
      `/openmrs/ws/rest/v1/patient/${patientUuid}?v=custom:(uuid,person:(uuid))`
    );
    if (r.ok) {
      const j = await r.json();
      if (j.person?.uuid) return j.person.uuid as string;
    }
  } catch {
    /* ignore */
  }
  return patientUuid;
}

export default function PatientAvatar({
  patientUuid,
  personUuid: personUuidProp,
  authFetch,
  className = "w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden",
  iconClassName = "text-primary text-sm",
}: PatientAvatarProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;

    async function loadImage() {
      try {
        if (mounted) {
          setError(false);
          setImgSrc(null);
        }
        const personUuid =
          personUuidProp && personUuidProp.length > 0
            ? personUuidProp
            : await resolvePersonUuid(authFetch, patientUuid);

        // Bahmni/OpenMRS: registration uses `patientImage?patientUuid=` (camelCase), not `patientimage/{uuid}`.
        const tryUrls = [
          `/openmrs/ws/rest/v1/personimage/${personUuid}`,
          `/openmrs/ws/rest/v1/personimage/${patientUuid}`,
          `/openmrs/ws/rest/v1/patientImage?patientUuid=${encodeURIComponent(patientUuid)}&q=${Date.now()}`,
        ];

        for (const url of tryUrls) {
          const res = await authFetch(url);
          if (!res.ok) continue;

          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            const b64 =
              data?.base64EncodedImage ||
              data?.personimage ||
              data?.image ||
              data?.results?.[0]?.base64EncodedImage;
            if (b64 && mounted) {
              setImgSrc(`data:image/jpeg;base64,${b64}`);
              return;
            }
            continue;
          }

          const blob = await res.blob();
          if (blob.size > 0) {
            objectUrl = URL.createObjectURL(blob);
            if (mounted) setImgSrc(objectUrl);
            return;
          }
        }

        if (mounted) setError(true);
      } catch {
        if (mounted) setError(true);
      }
    }

    if (patientUuid) {
      loadImage();
    }

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [patientUuid, personUuidProp, authFetch]);

  if (error || !imgSrc) {
    return (
      <div className={className}>
        <span className={`material-symbols-outlined ${iconClassName}`}>person</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <img src={imgSrc} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
