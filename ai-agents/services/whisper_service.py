import asyncio
import os
import re
import tempfile
from typing import Any

from dotenv import load_dotenv

load_dotenv()

WHISPER_MODE = os.getenv("WHISPER_MODE", "local")
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
WHISPER_INITIAL_PROMPT = os.getenv(
    "WHISPER_INITIAL_PROMPT",
    (
        "Medical consultation between doctor and patient. Common terms include dengue, platelet count, "
        "paracetamol, azithromycin, fever, chest pain, shortness of breath, CBC, ECG, creatinine, and antibiotics."
    ),
)

# Lazy import faster_whisper only when local transcription runs so the API can boot
# if that optional dependency is missing (transcript-only / openai mode still works).
_model: Any = None


def get_whisper_model() -> Any:
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel

            _model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device="cpu",
                compute_type="int8",
                cpu_threads=4,
            )
        except Exception as e:
            raise RuntimeError(
                "Could not load local Whisper model. Use WHISPER_MODE=openai with OPENAI_API_KEY, "
                "or paste transcript in the UI instead of recording."
            ) from e
    return _model


async def transcribe_audio(audio_bytes: bytes, language: str | None = None) -> str:
    if WHISPER_MODE == "openai":
        import openai

        client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            fname = f.name
        try:
            with open(fname, "rb") as f:
                transcript = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    language=language or "en",
                )
            return transcript.text or ""
        finally:
            os.unlink(fname)

    def _run_local() -> str:
        model = get_whisper_model()
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            fname = f.name
        try:
            segments, _info = model.transcribe(
                fname,
                language=language,
                beam_size=7,
                best_of=3,
                temperature=0.0,
                condition_on_previous_text=True,
                initial_prompt=WHISPER_INITIAL_PROMPT,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500},
            )
            return " ".join(seg.text for seg in segments).strip()
        finally:
            os.unlink(fname)

    return await asyncio.to_thread(_run_local)


def _group_text_chunks(text: str) -> list[dict]:
    parts = [
        part.strip()
        for part in re.split(r"(?<=[.!?])\s+|\n+", text.strip())
        if part.strip()
    ]
    return [
        {
            "speaker": "unknown",
            "confidence": "low",
            "text": part,
        }
        for part in parts[:12]
    ]


def _whisperx_auth_token() -> str | None:
    return (
        os.getenv("PYANNOTE_AUTH_TOKEN")
        or os.getenv("HF_TOKEN")
        or os.getenv("HUGGINGFACE_TOKEN")
        or ""
    ).strip() or None


async def transcribe_audio_with_metadata(
    audio_bytes: bytes,
    language: str | None = None,
) -> dict:
    mode = (os.getenv("WHISPER_DIARIZATION_MODE") or os.getenv("WHISPER_MODE") or "local").strip().lower()

    if mode in ("whisperx", "auto", "diarize"):
        try:
            return await asyncio.to_thread(_run_whisperx, audio_bytes, language)
        except Exception:
            pass

    transcript = await transcribe_audio(audio_bytes, language=language)
    return {
        "transcript": transcript,
        "speaker_turns": _group_text_chunks(transcript),
        "transcription_mode": f"fallback:{mode}",
        "diarization_available": False,
    }


def _run_whisperx(audio_bytes: bytes, language: str | None = None) -> dict:
    import whisperx

    device = os.getenv("WHISPERX_DEVICE", "cpu")
    compute_type = os.getenv("WHISPERX_COMPUTE_TYPE", "int8")
    model_name = os.getenv("WHISPERX_MODEL_SIZE", os.getenv("WHISPER_MODEL_SIZE", "base"))
    hf_token = _whisperx_auth_token()

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio_bytes)
        fname = f.name

    try:
        audio = whisperx.load_audio(fname)
        model = whisperx.load_model(model_name, device, compute_type=compute_type, language=language)
        result = model.transcribe(audio, batch_size=4, language=language)

        language_code = result.get("language") or language or "en"
        align_model, metadata = whisperx.load_align_model(language_code=language_code, device=device)
        aligned = whisperx.align(
            result["segments"],
            align_model,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )
        segments = aligned.get("segments", [])
        transcript = " ".join(str(seg.get("text") or "").strip() for seg in segments).strip()

        speaker_turns: list[dict] = []
        diarization_available = False
        if hf_token:
            diarize_model = whisperx.DiarizationPipeline(use_auth_token=hf_token, device=device)
            diarize_segments = diarize_model(audio)
            assigned = whisperx.assign_word_speakers(diarize_segments, aligned)
            grouped: list[dict] = []
            for seg in assigned.get("segments", []):
                text = str(seg.get("text") or "").strip()
                if not text:
                    continue
                speaker = str(seg.get("speaker") or "unknown").lower()
                current = {
                    "speaker": speaker if speaker else "unknown",
                    "confidence": "high",
                    "text": text,
                }
                if grouped and grouped[-1]["speaker"] == current["speaker"]:
                    grouped[-1]["text"] = f"{grouped[-1]['text']} {text}".strip()
                else:
                    grouped.append(current)
            speaker_turns = grouped[:12]
            diarization_available = len(speaker_turns) > 0

        if not speaker_turns:
            speaker_turns = _group_text_chunks(transcript)

        return {
            "transcript": transcript,
            "speaker_turns": speaker_turns,
            "transcription_mode": "whisperx",
            "diarization_available": diarization_available,
        }
    finally:
        os.unlink(fname)
