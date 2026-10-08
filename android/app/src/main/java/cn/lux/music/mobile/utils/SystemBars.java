/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

package cn.lux.music.mobile.utils;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;

import androidx.core.view.WindowCompat;

/**
 * Edge-to-edge bars stay transparent. Icon color follows the Lux theme:
 * dark glyphs on light themes, light glyphs on 墨夜.
 */
public final class SystemBars {
    private static boolean darkIcons = true;

    private SystemBars() {}

    public static void setDarkIcons(boolean enabled) {
        darkIcons = enabled;
    }

    public static void apply(Activity activity) {
        if (activity == null) return;
        activity.runOnUiThread(() -> applyWindow(activity.getWindow()));
    }

    public static void applyWindow(Window window) {
        if (window == null) return;
        WindowCompat.setDecorFitsSystemWindows(window, false);
        View decorView = window.getDecorView();
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if (darkIcons) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        }
        decorView.setSystemUiVisibility(flags);

        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(darkIcons ? mask : 0, mask);
            }
        }
    }
}
