/* Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license. See LICENSE-NOTICE.md. */

package com.guichaguri.trackplayer.service.player;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Process;
import android.util.Log;
import java.util.Random;

/** Continuous synthesis only: no tracks, media session, history events or audio focus requests. */
public final class NoiseMixer {
    private static final int RATE = 24000;
    private final float[] targets = new float[5];
    private final float[] levels = new float[5];
    private volatile float timerGain = 1;
    private volatile boolean released;
    private volatile boolean muted;
    private Thread worker;

    public static int index(String id) {
        if (id == null) return -1;
        switch (id) {
            case "rain": return 0;
            case "fire": return 1;
            case "ocean": return 2;
            case "cafe": return 3;
            case "fan": return 4;
            default: return -1;
        }
    }

    public synchronized void set(String id, boolean enabled, double volume) {
        int i = index(id);
        if (released || i < 0) return;
        targets[i] = enabled ? (float) Math.max(0, Math.min(1, volume)) : 0;
        if (enabled) muted = false;
        if (worker == null && enabled) {
            worker = new Thread(this::generate, "LuxNoisePCM");
            worker.start();
        }
        notifyAll();
    }

    public synchronized void stopAll() {
        muted = true;
        for (int i = 0; i < targets.length; i++) targets[i] = 0;
        notifyAll();
    }

    public void setTimerGain(float gain) { timerGain = Math.max(0, Math.min(1, gain)); }

    public synchronized void release() {
        released = true;
        notifyAll();
        // AudioTrack belongs exclusively to worker; it releases in finally after a bounded write.
    }

    private synchronized boolean active() {
        for (int i = 0; i < targets.length; i++) {
            if (targets[i] > 0 || levels[i] > 0.00001f) return true;
        }
        return false;
    }

    private void generate() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
        AudioTrack track = null;
        Random random = new Random();
        short[] pcm = new short[480];
        float[] desired = new float[5];
        double[] sounds = new double[5];
        double low = 0, brown = 0, pink = 0, crackle = 0, phase = 0, outputGain = 0;
        try {
            int minimum = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            track = new AudioTrack(
                    new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build(),
                    new AudioFormat.Builder().setSampleRate(RATE)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build(),
                    Math.max(minimum, 1920), AudioTrack.MODE_STREAM, AudioManager.AUDIO_SESSION_ID_GENERATE);
            while (!released) {
                synchronized (this) {
                    while (!released && !active()) {
                        if (track.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) { track.pause(); track.flush(); }
                        wait();
                    }
                    System.arraycopy(targets, 0, desired, 0, 5);
                }
                if (released) break;
                if (track.getPlayState() != AudioTrack.PLAYSTATE_PLAYING) track.play();
                for (int n = 0; n < pcm.length; n++) {
                    double white = random.nextDouble() * 2 - 1;
                    low += 0.12 * (white - low);
                    brown = (brown + 0.025 * white) / 1.002;
                    pink = 0.985 * pink + 0.015 * white;
                    crackle *= 0.985;
                    if (random.nextDouble() < 0.0006) crackle += random.nextDouble() * 0.7;
                    phase += 1.0 / RATE;
                    double wave = 0.5 + 0.5 * Math.sin(phase * 0.65);
                    sounds[0] = low * 1.8 + white * 0.12;
                    sounds[1] = brown * 2 + crackle * white;
                    sounds[2] = (low + brown) * (0.25 + wave);
                    sounds[3] = pink * 3 * (0.8 + 0.2 * Math.sin(phase * 2.1));
                    sounds[4] = low * 1.4 + Math.sin(phase * Math.PI * 120) * 0.04;
                    double mix = 0;
                    for (int i = 0; i < 5; i++) {
                        // 30ms dezipper: continuous filter/oscillator state across every buffer.
                        levels[i] += (desired[i] - levels[i]) / 720;
                        mix += sounds[i] * levels[i];
                    }
                    outputGain += ((muted ? 0 : timerGain) - outputGain) / 240;
                    pcm[n] = (short) (Math.tanh(mix * 0.3) * 26000 * outputGain);
                }
                int offset = 0;
                while (!released && offset < pcm.length) {
                    int written = track.write(pcm, offset, pcm.length - offset);
                    if (written <= 0) throw new IllegalStateException("PCM write failed: " + written);
                    offset += written;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException e) {
            Log.e("LuxNoisePCM", "Noise output unavailable", e);
        } finally {
            if (track != null) { track.release(); }
            synchronized (this) { worker = null; }
        }
    }
}
