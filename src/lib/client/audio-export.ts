// Concatenates several audio files (fetched from same-origin URLs) into one
// downloadable WAV blob, entirely client-side -- no ffmpeg/server dependency.
// Each segment's audio may come back at a different sample rate/channel
// count, so playback is rendered through an OfflineAudioContext (which
// resamples every connected source to its own sample rate automatically)
// rather than concatenating raw PCM buffers directly.
const EXPORT_SAMPLE_RATE = 44100;

async function decodeSegment(url: string, audioContext: AudioContext | OfflineAudioContext): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch segment audio (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: numChannels }, (_, ch) => buffer.getChannelData(ch));
  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function exportSegmentsAsWav(urls: string[]): Promise<Blob> {
  if (urls.length === 0) throw new Error("No segments to export");

  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const scratchContext = new AudioContextCtor();

  let buffers: AudioBuffer[];
  try {
    buffers = await Promise.all(urls.map((url) => decodeSegment(url, scratchContext)));
  } finally {
    void scratchContext.close();
  }

  const numChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const totalSeconds = buffers.reduce((sum, b) => sum + b.duration, 0);
  const offlineContext = new OfflineAudioContext(numChannels, Math.ceil(totalSeconds * EXPORT_SAMPLE_RATE), EXPORT_SAMPLE_RATE);

  let cursor = 0;
  for (const buffer of buffers) {
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(cursor);
    cursor += buffer.duration;
  }

  const rendered = await offlineContext.startRendering();
  return encodeWav(rendered);
}
