/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

package cn.lux.music.mobile;

import android.os.Bundle;

import com.reactnativenavigation.NavigationActivity;

import cn.lux.music.mobile.utils.SystemBars;

public class MainActivity extends NavigationActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyTransparentSystemBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyTransparentSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyTransparentSystemBars();
    }

    private void applyTransparentSystemBars() {
        SystemBars.applyWindow(getWindow());
    }

}
