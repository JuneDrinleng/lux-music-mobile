/* Lux Third-Party Patch Notice: repository-maintained patch file for a third-party dependency. Rights remain subject to the upstream dependency license. See LICENSE-NOTICE.md. */

package com.guichaguri.trackplayer.service.player;

import androidx.media3.common.util.UnstableApi;

/** Player-looper only. Independent volume envelope and effect gain never overwrite each other.
 * Simple targets assume -18 LUFS input: -18/-14/-11 request 0/4/7 dB (no analysis).
 * Protection budgets 7 dB total positive boost, conservatively using maximum UI EQ gain.
 * This is headroom budgeting, not a true peak limiter or a measured LUFS normalizer.
 */
@UnstableApi
public final class GainCoordinator {
    private float volume = 1, multiplier = 1, fade = 1;
    private double eqBoost;
    private SessionLoudness loudness;

    public void connect(SessionLoudness effect) { loudness = effect; }
    public float getVolume() { return volume; }
    public float setVolume(float value) { volume = clamp(value); return output(); }
    public float setMultiplier(float value) { multiplier = clamp(value); return output(); }
    public float setFade(float value) { fade = clamp(value); return output(); }
    private static float clamp(float value) { return Float.isNaN(value) ? 0 : Math.max(0, Math.min(1, value)); }
    private float output() { return volume * multiplier * fade; }

    public int loudnessGain(int target, boolean protect) {
        int requested = target == -18 ? 0 : target == -11 ? 700 : 400;
        return protect ? Math.min(requested, (int) Math.max(0, 700 - Math.round(eqBoost * 100))) : requested;
    }

    public void setEqualizer(boolean enabled, double[] gains) {
        double next = 0;
        if (enabled) for (double gain : gains) next = Math.max(next, gain);
        double previous = eqBoost;
        eqBoost = next;
        try {
            if (loudness != null) loudness.refreshGain();
        } catch (RuntimeException error) {
            eqBoost = previous;
            try {
                if (loudness != null) loudness.refreshGain();
            } catch (RuntimeException restoreError) {
                error.addSuppressed(restoreError);
            }
            throw error;
        }
    }
}
