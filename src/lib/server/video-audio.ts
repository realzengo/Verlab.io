// Puts a source clip's own soundtrack back on a render. Object swap promises
// everything but the named change stays as filmed, but Kling 4.0 composes a
// fresh soundtrack for every render (compared against the source on 11-04,
// the envelopes didn't line up), so the clip's audio is copied back on.
//
// Packets are copied as-is -- no decode or encode -- so this runs on the
// server without ffmpeg or WebCodecs, and the picture is untouched.
import {
  ALL_FORMATS,
  BufferSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  type InputAudioTrack,
  type InputVideoTrack,
} from "mediabunny";

async function copyVideo(track: InputVideoTrack, source: EncodedVideoPacketSource): Promise<void> {
  const decoderConfig = await track.getDecoderConfig();
  if (!decoderConfig) throw new Error("Render's video track has no decoder config");
  let first = true;
  for await (const packet of new EncodedPacketSink(track).packets()) {
    await source.add(packet, first ? { decoderConfig } : undefined);
    first = false;
  }
  source.close();
}

/** Copies audio up to `endSeconds`, so a soundtrack a beat longer than the render doesn't run past its last frame. */
async function copyAudio(track: InputAudioTrack, source: EncodedAudioPacketSource, endSeconds: number): Promise<void> {
  const decoderConfig = await track.getDecoderConfig();
  if (!decoderConfig) throw new Error("Source clip's audio track has no decoder config");
  let first = true;
  for await (const packet of new EncodedPacketSink(track).packets()) {
    if (packet.timestamp >= endSeconds) break;
    await source.add(packet, first ? { decoderConfig } : undefined);
    first = false;
  }
  source.close();
}

/**
 * Returns `render` (an MP4) with its audio replaced by `sourceClip`'s, or
 * with no audio at all when the source clip is silent -- either way the
 * soundtrack matches what was filmed.
 */
export async function replaceAudioWithSource(render: Uint8Array, sourceClip: Uint8Array): Promise<Uint8Array> {
  const renderInput = new Input({ source: new BufferSource(render), formats: ALL_FORMATS });
  const sourceInput = new Input({ source: new BufferSource(sourceClip), formats: ALL_FORMATS });
  try {
    const videoTrack = await renderInput.getPrimaryVideoTrack();
    if (!videoTrack?.codec) throw new Error("Render has no readable video track");
    const audioTrack = await sourceInput.getPrimaryAudioTrack();
    const audioCodec = audioTrack?.codec ?? null;

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const videoSource = new EncodedVideoPacketSource(videoTrack.codec);
    output.addVideoTrack(videoSource, { rotation: await videoTrack.getRotation() });
    const audioSource = audioCodec ? new EncodedAudioPacketSource(audioCodec) : null;
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();

    // Both tracks are fed together: the muxer interleaves them and holds one
    // back until the other catches up, so feeding them in turn would stall.
    const renderSeconds = await videoTrack.computeDuration();
    await Promise.all([
      copyVideo(videoTrack, videoSource),
      audioTrack && audioSource ? copyAudio(audioTrack, audioSource, renderSeconds) : Promise.resolve(),
    ]);
    await output.finalize();

    if (!target.buffer) throw new Error("Muxer produced no output");
    return new Uint8Array(target.buffer);
  } finally {
    renderInput.dispose();
    sourceInput.dispose();
  }
}
