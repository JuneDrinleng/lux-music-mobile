/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

package cn.lux.music.mobile.utils;

import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class UtilsEvent {
  final String SCREEN_STATE = "screen-state";
  final String SCREEN_SIZE_CHANGED = "screen-size-changed";

  private final ReactApplicationContext reactContext;
  UtilsEvent(ReactApplicationContext reactContext) { this.reactContext = reactContext; }

  public void sendEvent(String eventName, @Nullable WritableMap params) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }
}
