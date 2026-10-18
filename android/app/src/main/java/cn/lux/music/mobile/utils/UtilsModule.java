/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

package cn.lux.music.mobile.utils;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.Context;
import android.content.ContentValues;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Environment;
import android.media.MediaScannerConnection;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.app.LocaleManagerCompat;
import androidx.core.content.FileProvider;
import androidx.core.os.LocaleListCompat;
import cn.lux.music.mobile.BuildConfig;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

public class UtilsModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;

  private int listenerCount = 0;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private ConnectivityManager.NetworkCallback networkCallback;
  private boolean lastUnmetered = false;

  UtilsEvent utilsEvent;

  UtilsModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    utilsEvent = new UtilsEvent(reactContext);
    registerScreenBroadcastReceiver();
    registerNetworkCallback();
  }

  @Override
  public void invalidate() {
    unregisterNetworkCallback();
    super.invalidate();
  }

  @Override
  public String getName() {
    return "UtilsModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  private void registerScreenBroadcastReceiver() {
    final IntentFilter theFilter = new IntentFilter();
    /** System Defined Broadcast */
    theFilter.addAction(Intent.ACTION_SCREEN_ON);
    theFilter.addAction(Intent.ACTION_SCREEN_OFF);

    BroadcastReceiver screenOnOffReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        String strAction = intent.getAction();

        WritableMap params = Arguments.createMap();

        switch (Objects.requireNonNull(strAction)) {
          case Intent.ACTION_SCREEN_OFF:

            params.putString("state", "OFF");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
          case Intent.ACTION_SCREEN_ON:
            params.putString("state", "ON");
            utilsEvent.sendEvent(utilsEvent.SCREEN_STATE, params);
            break;
        }
      }
    };

    reactContext.registerReceiver(screenOnOffReceiver, theFilter);
  }

  @ReactMethod
  public void exitApp() {
    // https://github.com/wumke/react-native-exit-app/blob/master/android/src/main/java/com/github/wumke/RNExitApp/RNExitAppModule.java
    // android.os.Process.killProcess(android.os.Process.myPid());

    // https://stackoverflow.com/questions/6330200/how-to-quit-android-application-programmatically
    Activity currentActivity = reactContext.getCurrentActivity();
    Log.d("Utils", "Exit app...");
    if (currentActivity == null) {
      Log.d("Utils", "killProcess");
      android.os.Process.killProcess(android.os.Process.myPid());
    } else {
      currentActivity.finishAndRemoveTask();
      System.exit(0);
    }
  }

  @ReactMethod
  public void getSupportedAbis(Promise promise) {
    // https://github.com/react-native-device-info/react-native-device-info/blob/ff8f672cb08fa39a887567d6e23e2f08778e8340/android/src/main/java/com/learnium/RNDeviceInfo/RNDeviceModule.java#L877
    WritableArray array = new WritableNativeArray();
    for (String abi : Build.SUPPORTED_ABIS) {
      array.pushString(abi);
    }
    promise.resolve(array);
  }

  @ReactMethod
  public void getBuildInfo(Promise promise) {
    WritableMap params = Arguments.createMap();
    params.putString("applicationId", BuildConfig.APP_PACKAGE_NAME);
    params.putString("providerAuthority", BuildConfig.APP_PROVIDER_AUTHORITY);
    params.putString("releaseAssetPrefix", BuildConfig.RELEASE_ASSET_PREFIX);
    params.putString("updateChannel", BuildConfig.UPDATE_CHANNEL);
    promise.resolve(params);
  }

  @ReactMethod
  public void installApk(String filePath, String fileProviderAuthority, Promise promise) {
    // https://github.com/mikehardy/react-native-update-apk/blob/master/android/src/main/java/net/mikehardy/rnupdateapk/RNUpdateAPK.java
    File file = new File(filePath);
    if (!file.exists()) {
      Log.e("Utils", "installApk: file doe snot exist '" + filePath + "'");
      // FIXME this should take a promise and fail it
      promise.reject("Utils", "installApk: file doe snot exist '" + filePath + "'");
      return;
    }

    if (Build.VERSION.SDK_INT >= 24) {
      // API24 and up has a package installer that can handle FileProvider content:// URIs
      Uri contentUri;
      try {
        contentUri = FileProvider.getUriForFile(getReactApplicationContext(), fileProviderAuthority, file);
      } catch (Exception e) {
        // FIXME should be a Promise.reject really
        Log.e("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'", e);
        promise.reject("Utils", "installApk exception with authority name '" + fileProviderAuthority + "'");
        return;
        // throw e;
      }
      Intent installApp = new Intent(Intent.ACTION_INSTALL_PACKAGE);
      installApp.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      installApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      installApp.setData(contentUri);
      installApp.putExtra(Intent.EXTRA_INSTALLER_PACKAGE_NAME, reactContext.getApplicationInfo().packageName);
      reactContext.startActivity(installApp);
      promise.resolve(null);
    } else {
      // Old APIs do not handle content:// URIs, so use an old file:// style
      String cmd = "chmod 777 " + file;
      try {
        Runtime.getRuntime().exec(cmd);
      } catch (Exception e) {
        // e.printStackTrace();
        Log.e("Utils", "installApk exception : " + e.getMessage(), e);
        promise.reject("Utils", e.getMessage());
      }
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      intent.setDataAndType(Uri.parse("file://" + file), "application/vnd.android.package-archive");
      reactContext.startActivity(intent);
      promise.resolve(null);
    }
  }

  @ReactMethod
  public void screenkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  @ReactMethod
  public void screenUnkeepAwake() {
    // https://github.com/corbt/react-native-keep-awake/blob/master/android/src/main/java/com/corbt/keepawake/KCKeepAwake.java
    final Activity activity = getCurrentActivity();

    if (activity != null) {
      activity.runOnUiThread(() -> {
        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
      });
    }
  }

  /**
   Gets the device's WiFi interface IP address
   @return device's WiFi IP if connected to WiFi, else '0.0.0.0'
   */
  @ReactMethod
  public void getWIFIIPV4Address(final Promise promise) throws Exception {
    // https://github.com/pusherman/react-native-network-info/blob/master/android/src/main/java/com/pusherman/networkinfo/RNNetworkInfo.java
    WifiManager wifi = (WifiManager) reactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    new Thread(new Runnable() {
      public void run() {
        try {
          WifiInfo info = wifi.getConnectionInfo();
          int ipAddress = info.getIpAddress();
          @SuppressLint("DefaultLocale") String stringip = String.format("%d.%d.%d.%d", (ipAddress & 0xff), (ipAddress >> 8 & 0xff),
            (ipAddress >> 16 & 0xff), (ipAddress >> 24 & 0xff));
          promise.resolve(stringip);
        }catch (Exception e) {
          promise.resolve(null);
        }
      }
    }).start();
  }

  /**
   * Active network is unmetered (normal Wi-Fi, ethernet). Uses ConnectivityManager only,
   * so it does not need location permission and does not read the Wi-Fi IP.
   * API 23+ reads NET_CAPABILITY_NOT_METERED. Older releases use !isActiveNetworkMetered().
   */
  @ReactMethod
  public void isActiveNetworkUnmetered(final Promise promise) {
    promise.resolve(readUnmetered(connectivityManager()));
  }

  private ConnectivityManager connectivityManager() {
    return (ConnectivityManager) reactContext.getApplicationContext()
      .getSystemService(Context.CONNECTIVITY_SERVICE);
  }

  private boolean readUnmetered(ConnectivityManager manager) {
    if (manager == null) return false;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) return readUnmeteredModern(manager);
    return readUnmeteredLegacy(manager);
  }

  @TargetApi(Build.VERSION_CODES.M)
  private boolean readUnmeteredModern(ConnectivityManager manager) {
    Network network = manager.getActiveNetwork();
    if (network == null) return false;
    return hasUnmeteredInternet(manager.getNetworkCapabilities(network));
  }

  private boolean hasUnmeteredInternet(NetworkCapabilities caps) {
    if (caps == null) return false;
    if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return false;
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
  }

  @SuppressWarnings("deprecation")
  private boolean readUnmeteredLegacy(ConnectivityManager manager) {
    android.net.NetworkInfo info = manager.getActiveNetworkInfo();
    if (info == null || !info.isConnected()) return false;
    return !manager.isActiveNetworkMetered();
  }

  private void registerNetworkCallback() {
    ConnectivityManager manager = connectivityManager();
    if (manager == null || networkCallback != null) return;
    lastUnmetered = readUnmetered(manager);
    ConnectivityManager.NetworkCallback callback = new ConnectivityManager.NetworkCallback() {
      @Override
      public void onAvailable(Network network) {
        publishUnmetered();
      }

      @Override
      public void onLost(Network network) {
        publishUnmetered();
      }

      @Override
      public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
        publishUnmetered();
      }
    };
    NetworkRequest request = new NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build();
    try {
      manager.registerNetworkCallback(request, callback);
      networkCallback = callback;
    } catch (RuntimeException error) {
      Log.w("Utils", "network callback not registered", error);
    }
  }

  private void unregisterNetworkCallback() {
    ConnectivityManager.NetworkCallback callback = networkCallback;
    networkCallback = null;
    if (callback == null) return;
    ConnectivityManager manager = connectivityManager();
    if (manager == null) return;
    try {
      manager.unregisterNetworkCallback(callback);
    } catch (RuntimeException error) {
      Log.w("Utils", "network callback not unregistered", error);
    }
  }

  private void publishUnmetered() {
    mainHandler.post(() -> {
      if (!reactContext.hasActiveReactInstance()) return;
      boolean unmetered = readUnmetered(connectivityManager());
      if (unmetered == lastUnmetered) return;
      lastUnmetered = unmetered;
      WritableMap params = Arguments.createMap();
      params.putBoolean("unmetered", unmetered);
      utilsEvent.sendEvent("network-unmetered", params);
    });
  }

  // https://stackoverflow.com/a/26117646
  @ReactMethod
  public void getDeviceName(final Promise promise) {
    String manufacturer = Build.MANUFACTURER;
    String model = Build.MODEL;
    if (model.startsWith(manufacturer)) {
      promise.resolve(capitalize(model));
    } else {
      promise.resolve(capitalize(manufacturer) + " " + model);
    }
  }
  private String capitalize(String s) {
    if (s == null || s.isEmpty()) {
      return "";
    }
    char first = s.charAt(0);
    if (Character.isUpperCase(first)) {
      return s;
    } else {
      return Character.toUpperCase(first) + s.substring(1);
    }
  }

  @ReactMethod
  public void isNotificationsEnabled(final Promise promise) {
    new Thread(() -> {
      boolean enabled = NotificationPermissionUtil.isNotificationsEnabled(
        reactContext.getApplicationContext());
      promise.resolve(enabled);
    }).start();
  }

  @ReactMethod
  public void openNotificationPermissionActivity(Promise promise) {
    new Thread(() -> {
      boolean result = NotificationPermissionUtil.openNotificationPermissionActivity(
        reactContext.getApplicationContext());
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void shareText(String shareTitle, String title, String text) {
    Intent shareIntent = new Intent(Intent.ACTION_SEND);
    shareIntent.setType("text/plain");
    shareIntent.putExtra(Intent.EXTRA_TEXT,text);
    shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
    Objects.requireNonNull(reactContext.getCurrentActivity()).startActivity(Intent.createChooser(shareIntent, shareTitle));
  }

  /** Publish a PNG to Pictures/Lux Music. Scoped storage needs no broad permission. */
  @ReactMethod
  public void saveShareCard(String imageUri, Promise promise) {
    new Thread(() -> {
      Uri published = null;
      File legacyFile = null;
      try {
        Uri input = Uri.parse(imageUri);
        if (!"file".equals(input.getScheme()) || input.getPath() == null) throw new IllegalArgumentException("Expected a local capture file");
        File source = new File(input.getPath()).getCanonicalFile();
        String internalRoot = reactContext.getCacheDir().getCanonicalPath() + File.separator;
        File externalCache = reactContext.getExternalCacheDir();
        String externalRoot = externalCache == null ? null : externalCache.getCanonicalPath() + File.separator;
        if (!source.getPath().startsWith(internalRoot) && (externalRoot == null || !source.getPath().startsWith(externalRoot))) throw new IllegalArgumentException("Capture must be in the app cache");
        String name = "Lux-" + UUID.randomUUID() + ".png";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          ContentValues values = new ContentValues();
          values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
          values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
          values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Lux Music");
          values.put(MediaStore.Images.Media.IS_PENDING, 1);
          published = reactContext.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
          if (published == null) throw new java.io.IOException("Cannot create gallery image");
          try (FileInputStream in = new FileInputStream(source); OutputStream out = reactContext.getContentResolver().openOutputStream(published)) {
            if (out == null) throw new java.io.IOException("Cannot open gallery image");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
          }
          values.clear();
          values.put(MediaStore.Images.Media.IS_PENDING, 0);
          if (reactContext.getContentResolver().update(published, values, null, null) != 1) throw new java.io.IOException("Cannot publish gallery image");
          promise.resolve(published.toString());
        } else {
          File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Lux Music");
          if (!directory.isDirectory() && !directory.mkdirs()) throw new java.io.IOException("Cannot create gallery directory");
          legacyFile = new File(directory, name);
          try (FileInputStream in = new FileInputStream(source); FileOutputStream out = new FileOutputStream(legacyFile)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
          }
          final File ready = legacyFile;
          MediaScannerConnection.scanFile(reactContext, new String[] { ready.getAbsolutePath() }, new String[] { "image/png" }, (path, uri) -> {
            if (uri == null) { ready.delete(); promise.reject("SAVE_SHARE_CARD", "Gallery scan failed"); }
            else promise.resolve(uri.toString());
          });
        }
      } catch (Exception error) {
        if (published != null) reactContext.getContentResolver().delete(published, null, null);
        if (legacyFile != null) legacyFile.delete();
        promise.reject("SAVE_SHARE_CARD", error);
      }
    }).start();
  }

  /** Keep a separate copy: the JS capture may be released while another app reads it. */
  @ReactMethod
  public void shareImage(String shareTitle, String imageUri, Promise promise) {
    new Thread(() -> {
      File sharedFile = null;
      try {
        Uri input = Uri.parse(imageUri);
        if (!"file".equals(input.getScheme()) || input.getPath() == null) {
          throw new IllegalArgumentException("Expected a local capture file");
        }
        File source = new File(input.getPath()).getCanonicalFile();
        String internalRoot = reactContext.getCacheDir().getCanonicalPath() + File.separator;
        File externalCache = reactContext.getExternalCacheDir();
        String externalRoot = externalCache == null ? null : externalCache.getCanonicalPath() + File.separator;
        if (!source.getPath().startsWith(internalRoot) &&
            (externalRoot == null || !source.getPath().startsWith(externalRoot))) {
          throw new IllegalArgumentException("Capture must be in the app cache");
        }
        File directory = new File(reactContext.getCacheDir(), "share-cards");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new java.io.IOException("Cannot create share cache");
        File[] previous = directory.listFiles();
        if (previous != null) {
          long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
          for (File file : previous) {
            if (file.lastModified() < cutoff) file.delete();
          }
        }
        sharedFile = new File(directory, UUID.randomUUID() + ".png");
        try (FileInputStream in = new FileInputStream(source); FileOutputStream out = new FileOutputStream(sharedFile)) {
          byte[] buffer = new byte[8192];
          int count;
          while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
        }
        final File ready = sharedFile;
        reactContext.runOnUiQueueThread(() -> {
          try {
            Activity activity = reactContext.getCurrentActivity();
            if (activity == null) throw new IllegalStateException("No foreground activity");
            Uri uri = FileProvider.getUriForFile(reactContext, reactContext.getPackageName() + ".provider", ready);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.setClipData(ClipData.newRawUri("share-card", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(Intent.createChooser(intent, shareTitle));
            promise.resolve(null);
          } catch (Exception error) {
            ready.delete();
            promise.reject("SHARE_IMAGE", error);
          }
        });
      } catch (Exception error) {
        if (sharedFile != null) sharedFile.delete();
        promise.reject("SHARE_IMAGE", error);
      }
    }).start();
  }

  // https://stackoverflow.com/questions/73463341/in-per-app-language-how-to-get-app-locale-in-api-33-if-system-locale-is-diffe
  @ReactMethod
  public void getSystemLocales(Promise promise) {
    Locale locale = null;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      LocaleListCompat list = LocaleManagerCompat.getSystemLocales(reactContext);
      if (!list.isEmpty()) {
        locale = list.get(0);
      } else {
        promise.resolve(null);
        return;
      }
    } else {
      locale = Locale.getDefault();
    }
    if (locale == null) {
      promise.resolve("");
      return;
    }

    // 格式化成 zh_cn、en_us 等
    String language = locale.getLanguage(); // zh, en
    String country = locale.getCountry();   // CN, US
    String localeStr;

    if (!country.isEmpty()) {
      localeStr = language.toLowerCase() + "_" + country.toLowerCase();
    } else {
      localeStr = language.toLowerCase();
    }

    promise.resolve(localeStr);
  }

  // https://github.com/Anthonyzou/react-native-full-screen/blob/master/android/src/main/java/com/rn/full/screen/FullScreen.java
  //  @ReactMethod
  //  public void onFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION // hide nav bar
  //          | View.SYSTEM_UI_FLAG_FULLSCREEN // hide status bar
  //          | View.SYSTEM_UI_FLAG_IMMERSIVE
  //      );
  //    });
  //  }
  //  @ReactMethod
  //  public void offFullScreen() {
  //    UiThreadUtil.runOnUiThread(() -> {
  //      Activity currentActivity = reactContext.getCurrentActivity();
  //      if (currentActivity == null) return;
  //      currentActivity.getWindow().getDecorView().setSystemUiVisibility(
  //        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
  //          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
  //          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
  //      );
  //    });
  //  }

  @ReactMethod
  public void getWindowSize(Promise promise) {
    WritableMap params = Arguments.createMap();

    Activity currentActivity = reactContext.getCurrentActivity();
    if (currentActivity == null) {
      params.putInt("width", 0);
      params.putInt("height", 0);
      promise.resolve(params);
      return;
    }
    // 获取当前应用可用区域大小
    Window window = currentActivity.getWindow();
    Rect rect = new Rect();
    window.getDecorView().getWindowVisibleDisplayFrame(rect);
    // View decorView = window.getDecorView();
    // int width = decorView.getMeasuredWidth();
    // int height = decorView.getMeasuredHeight();
    params.putInt("width", rect.width());
    params.putInt("height", rect.height());
    promise.resolve(params);
  }

  @ReactMethod
  public void isIgnoringBatteryOptimization(Promise promise) {
    new Thread(() -> {
      boolean result = BatteryOptimizationUtil.isIgnoringBatteryOptimization(
        reactContext.getApplicationContext(),
        reactContext.getPackageName()
      );
      promise.resolve(result);
    }).start();
  }

  @ReactMethod
  public void requestIgnoreBatteryOptimization(Promise promise) {
    new Thread(() -> {
      try {
        boolean result = BatteryOptimizationUtil.requestIgnoreBatteryOptimization(
          reactContext.getApplicationContext(),
          reactContext.getPackageName()
        );
        promise.resolve(result);
      } catch (Exception e) {
        promise.reject("ERROR", e);
      }
    }).start();
  }

  @ReactMethod
  public void setSystemBarsTransparent() {
    SystemBars.apply(getCurrentActivity());
  }

  /** `dark` glyphs for light themes, `light` glyphs for 墨夜. Bars stay transparent. */
  @ReactMethod
  public void setSystemBarIconStyle(String style) {
    SystemBars.setDarkIcons(!"light".equals(style));
    SystemBars.apply(getCurrentActivity());
  }

  /** Audio the media store can see. Rows without a file path are skipped. */
  @ReactMethod
  public void listDeviceAudio(Promise promise) {
    WritableArray result = Arguments.createArray();
    Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
    String[] projection = new String[] {
      MediaStore.Audio.Media.DISPLAY_NAME,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.SIZE,
      MediaStore.Audio.Media.DATA,
    };
    try (Cursor cursor = reactContext.getContentResolver().query(
      collection,
      projection,
      MediaStore.Audio.Media.IS_MUSIC + " != 0",
      null,
      MediaStore.Audio.Media.TITLE + " ASC"
    )) {
      if (cursor == null) {
        promise.resolve(result);
        return;
      }
      int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
      int titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
      int artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
      int albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
      int durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
      int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE);
      int dataCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
      while (cursor.moveToNext()) {
        String path = cursor.getString(dataCol);
        if (path == null || path.length() == 0) continue;
        WritableMap item = Arguments.createMap();
        item.putString("path", path);
        item.putString("displayName", cursor.isNull(nameCol) ? "" : cursor.getString(nameCol));
        item.putString("title", cursor.isNull(titleCol) ? "" : cursor.getString(titleCol));
        item.putString("artist", cursor.isNull(artistCol) ? "" : cursor.getString(artistCol));
        item.putString("album", cursor.isNull(albumCol) ? "" : cursor.getString(albumCol));
        item.putDouble("durationMs", cursor.isNull(durationCol) ? 0 : cursor.getLong(durationCol));
        item.putDouble("size", cursor.isNull(sizeCol) ? 0 : cursor.getLong(sizeCol));
        result.pushMap(item);
      }
    } catch (Exception e) {
      promise.reject("audio_scan_failed", e);
      return;
    }
    promise.resolve(result);
  }
}
