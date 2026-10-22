/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

package cn.lux.music.mobile.gallery;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

public class GalleryModule extends ReactContextBaseJavaModule {
  public GalleryModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "GalleryModule";
  }

  @ReactMethod
  public void saveImage(String path, Promise promise) {
    new Thread(() -> save(path, promise), "LuxGallerySave").start();
  }

  private void save(String path, Promise promise) {
    ContentResolver resolver = getReactApplicationContext().getContentResolver();
    Uri destination = null;
    File legacyFile = null;
    try {
      if (Build.VERSION.SDK_INT < 29 && getReactApplicationContext().checkCallingOrSelfPermission(
          Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
        promise.reject("E_PERMISSION_DENIED", "Storage permission denied");
        return;
      }
      Uri source = Uri.parse(path);
      if (!"file".equals(source.getScheme()) || source.getPath() == null) {
        throw new IOException("Expected a file URI");
      }
      File input = new File(source.getPath());
      if (!input.isFile() || input.length() == 0) throw new IOException("Capture is empty or missing");
      String name = "Lux-" + UUID.randomUUID() + ".png";
      ContentValues values = new ContentValues();
      values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
      values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
      if (Build.VERSION.SDK_INT >= 29) {
        values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Lux Music");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
      } else {
        File directory = new File(Environment.getExternalStoragePublicDirectory(
            Environment.DIRECTORY_PICTURES), "Lux Music");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create album");
        legacyFile = new File(directory, name);
        values.put(MediaStore.Images.Media.DATA, legacyFile.getAbsolutePath());
      }
      destination = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
      if (destination == null) throw new IOException("Cannot create gallery entry");
      try (FileInputStream in = new FileInputStream(input);
          OutputStream out = resolver.openOutputStream(destination)) {
        if (out == null) throw new IOException("Cannot open gallery entry");
        byte[] buffer = new byte[8192];
        int count;
        while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
      }
      if (Build.VERSION.SDK_INT >= 29) {
        ContentValues published = new ContentValues();
        published.put(MediaStore.Images.Media.IS_PENDING, 0);
        if (resolver.update(destination, published, null, null) != 1) {
          throw new IOException("Cannot publish gallery entry");
        }
      }
      promise.resolve(destination.toString());
    } catch (Exception error) {
      if (destination != null) {
        try { resolver.delete(destination, null, null); } catch (Exception ignored) { }
      }
      if (legacyFile != null) {
        try { legacyFile.delete(); } catch (Exception ignored) { }
      }
      promise.reject(error instanceof SecurityException ? "E_PERMISSION_DENIED" : "E_SAVE_IMAGE", error);
    }
  }
}
