'use client';

import type { TranscriptSegment } from '@/lib/types';

interface DeepgramOptions {
  apiKey: string;
  onSegment: (seg: TranscriptSegment) => void;
  onSpeechEnd: (text: string) => void;
  onSpeechStarted?: () => void;
  onSpeechEnded?: () => void;
  onOpen: () => void;
  onClose: () => void;
  onError: (err: string) => void;
}

export class DeepgramStream {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private reconnectAttempts = 0;
  private maxReconnect = 5;
  private shouldRun = false;
  private opts: DeepgramOptions;
  private utteranceBuffer = '';
  private speechActive = false;

  constructor(opts: DeepgramOptions) {
    this.opts = opts;
  }

  async start(stream: MediaStream) {
    this.shouldRun = true;
    this.stream = stream;
    await this.connect();
    this.startCapture();
  }

  private async connect() {
    const params = new URLSearchParams({
      model: 'nova-3',
      smart_format: 'true',
      interim_results: 'true',
      endpointing: '350',
      utterance_end_ms: '1200',
      vad_events: 'true',
      punctuate: 'true',
      diarize: 'false',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
    });
    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    this.ws = new WebSocket(url, ['token', this.opts.apiKey]);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.opts.onOpen();
    };
    this.ws.onclose = () => {
      this.opts.onClose();
      if (this.shouldRun) this.tryReconnect();
    };
    this.ws.onerror = () => {
      this.opts.onError('Deepgram WebSocket error');
    };
    this.ws.onmessage = (ev) => this.handleMessage(ev);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);

            // VAD events — detect when the interviewer starts/stops speaking
      if (data.type === 'SpeechStarted') {
        this.speechActive = true;
        this.opts.onSpeechStarted?.();
        return;
      }

      if (data.type === 'SpeechEnded') {
        this.speechActive = false;
        this.opts.onSpeechEnded?.();
        const text = this.utteranceBuffer.trim();
        this.utteranceBuffer = '';
        if (text) this.opts.onSpeechEnd(text);
        return;
      }

      if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
        const alt = data.channel.alternatives[0];
        const isFinal = Boolean(data.is_final);
        const seg: TranscriptSegment = {
          id: `${data.start}-${data.duration}`,
          text: alt.transcript ?? '',
          isFinal,
          speaker: alt.speaker ?? 0,
          start: data.start ?? 0,
          duration: data.duration ?? 0,
          confidence: alt.confidence ?? 0,
        };
        if (seg.text.trim()) {
          // Accumulate final segments into the utterance buffer
          if (isFinal) {
            this.utteranceBuffer = (this.utteranceBuffer + ' ' + seg.text).trim();
          }
          this.opts.onSegment(seg);
        }
      }
    } catch {
      // ignore
    }
  }

  private startCapture() {
    if (!this.stream || !this.ws) return;
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = floatTo16(input);
        if (this.ws.bufferedAmount < 16384) {
          this.ws.send(pcm.buffer as ArrayBuffer);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);
    } catch (err) {
      this.opts.onError(`Audio capture failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect) {
      this.opts.onError('Deepgram connection lost after multiple retries.');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * this.reconnectAttempts, 5000);
    setTimeout(() => {
      if (this.shouldRun) this.connect();
    }, delay);
  }

  stop() {
    this.shouldRun = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stream = null;
    this.utteranceBuffer = '';
    this.speechActive = false;
  }
}

function floatTo16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}